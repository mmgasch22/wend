import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PWA } from "@/lib/pwa/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PWA.name,
  description: PWA.description,
  applicationName: PWA.name,
  // iOS ignora parte del manifest: para "Añadir a pantalla de inicio" usa
  // estos metadatos y el apple-touch-icon.
  appleWebApp: { capable: true, title: PWA.name, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: PWA.icons.any192, sizes: "192x192", type: "image/png" },
      { url: PWA.icons.any512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: PWA.icons.apple180, sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PWA.themeColorLight },
    { media: "(prefers-color-scheme: dark)", color: PWA.themeColorDark },
  ],
};

// Aplica el tema guardado (localStorage) al <html> antes del primer
// pintado, para que no haya un parpadeo claro->oscuro al cargar. Solo
// toca el atributo si hay una elección explícita guardada; sin ella, el
// CSS ya sigue prefers-color-scheme por su cuenta (ver globals.css).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("wend-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
