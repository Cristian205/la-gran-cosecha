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
    // Las fotos optimizadas se guardan 31 días (el valor por defecto es 4 h):
    // una foto de producto casi nunca cambia, y cada revalidación es CPU del
    // servidor. Es lo que PageSpeed pide en «Usar tiempos de vida de caché
    // eficientes».
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [{ protocol: "https" as const, hostname: process.env.NEXT_PUBLIC_MEDIA_HOST }]
        : []),
    ],
  },
  // OJO: `experimental.inlineCss` se probó y se descartó. Medido en esta
  // tienda: el HTML pasa de ~21 KiB a ~231 KiB comprimidos (Next incrusta el
  // CSS y lo duplica en la carga RSC), más del doble de bytes que los ~91 KiB
  // actuales (HTML + 3 hojas externas), y el CSS deja de cachearse.
  // Next inyecta un polyfill para navegadores de hace años (`Array.prototype.at`,
  // `flat`, `Object.hasOwn`, `trimStart`…) que Lighthouse marca como «JavaScript
  // antiguo». Esta tienda solo se sirve a navegadores modernos (Chrome/Edge/
  // Firefox 111+, Safari 16.4+: todos traen esas funciones), así que se sustituye
  // por un módulo vacío.
  turbopack: {
    resolveAlias: {
      "../build/polyfills/polyfill-module": "./src/lib/modulo-vacio.js",
    },
  },
  // Archivos estáticos de /public: se cachean un mes. No llevan hash en el
  // nombre, así que no se marcan `immutable`; con `stale-while-revalidate` un
  // archivo reemplazado se actualiza solo en la siguiente visita.
  async headers() {
    const cache = "public, max-age=2592000, stale-while-revalidate=86400";
    return [
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: cache }] },
      { source: "/icons3d/:path*", headers: [{ key: "Cache-Control", value: cache }] },
    ];
  },
};

export default config;
