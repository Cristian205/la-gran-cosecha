import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Empaqueta el servidor con solo las dependencias que de verdad usa. Es lo
  // que permite servir la tienda desde una imagen de node sin arrastrar
  // `node_modules` entero: la vieja se servia con nginx porque era estatica,
  // pero esta renderiza en el servidor —es la razon de haberla migrado— y
  // necesita un proceso vivo.
  //
  // Solo para la imagen de Docker. En Vercel NO va: allí el empaquetado lo hace
  // la plataforma, y declararlo la deja compilando una salida que luego no sabe
  // servir. El Dockerfile lo enciende con `SALIDA_STANDALONE=1`; cualquier otro
  // sitio —Vercel incluido— compila normal sin tener que apagar nada.
  ...(process.env.SALIDA_STANDALONE === "1"
    ? { output: "standalone" as const }
    : {}),
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
