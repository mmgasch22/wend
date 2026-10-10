import type { MetadataRoute } from "next";
import { PWA } from "../lib/pwa/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PWA.name,
    short_name: PWA.shortName,
    description: PWA.description,
    lang: "es",
    start_url: PWA.startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PWA.backgroundColor,
    theme_color: PWA.themeColorLight,
    icons: [
      { src: PWA.icons.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: PWA.icons.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: PWA.icons.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
