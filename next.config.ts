import type { NextConfig } from "next";

// Cabeceras comunes de seguridad (sin CSP todavía: el script inline del tema
// exige un nonce y conviene probarlo aparte).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La cámara solo se usa en esta misma origen (escáner de códigos).
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Todo lo que no sea un recurso público estático (JS/CSS con hash,
        // iconos y manifest) puede contener datos personales de la sesión:
        // que ningún navegador ni proxy intermedio lo guarde en caché.
        // Es la garantía de que, tras cerrar sesión, "Atrás" o la PWA
        // instalada no muestran datos privados desde una copia guardada.
        source:
          "/((?!_next/static|_next/image|icons/|manifest\\.webmanifest|favicon\\.ico).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
