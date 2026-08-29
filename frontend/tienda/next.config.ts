import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Las imagenes del catalogo viven en Cloudflare R2, en el dominio publico
  // del bucket. Sin declararlo, next/image las rechaza.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [{ protocol: "https" as const, hostname: process.env.NEXT_PUBLIC_MEDIA_HOST }]
        : []),
    ],
  },
};

export default config;
