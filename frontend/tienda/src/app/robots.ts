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
      // `/api/` es el proxy hacia Django, no una página. El checkout, «mis
      // pedidos» y la pantalla de acceso NO se bloquean aquí a propósito: llevan
      // `noindex`, y una URL bloqueada en robots.txt no se rastrea, así que
      // Google nunca leería ese `noindex` y podría indexarla igual (sin
      // contenido) si alguien la enlaza.
      disallow: ["/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
