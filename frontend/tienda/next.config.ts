import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Empaqueta el servidor con solo las dependencias que de verdad usa. Es lo
  // que permite servir la tienda desde una imagen de node sin arrastrar
  // `node_modules` entero: la vieja se servia con nginx porque era estatica,
  // pero esta renderiza en el servidor —es la razon de haberla migrado— y
  // necesita un proceso vivo.
  output: "standalone",
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
