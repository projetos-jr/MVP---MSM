import type { MetadataRoute } from "next";

import { brand } from "@/config/brand";

/** Permite "Adicionar à tela inicial" no celular (abre como aplicativo). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.productName} — ${brand.companyName}`,
    short_name: brand.productName,
    description: brand.tagline,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.colors.background,
    theme_color: brand.colors.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
