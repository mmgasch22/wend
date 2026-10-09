import { describe, expect, it } from "vitest";
import { fitToWidth, SCAN_VIEW_ASPECT_RATIO, visibleRegion } from "./region";

describe("visibleRegion", () => {
  it("móvil en vertical: solo la franja central, que es lo que se ve", () => {
    const region = visibleRegion(720, 1280);
    expect(region.sx).toBe(0);
    expect(region.sw).toBe(720);
    expect(region.sh).toBe(540); // 720 / (4/3)
    expect(region.sy).toBe((1280 - 540) / 2);
  });

  it("vídeo horizontal 16:9: se recortan los lados", () => {
    const region = visibleRegion(1280, 720);
    expect(region.sy).toBe(0);
    expect(region.sh).toBe(720);
    expect(region.sw).toBe(960); // 720 * 4/3
    expect(region.sx).toBe(160);
  });

  it("vídeo con la misma proporción que el recuadro: se usa entero", () => {
    expect(visibleRegion(640, 480)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 });
  });

  it("la región siempre cabe dentro del fotograma y tiene la proporción del recuadro", () => {
    const sizes: [number, number][] = [
      [1920, 1080],
      [1280, 720],
      [720, 1280],
      [1080, 1920],
      [640, 480],
      [480, 640],
    ];
    for (const [w, h] of sizes) {
      const r = visibleRegion(w, h);
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
      expect(r.sx + r.sw).toBeLessThanOrEqual(w + 1e-9);
      expect(r.sy + r.sh).toBeLessThanOrEqual(h + 1e-9);
      expect(r.sw / r.sh).toBeCloseTo(SCAN_VIEW_ASPECT_RATIO, 6);
    }
  });
});

describe("fitToWidth", () => {
  it("reduce manteniendo la proporción", () => {
    expect(fitToWidth(960, 720, 640)).toEqual({ width: 640, height: 480 });
  });

  it("nunca amplía una imagen pequeña", () => {
    expect(fitToWidth(320, 240, 640)).toEqual({ width: 320, height: 240 });
  });

  it("nunca devuelve tamaños cero", () => {
    expect(fitToWidth(10000, 1, 100).height).toBeGreaterThanOrEqual(1);
  });
});
