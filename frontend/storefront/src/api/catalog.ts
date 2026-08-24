import { api } from "./client";
import type { Categoria, Paginated, Producto, UnidadMedida } from "../types";

/** Tamaño de tanda del catálogo: lo que se ve y lo que trae cada "Cargar más". */
export const PRODUCTOS_POR_TANDA = 24;

export type OrdenCatalogo =
  | "recomendados"
  | "nombre"
  | "precio_asc"
  | "precio_desc"
  | "recientes";

/**
 * Traducción a `?ordering=` de DRF. Solo criterios que el backend sabe ordenar
 * sobre el catálogo completo (ver `ordering_fields` en ProductoViewSet):
 * ordenar en el cliente solo reordenaría la tanda visible, no el catálogo.
 * "Más vendidos" no está aquí a propósito: existe como sección propia
 * (/orders/productos-mas-vendidos/), no como criterio del listado.
 */
const ORDERING: Record<OrdenCatalogo, string | undefined> = {
  recomendados: undefined, // orden natural del catálogo (orden, nombre_producto)
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

export const OPCIONES_ORDEN: OpcionOrden[] = [
  { valor: "recomendados", etiqueta: "Recomendados", corta: "Ordenar" },
  { valor: "precio_asc", etiqueta: "Precio: menor a mayor", corta: "$ menor" },
  { valor: "precio_desc", etiqueta: "Precio: mayor a menor", corta: "$ mayor" },
  { valor: "nombre", etiqueta: "Nombre (A-Z)", corta: "A-Z" },
  { valor: "recientes", etiqueta: "Más recientes", corta: "Nuevos" },
];

// Las categorías son pocas y prácticamente estáticas, pero las piden la
// búsqueda global, la tienda, el bloque de inicio y el pie: eran tres o cuatro
// peticiones idénticas por carga. Se comparte la misma promesa entre todos y
// se descarta si falla, para que un error se pueda reintentar.
let cacheCategorias: Promise<Categoria[]> | null = null;

export function obtenerCategorias(): Promise<Categoria[]> {
  if (!cacheCategorias) {
    cacheCategorias = api
      .get<Paginated<Categoria> | Categoria[]>("/catalog/categories/")
      .then(({ data }) => (Array.isArray(data) ? data : data.results))
      .catch((e) => {
        cacheCategorias = null;
        throw e;
      });
  }
  return cacheCategorias;
}

export async function obtenerUnidades(): Promise<UnidadMedida[]> {
  const { data } = await api.get<Paginated<UnidadMedida> | UnidadMedida[]>(
    "/catalog/units/"
  );
  return Array.isArray(data) ? data : data.results;
}

export interface ParamsProductos {
  search?: string;
  categoria?: number;
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
  { search, categoria, page, pageSize, orden, signal }: ParamsProductos = {}
): Promise<Paginated<Producto>> {
  const { data } = await api.get<Paginated<Producto>>("/catalog/products/", {
    signal,
    params: {
      search: search || undefined,
      categoria,
      page,
      page_size: pageSize ?? PRODUCTOS_POR_TANDA,
      ordering: orden ? ORDERING[orden] : undefined,
    },
  });
  return data;
}

export async function obtenerProductosMasVendidos(): Promise<Producto[]> {
  const { data } = await api.get<Producto[]>("/orders/productos-mas-vendidos/");
  return data;
}
