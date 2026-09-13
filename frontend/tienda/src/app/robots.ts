import type { MetadataRoute } from "next";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";

/**
 * El robots.txt de ESTE negocio.
 *
 * Mismo motivo que `sitemap.ts`: por host, no fijo. Si el host no corresponde
 * a ningún negocio no hay sitemap que anunciar ni catálogo que dejar rastrear
 * — se cierra todo, igual que el layout responde 404 en ese caso.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [config, { host }] = await Promise.all([
    configuracionDeLaTienda(),
    negocioDeLaPeticion(),
  ]);

  if (!config) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const base = `https://${host}`;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // El checkout es transaccional y personal — nada que un rastreador deba
      // indexar — y `/api/` es el proxy hacia Django, no una página.
      disallow: ["/tienda/pedido", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
