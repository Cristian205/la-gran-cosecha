/**
 * Las llamadas que hace el NAVEGADOR.
 *
 * Van a `/api/...` del propio dominio de la tienda, no al backend
 * directamente: `next.config.ts` las reescribe hacia Django añadiendo la
 * cabecera del negocio. Así el navegador nunca ve la clave del servidor ni
 * necesita saber en qué negocio está — lo dice la dirección por la que entró.
 *
 * El servidor tiene su propio camino en `lib/api.ts`. Los dos existen porque
 * hacen cosas distintas: el servidor busca SEO (el HTML sale con los datos
 * dentro) y este busca interactividad (filtrar, buscar, paginar sin recargar).
 */
import type {
  Anuncio,
  BeneficioComercial,
  Categoria,
  ItemCarrito,
  ItemPersonalizado,
  OfertaProducto,
  Paginated,
  Producto,
  PromoBanner,
  RespuestaPedido,
  SiteConfig,
  Testimonio,
  TrustBadge,
  UnidadMedida,
} from "@/lib/tipos";

const BASE = "/api";

async function pedir<T>(
  ruta: string,
  params?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const url = new URL(BASE + ruta, window.location.origin);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!r.ok) throw new Error(`${ruta} respondio ${r.status}`);
  return (await r.json()) as T;
}

async function enviar<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(BASE + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`${ruta} respondio ${r.status}`);
    Object.assign(e, { detalle: datos, estado: r.status });
    throw e;
  }
  return datos as T;
}

// Exportada: `lib/pagina.ts` la reusa para desempaquetar en el servidor lo
// mismo que este archivo desempaqueta en el navegador — un dato paginado o no
// tiene la misma forma sea quien sea que lo pida, y repetir la función en dos
// sitios daría dos criterios de qué es "la lista" el día que cambie.
export function desempaquetar<T>(datos: Paginated<T> | T[]): T[] {
  return Array.isArray(datos) ? datos : datos.results;
}


// ---------- catalog.ts ----------

/** Tamaño de tanda del catálogo: lo que se ve y lo que trae cada "Cargar más". */
export const PRODUCTOS_POR_TANDA = 24;

export type OrdenCatalogo =
  | "recomendados"
  | "mas_pedidos"
  | "nombre"
  | "precio_asc"
  | "precio_desc"
  | "recientes";

/**
 * Traducción a `?ordering=` de DRF. Solo criterios que el backend sabe ordenar
 * sobre el catálogo completo (ver `ordering_fields` en ProductoViewSet):
 * ordenar en el cliente solo reordenaría la tanda visible, no el catálogo.
 * "Más pedidos" usa la misma medida que la sección de favoritos (unidades en
 * pedidos entregados), anotada por el backend solo cuando se pide; el
 * desempate por `orden` mantiene estable la paginación entre productos que
 * todavía no se han vendido.
 */
const ORDERING: Record<OrdenCatalogo, string | undefined> = {
  recomendados: undefined, // orden natural del catálogo (orden, nombre_producto)
  mas_pedidos: "-unidades_vendidas,orden,nombre_producto",
  nombre: "nombre_producto",
  precio_asc: "precio_desde",
  precio_desc: "-precio_desde",
  recientes: "-fecha_creacion",
};

export interface OpcionOrden {
  valor: OrdenCatalogo;
  etiqueta: string;
  /** Etiqueta para el botón compacto de móvil, donde el ancho es escaso. */
  corta: string;
}

/**
 * Las opciones que ofrece la tienda: cinco y no más. `recientes` sigue
 * existiendo como criterio (lo usa una vitrina fija de `grid-productos`),
 * pero en un catálogo de abastecimiento "lo último que se dio de alta" no le
 * ayuda a nadie a comprar.
 */
export const OPCIONES_ORDEN: OpcionOrden[] = [
  { valor: "recomendados", etiqueta: "Recomendados", corta: "Ordenar" },
  { valor: "mas_pedidos", etiqueta: "Más pedidos", corta: "Más pedidos" },
  { valor: "nombre", etiqueta: "Nombre A-Z", corta: "A-Z" },
  { valor: "precio_asc", etiqueta: "Precio menor", corta: "$ menor" },
  { valor: "precio_desc", etiqueta: "Precio mayor", corta: "$ mayor" },
];

// Las categorías son pocas y prácticamente estáticas, pero las piden la
// búsqueda global, la tienda, el bloque de inicio y el pie: eran tres o cuatro
// peticiones idénticas por carga. Se comparte la misma promesa entre todos y
// se descarta si falla, para que un error se pueda reintentar.
let cacheCategorias: Promise<Categoria[]> | null = null;

export function obtenerCategorias(): Promise<Categoria[]> {
  if (!cacheCategorias) {
    cacheCategorias = pedir<Paginated<Categoria> | Categoria[]>("/catalog/categories/")
      .then(desempaquetar)
      .catch((e) => {
        cacheCategorias = null;
        throw e;
      });
  }
  return cacheCategorias;
}

/**
 * Las unidades por las que HOY se vende algo, con cuántos productos cada una
 * (`?en_catalogo=1`). Es la lista del filtro "Se vende por": se cachea como
 * las categorías porque cambia igual de poco y la piden el panel lateral y
 * la hoja de filtros del móvil.
 */
