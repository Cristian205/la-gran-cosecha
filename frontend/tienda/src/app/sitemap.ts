import type { MetadataRoute } from "next";
import { pedirAlBackend } from "@/lib/api";
import { desempaquetar } from "@/lib/datos";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import { POLITICAS } from "@/lib/legal/politicas";
import type { Paginated, Producto } from "@/lib/tipos";

/**
 * El sitemap de ESTE negocio, no de la plataforma.
 *
 * Igual que el resto de la tienda, se resuelve por host: una instancia sirve
 * muchos negocios, así que no hay un sitemap fijo que compilar.
 *
 * # Qué entra y qué no
 *
 * Solo URLs que responden 200, son canónicas de sí mismas y no llevan
 * `noindex`. Hasta ahora entraban también `/_no-encontrada` (responde 404),
 * `/entrar` (la pantalla de acceso) y las 194 fichas con `lastmod` = «ahora»:
 * Google recibía 210 URLs que no podía tomarse en serio y dejó 182 en
 * «Descubierta: actualmente sin indexar». La fuente es `/storefront/indice-seo/`,
 * que solo devuelve lo publicable —producto activo, de una categoría activa y
 * con algo a la venta— y la fecha REAL de su último cambio (edición o precio).
 * Una entrada sin fecha conocida va sin `lastmod`: mejor nada que una inventada.
 *
 * Se regenera solo: el backend se consulta con la misma caché corta que el
 * resto del catálogo, así que publicar, editar o apagar un producto se refleja
 * aquí en cuanto vence esa caché.
 *
 * El checkout, «mis pedidos» y la búsqueda no entran: no son páginas que a
 * nadie le sirva encontrar en un buscador (y llevan `noindex`).
 */
const RUTAS_LEGALES = ["/legal", ...POLITICAS.map((p) => `/${p.slug}`)];
const RUTAS_FIJAS = new Set(["/", "/tienda", "/nosotros", "/contacto", ...RUTAS_LEGALES]);
/** Rutas que nunca son páginas indexables, aunque el motor las publique. */
const RUTAS_PRIVADAS = new Set(["/tienda/pedido", "/tienda/mis-pedidos", "/entrar"]);

interface IndiceSeo {
  paginas: { ruta: string; indexable: boolean; lastmod: string | null }[];
  categorias: { id: number; slug: string; num_productos: number; lastmod: string | null }[];
  productos: { slug: string; lastmod: string | null }[];
}

function fecha(valor: string | null | undefined): Date | undefined {
  if (!valor) return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** La más reciente de varias fechas (las que existan). */
function masReciente(...fechas: (Date | undefined)[]): Date | undefined {
  const validas = fechas.filter((d): d is Date => Boolean(d));
  return validas.length ? new Date(Math.max(...validas.map((d) => d.getTime()))) : undefined;
}

function entrada(url: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return lastModified ? { url, lastModified } : { url };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [config, { host }] = await Promise.all([configuracionDeLaTienda(), negocioDeLaPeticion()]);

  // Sin negocio en este host no hay nada que listar.
  if (!config) return [];

  const base = `https://${host}`;
  const indice = await pedirAlBackend<IndiceSeo>("/storefront/indice-seo/").catch(() => null);

  if (!indice) return sitemapDeRespaldo(base);

  const paginaPorRuta = new Map(indice.paginas.map((p) => [p.ruta, p]));
  const fechaDe = (ruta: string) => fecha(paginaPorRuta.get(ruta)?.lastmod);
  const ultimoProducto = masReciente(...indice.productos.map((p) => fecha(p.lastmod)));

  const fijas = [
    // El inicio y el catálogo muestran productos: cambian cuando cambian ellos.
    entrada(base, masReciente(fechaDe("/"), ultimoProducto)),
    entrada(`${base}/tienda`, masReciente(fechaDe("/tienda"), ultimoProducto)),
    entrada(`${base}/nosotros`, fechaDe("/nosotros")),
    entrada(`${base}/contacto`, fechaDe("/contacto")),
    ...RUTAS_LEGALES.map((ruta) => entrada(`${base}${ruta}`)),
  ];

  const propias = indice.paginas
    .filter((p) => p.indexable && !RUTAS_FIJAS.has(p.ruta) && !RUTAS_PRIVADAS.has(p.ruta))
    .map((p) => entrada(`${base}${p.ruta}`, fecha(p.lastmod)));

  const categorias = indice.categorias
    .filter((c) => c.slug && c.num_productos > 0)
    .map((c) => entrada(`${base}/tienda/${c.slug}`, fecha(c.lastmod)));

  const fichas = indice.productos.map((p) => entrada(`${base}/productos/${p.slug}`, fecha(p.lastmod)));

  return [...fijas, ...propias, ...categorias, ...fichas];
}

/**
 * Mientras el backend no tenga `/storefront/indice-seo/` (el frontend y el
 * backend se despliegan por separado): el listado de antes, pero ya sin las
 * rutas internas ni fechas inventadas.
 */
async function sitemapDeRespaldo(base: string): Promise<MetadataRoute.Sitemap> {
  const [respuestaRutas, productos] = await Promise.all([
    pedirAlBackend<{ rutas: string[] }>("/storefront/rutas/").catch(() => null),
    pedirAlBackend<Paginated<Producto> | Producto[]>("/catalog/products/", {
      params: { page_size: 500, estado: "activos" },
    }).catch(() => null),
  ]);

  const fijas = ["", "/tienda", "/nosotros", "/contacto", ...RUTAS_LEGALES].map((ruta) =>
    entrada(`${base}${ruta}`)
  );
  const propias = (respuestaRutas?.rutas ?? [])
    .filter((r) => !RUTAS_FIJAS.has(r) && !RUTAS_PRIVADAS.has(r) && !r.startsWith("/_"))
    .map((r) => entrada(`${base}${r}`));
  const fichas = (productos ? desempaquetar(productos) : [])
    .filter((p) => p.precio_desde)
    .map((p) => entrada(`${base}/productos/${p.slug}`));

  return [...fijas, ...propias, ...fichas];
}
