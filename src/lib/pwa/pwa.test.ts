import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../app/manifest";
import nextConfig from "../../../next.config";
import { PWA } from "./config";

const publicDir = join(process.cwd(), "public");

// Lee las dimensiones reales del PNG (cabecera IHDR) sin dependencias.
function pngSize(path: string) {
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("manifest de la PWA", () => {
  const m = manifest();

  it("se llama WEND y se abre sin barra del navegador", () => {
    expect(m.name).toBe("WEND");
    expect(m.short_name).toBe("WEND");
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("es");
  });

  it("arranca en una ruta que exige sesión, no en la portada pública", () => {
    expect(m.start_url).toBe("/dashboard");
    expect(m.scope).toBe("/");
  });

  it("declara iconos de 192 y 512 y uno maskable, y los ficheros existen con ese tamaño", () => {
    const icons = m.icons ?? [];
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);

    for (const icon of icons) {
      const file = join(publicDir, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = (icon.sizes as string).split("x").map(Number);
      expect(pngSize(file)).toEqual({ width: w, height: h });
    }
  });

  it("existe el apple-touch-icon de 180x180 para iPhone", () => {
    const file = join(publicDir, PWA.icons.apple180);
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)).toEqual({ width: 180, height: 180 });
  });
});

describe("cabeceras HTTP", () => {
  it("las rutas privadas no se cachean y los recursos públicos estáticos sí quedan fuera", async () => {
    const rules = await nextConfig.headers!();
    const noStore = rules.find((r) =>
      r.headers.some((h) => h.key === "Cache-Control"),
    )!;
    expect(noStore.headers).toContainEqual({
      key: "Cache-Control",
      value: "private, no-store",
    });

    // La regla es una regex con lookahead negativo: se comprueba qué rutas toca.
    const re = new RegExp(`^${noStore.source.replace("/:path*", "")}$`);
    for (const privatePath of ["/dashboard", "/stats", "/profile/edit", "/api/food-search", "/login"]) {
      expect(re.test(privatePath), privatePath).toBe(true);
    }
    for (const publicPath of ["/_next/static/chunks/a.js", "/icons/icon-192.png", "/manifest.webmanifest"]) {
      expect(re.test(publicPath), publicPath).toBe(false);
    }
  });

  it("permite la cámara solo en el propio origen", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.flatMap((r) => r.headers);
    const perm = all.find((h) => h.key === "Permissions-Policy")!;
    expect(perm.value).toContain("camera=(self)");
    expect(perm.value).toContain("microphone=()");
  });
});