let cacheUnidadesEnCatalogo: Promise<UnidadMedida[]> | null = null;

export function obtenerUnidadesEnCatalogo(): Promise<UnidadMedida[]> {
  if (!cacheUnidadesEnCatalogo) {
    cacheUnidadesEnCatalogo = pedir<UnidadMedida[]>("/catalog/units/", { en_catalogo: 1 }).catch(
      (e) => {
        cacheUnidadesEnCatalogo = null;
        throw e;
      }
    );
  }
  return cacheUnidadesEnCatalogo;
}

export async function obtenerUnidades(): Promise<UnidadMedida[]> {
  return desempaquetar(
    await pedir<Paginated<UnidadMedida> | UnidadMedida[]>("/catalog/units/")
  );
}

export interface ParamsProductos {
  search?: string;
  slug?: string;
  categoria?: number;
  /** "Se vende por": solo productos con una presentación en esta unidad. */
  unidad?: number;
  page?: number;
  pageSize?: number;
  orden?: OrdenCatalogo;
  signal?: AbortSignal;
}

/**
 * Devuelve la página completa (`count`, `next`, `results`), no solo los
 * resultados: el contador del catálogo y el botón "Cargar más" dependen de
 * `count`/`next`, que antes se descartaban.
 */
export async function obtenerProductos(
  { search, slug, categoria, unidad, page, pageSize, orden, signal }: ParamsProductos = {}
): Promise<Paginated<Producto>> {
  return pedir<Paginated<Producto>>(
    "/catalog/products/",
    {
      search: search || undefined,
      slug: slug || undefined,
      categoria,
      unidad,
      page,
      page_size: pageSize ?? PRODUCTOS_POR_TANDA,
      ordering: orden ? ORDERING[orden] : undefined,
    },
    signal
  );
}

export async function obtenerProductosMasVendidos(): Promise<Producto[]> {
  return pedir<Producto[]>("/orders/productos-mas-vendidos/");
}

// ---------- content.ts ----------

export async function obtenerSiteConfig(): Promise<SiteConfig> {
  return pedir<SiteConfig>("/content/site-config/");
}

export async function obtenerBanners(): Promise<PromoBanner[]> {
  return desempaquetar(await pedir<Paginated<PromoBanner> | PromoBanner[]>("/content/banners/"));
}

export async function obtenerAnuncios(): Promise<Anuncio[]> {
  return desempaquetar(await pedir<Paginated<Anuncio> | Anuncio[]>("/content/anuncios/"));
}

export async function obtenerTestimonios(): Promise<Testimonio[]> {
  return desempaquetar(await pedir<Paginated<Testimonio> | Testimonio[]>("/content/testimonials/"));
}

export async function obtenerTrustBadges(): Promise<TrustBadge[]> {
  return desempaquetar(await pedir<Paginated<TrustBadge> | TrustBadge[]>("/content/trust-badges/"));
}

export async function obtenerBeneficios(): Promise<BeneficioComercial[]> {
  return desempaquetar(await pedir<Paginated<BeneficioComercial> | BeneficioComercial[]>("/content/beneficios/"));
}

export async function obtenerOfertas(): Promise<OfertaProducto[]> {
  return desempaquetar(await pedir<Paginated<OfertaProducto> | OfertaProducto[]>("/content/ofertas/"));
}

// ---------- orders.ts ----------

export interface DatosCliente {
  nombre: string;
  telefono?: string;
  direccion?: string;
}

export async function crearPedido(
  cliente: DatosCliente,
  items: ItemCarrito[],
  observaciones = "",
  personalizados: ItemPersonalizado[] = []
): Promise<RespuestaPedido> {
  const payload = {
    cliente,
    items: items.map((i) => ({
      presentacion_id: i.presentacionId,
      cantidad: i.cantidad,
    })),
    personalizados: personalizados.map((p) => ({
      nombre: p.nombre,
      cantidad: p.cantidad,
      unidad_id: p.unidadId ?? undefined,
      categoria_id: p.categoriaId,
    })),
    observaciones,
  };
  return enviar<RespuestaPedido>("/orders/", payload);
}

// ---------- contact.ts ----------
export interface MensajeContactoInput {
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
}

export async function enviarMensajeContacto(
  datos: MensajeContactoInput
): Promise<void> {
  await enviar("/contact/messages/", datos);
}

/**
 * Apuntar un correo a la lista del negocio.
 *
 * Va contra `contact.Suscriptor`, que es una tabla propia y no la bandeja de
 * mensajes: una lista de correo que se guarda como «mensajes de contacto» no se
 * puede consultar ni exportar, y llena la bandeja de no-mensajes.
 *
 * Repetir el mismo correo NO es un error — el servidor responde que si. Quien
 * no esta seguro de si funciono vuelve a pulsar, y devolverle un fallo le diria
 * que algo se rompio cuando ya estaba dentro.
 */
export async function suscribirAlBoletin(email: string): Promise<void> {
  await enviar("/contact/subscribers/", { email, origen: "tienda" });
}
