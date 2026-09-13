import type { MetadataRoute } from "next";
import { pedirAlBackend } from "@/lib/api";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";

/**
 * El sitemap de ESTE negocio, no de la plataforma.
 *
 * Igual que el resto de la tienda, se resuelve por host: una instancia sirve
 * cuarenta negocios distintos, así que no hay un sitemap fijo que compilar,
 * hay que preguntar quién es el visitante y qué páginas tiene publicadas.
 *
 * Las páginas propias (los `Pagina` que el negocio compuso en el panel) salen
 * de `/storefront/rutas/` — el mismo listado que ya usaba Next para saber qué
 * generar. `/tienda/pedido` queda fuera a propósito: es el checkout, no una
 * página que a nadie le sirva encontrar en un buscador.
 */
const RUTAS_FIJAS = ["/", "/tienda", "/nosotros", "/contacto"];
const RUTAS_EXCLUIDAS = new Set([...RUTAS_FIJAS, "/tienda/pedido"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [config, { host }] = await Promise.all([
    configuracionDeLaTienda(),
    negocioDeLaPeticion(),
  ]);

  // Sin negocio en este host no hay nada que listar — el layout ya responde
  // 404 en este mismo caso, un sitemap no es la excepción.
  if (!config) return [];

  const base = `https://${host}`;
  const ahora = new Date();

  const fijas: MetadataRoute.Sitemap = [
    { url: base, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tienda`, lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/nosotros`, lastModified: ahora, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contacto`, lastModified: ahora, changeFrequency: "monthly", priority: 0.5 },
  ];

  const respuesta = await pedirAlBackend<{ rutas: string[] }>("/storefront/rutas/");
  const propias: MetadataRoute.Sitemap = (respuesta?.rutas ?? [])
    .filter((ruta) => !RUTAS_EXCLUIDAS.has(ruta))
    .map((ruta) => ({
      url: `${base}${ruta}`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [...fijas, ...propias];
}
