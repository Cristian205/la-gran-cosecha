"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerProductos, type OrdenCatalogo } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";

const DEBOUNCE_MS = 300;

interface Filtros {
  busqueda: string;
  categoria: number | null;
  orden: OrdenCatalogo;
}

interface Contexto {
  clave: string;
  filtros: Filtros;
  pagina: number;
}

export interface EstadoCatalogo {
  productos: Producto[];
  /** Total real del filtro actual, según `count` del backend. */
  total: number | null;
  cargando: boolean;
  cargandoMas: boolean;
  error: boolean;
  hayMas: boolean;
  cargarMas: () => void;
  reintentar: () => void;
  /** true mientras el texto tecleado aún no se ha enviado al backend. */
  esperandoBusqueda: boolean;
}

/** Identidad del filtro. JSON y no concatenación: un "|" tecleado en el
 *  buscador no debe poder partir la clave en pedazos equivocados. */
function claveDe({ busqueda, categoria, orden }: Filtros): string {
  return JSON.stringify([busqueda, categoria, orden]);
}

/**
 * Carga el catálogo por tandas usando la paginación que el backend ya expone.
 * Antes la tienda pedía `page_size=100` y se quedaba solo con `results`, así
 * que a partir del producto 101 el catálogo desaparecía en silencio.
 *
 * Acumula las tandas (patrón "Cargar más"), cancela la petición en vuelo al
 * cambiar de filtro y espera a que el usuario deje de teclear antes de buscar.
 */
export function useCatalogo(filtros: Filtros): EstadoCatalogo {
  const [busquedaAplicada, setBusquedaAplicada] = useState(filtros.busqueda);

  // Debounce del texto: sin esto la tienda lanzaba una petición por tecla.
  useEffect(() => {
    if (busquedaAplicada === filtros.busqueda) return;
    const id = setTimeout(() => setBusquedaAplicada(filtros.busqueda), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filtros.busqueda, busquedaAplicada]);

  const filtrosAplicados: Filtros = { ...filtros, busqueda: busquedaAplicada };
  const clave = claveDe(filtrosAplicados);

  const [ctx, setCtx] = useState<Contexto>({
    clave,
    filtros: filtrosAplicados,
    pagina: 1,
  });
  const [intento, setIntento] = useState(0);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);

  // Al cambiar cualquier filtro volvemos a la primera tanda. Se hace en un
  // estado combinado para que el efecto de carga nunca vea una clave nueva
  // junto a una página vieja y pida la página 3 de un filtro recién cambiado.
  useEffect(() => {
    setCtx((actual) =>
      actual.clave === clave ? actual : { clave, filtros: filtrosAplicados, pagina: 1 }
    );
    // `filtrosAplicados` se reconstruye en cada render; `clave` es su identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(() => {
    if (ctx.clave !== clave) return;

    const controlador = new AbortController();
    const esPrimeraTanda = ctx.pagina === 1;

    if (esPrimeraTanda) setCargando(true);
    else setCargandoMas(true);
    setError(false);

    obtenerProductos({
      search: ctx.filtros.busqueda,
      categoria: ctx.filtros.categoria ?? undefined,
      orden: ctx.filtros.orden,
      page: ctx.pagina,
      signal: controlador.signal,
    })
      .then((data) => {
        setProductos((previos) =>
          esPrimeraTanda ? data.results : [...previos, ...data.results]
        );
        setTotal(data.count);
        setHayMas(Boolean(data.next));
      })
      .catch((e) => {
        if ((e instanceof DOMException && e.name === "AbortError") || controlador.signal.aborted) return;
        setError(true);
        if (esPrimeraTanda) {
          setProductos([]);
          setTotal(null);
          setHayMas(false);
        }
      })
      .finally(() => {
        if (controlador.signal.aborted) return;
        setCargando(false);
        setCargandoMas(false);
      });

    return () => controlador.abort();
  }, [ctx, clave, intento]);

  const cargarMas = useCallback(() => {
    setCtx((actual) => ({ ...actual, pagina: actual.pagina + 1 }));
  }, []);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return {
    productos,
    total,
    cargando,
    cargandoMas,
    error,
    hayMas,
    cargarMas,
    reintentar,
    esperandoBusqueda: busquedaAplicada !== filtros.busqueda,
  };
}
