import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "WEND",
  description: "WEND — registro de comidas, macros y hábitos, sin fricción.",
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
