// Valores compartidos por el manifest, los metadatos del layout y las
// pruebas. Los colores replican --primary y --background de globals.css
// (modo claro); si cambia la identidad visual, se cambian aquí y en el CSS.
export const PWA = {
  name: "WEND",
  shortName: "WEND",
  description: "WEND — registro de comidas, macros y hábitos, sin fricción.",
  // /dashboard redirige a /login si no hay sesión; abrir la app instalada
  // en "/" mostraría la portada pública aunque ya hubiera sesión.
  startUrl: "/dashboard",
  themeColorLight: "#0e7c86",
  themeColorDark: "#121314",
  backgroundColor: "#f7f8f6",
  icons: {
    any192: "/icons/icon-192.png",
    any512: "/icons/icon-512.png",
    maskable512: "/icons/icon-maskable-512.png",
    apple180: "/icons/apple-touch-icon.png",
  },
} as const;
