"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerProductos, refrescarProductos, type OrdenCatalogo } from "@/lib/datos";
import {
  esRecarga,
  guardarCatalogo,
  guardarScrollCatalogo,
  leerCatalogo,
  type CatalogoGuardado,
} from "@/lib/cacheCatalogo";
import type { Producto } from "@/lib/tipos";

const DEBOUNCE_MS = 300;
/** Ids por petición al revalidar la caché (el backend acepta hasta 200). */
const IDS_POR_PETICION = 100;

interface Filtros {
  busqueda: string;
  categoria: number | null;
  /** "Se vende por": id de la unidad de venta, o null para todas. */
  unidad: number | null;
  orden: OrdenCatalogo;
}

/**
 * La primera tanda, ya resuelta por el servidor (mismo criterio que
 * `MasVendidos`): sin esto, un bloque de catálogo interactivo pintaría un
 * esqueleto de carga en el HTML que sirve el servidor, y el rastreador vería
 * eso en vez de productos.
 */
export interface SemillaCatalogo {
  productos: Producto[];
  total: number;
  hayMas: boolean;
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
function claveDe({ busqueda, categoria, unidad, orden }: Filtros): string {
  return JSON.stringify([busqueda, categoria, unidad, orden]);
}

/**
 * Carga el catálogo por tandas usando la paginación que el backend ya expone.
 * Antes la tienda pedía `page_size=100` y se quedaba solo con `results`, así
 * que a partir del producto 101 el catálogo desaparecía en silencio.
 *
 * Acumula las tandas (patrón "Cargar más"), cancela la petición en vuelo al
 * cambiar de filtro y espera a que el usuario deje de teclear antes de buscar.
 */
export function useCatalogo(filtros: Filtros, semilla?: SemillaCatalogo): EstadoCatalogo {
  // La semilla solo vale para el catálogo sin filtrar y en su orden natural:
  // el servidor siempre resuelve la primera pagina así, de modo que usarla con
  // un filtro ya activo (por ejemplo, un enlace directo a "?categoria=5")
  // pintaría el catálogo entero donde tocaba una categoría.
  const semillaValida =
    Boolean(semilla) &&
    !filtros.busqueda &&
    filtros.categoria === null &&
    filtros.unidad === null &&
    filtros.orden === "recomendados";
  const semillaUsada = useRef(false);

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

  const [productos, setProductos] = useState<Producto[]>(
    semillaValida ? semilla!.productos : []
  );
  const [total, setTotal] = useState<number | null>(semillaValida ? semilla!.total : null);
  const [hayMas, setHayMas] = useState(semillaValida ? semilla!.hayMas : false);
  const [cargando, setCargando] = useState(!semillaValida);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  // Mientras se revalida la lista restaurada no se piden más tandas: la
  // revalidación reemplaza la lista entera y se comería la tanda nueva.
  const [revalidando, setRevalidando] = useState(false);

  // Contextos cuyo fetch NO toca hacer porque su lista ya llegó de la caché.
  const omitir = useRef(new WeakSet<Contexto>());
  const scrollPendiente = useRef<number | null>(null);

  // Al cambiar cualquier filtro volvemos a la primera tanda, y se hace DURANTE
  // el render, no en un efecto. Con un efecto había un render intermedio con
  // el filtro nuevo pero la lista vieja (y `hayMas` de la lista vieja): si el
  // cliente estaba al fondo, la carga automática pedía "la siguiente" sobre el
  // filtro recién elegido — la página 3 de una categoría de 29 productos —, el
  // backend respondía 404 y el catálogo mostraba «No pudimos traer más».
  if (ctx.clave !== clave) {
    setCtx({ clave, filtros: filtrosAplicados, pagina: 1 });
    setCargando(true);
    setCargandoMas(false);
    setHayMas(false);
    setError(false);
  }

  // Al recargar: la lista que ya se había cargado vuelve desde el navegador
  // (ver `lib/cacheCatalogo.ts`) en vez de paginar otra vez desde la tanda 1.
  // Va en un efecto y no en el estado inicial: el HTML del servidor trae solo
  // la primera tanda y la hidratación tiene que coincidir con él. Está
  // declarado ANTES del efecto de carga para marcar su contexto como omitido.
  useEffect(() => {
    if (ctx.clave !== clave) return;
    const guardado = leerCatalogo(clave);
    if (!guardado) return;

    semillaUsada.current = true;
    omitir.current.add(ctx);
    const restaurado: Contexto = { ...ctx, pagina: Math.max(1, guardado.pagina) };
    omitir.current.add(restaurado);
    setCtx(restaurado);
    setProductos(guardado.productos);
    setTotal(guardado.total);
    setHayMas(guardado.hayMas);
    setCargando(false);
    setError(false);
    if (esRecarga() && guardado.scroll) scrollPendiente.current = guardado.scroll;

    const controlador = new AbortController();
    setRevalidando(true);
    revalidar(guardado, restaurado, controlador.signal)
      .catch(() => undefined) // sin red: se queda la lista guardada
      .finally(() => {
        if (!controlador.signal.aborted) setRevalidando(false);
      });
    return () => controlador.abort();
    // Solo al montar: después, la lista ya vive en memoria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pone al día la lista restaurada sin volver a paginar: la primera tanda se
   * pide fresca (o se toma la semilla, que el servidor acaba de resolver) y el
   * resto se refresca por ids en una o dos peticiones. Si el TOTAL cambió
   * —entró o salió un producto— las posiciones ya no valen y se empieza de la
   * primera tanda, como antes.
   */
  async function revalidar(guardado: CatalogoGuardado, base: Contexto, signal: AbortSignal) {
    const primera = semillaValida
      ? { productos: semilla!.productos, total: semilla!.total, hayMas: semilla!.hayMas }
      : await obtenerProductos({
          search: base.filtros.busqueda,
          categoria: base.filtros.categoria ?? undefined,
          unidad: base.filtros.unidad ?? undefined,
          orden: base.filtros.orden,
          page: 1,
          signal,
        }).then((d) => ({ productos: d.results, total: d.count, hayMas: Boolean(d.next) }));
    if (signal.aborted) return;

    if (primera.total !== guardado.total) {
      const desdeCero: Contexto = { ...base, pagina: 1 };
      omitir.current.add(desdeCero);
      setCtx((actual) => (actual.clave === base.clave ? desdeCero : actual));
      setProductos(primera.productos);
      setTotal(primera.total);
      setHayMas(primera.hayMas);
      scrollPendiente.current = null;
      return;
    }

    const enPrimera = new Set(primera.productos.map((p) => p.id));
    const resto = guardado.productos.filter((p) => !enPrimera.has(p.id));
    const tandas: number[][] = [];
    for (let i = 0; i < resto.length; i += IDS_POR_PETICION) {
      tandas.push(resto.slice(i, i + IDS_POR_PETICION).map((p) => p.id));
    }
    const frescos = new Map<number, Producto>();
    for (const lista of await Promise.all(tandas.map((ids) => refrescarProductos(ids, signal)))) {
      for (const p of lista) frescos.set(p.id, p);
    }
    if (signal.aborted) return;
    // Mismo orden que se guardó; el que ya no está visible en la tienda, fuera.
    setProductos([
      ...primera.productos,
      ...resto.flatMap((p) => {
        const fresco = frescos.get(p.id);
        return fresco ? [fresco] : [];
      }),
    ]);
  }

  useEffect(() => {
    if (ctx.clave !== clave) return;
    if (omitir.current.has(ctx)) return;

    // La primera pasada ya llegó pintada del servidor: no se vuelve a pedir,
    // igual que `MasVendidos` evita repetir su fetch al hidratar.
    if (semillaValida && !semillaUsada.current) {
      semillaUsada.current = true;
      return;
    }

    const controlador = new AbortController();
    const esPrimeraTanda = ctx.pagina === 1;

    if (esPrimeraTanda) setCargando(true);
    else setCargandoMas(true);
    setError(false);

    obtenerProductos({
      search: ctx.filtros.busqueda,
      categoria: ctx.filtros.categoria ?? undefined,
      unidad: ctx.filtros.unidad ?? undefined,
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

  // Devuelve el scroll de antes de recargar, ya con la lista pintada.
  useEffect(() => {
    const y = scrollPendiente.current;
    if (y === null) return;
    scrollPendiente.current = null;
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }, [productos]);

  // Guarda la lista acumulada cada vez que queda quieta. Las búsquedas no: no
  // sobreviven a la recarga (no van en la URL) y pisarían la lista guardada.
  const primeraPasada = useRef(true);
  useEffect(() => {
    if (primeraPasada.current) {
      primeraPasada.current = false;
      return;
    }
    if (ctx.clave !== clave || ctx.filtros.busqueda) return;
    if (cargando || cargandoMas || revalidando || error || productos.length === 0) return;
    guardarCatalogo({ clave, pagina: ctx.pagina, productos, total, hayMas });
  }, [ctx, clave, cargando, cargandoMas, revalidando, error, productos, total, hayMas]);

  // Y dónde iba el scroll, para volver ahí al recargar.
  useEffect(() => {
    if (busquedaAplicada) return;
    let pendiente = 0;
    const anotar = () => guardarScrollCatalogo(clave, window.scrollY);
    const alDesplazar = () => {
      window.clearTimeout(pendiente);
      pendiente = window.setTimeout(anotar, 250);
    };
    window.addEventListener("scroll", alDesplazar, { passive: true });
    window.addEventListener("pagehide", anotar);
    return () => {
      window.clearTimeout(pendiente);
      window.removeEventListener("scroll", alDesplazar);
      window.removeEventListener("pagehide", anotar);
    };
  }, [clave, busquedaAplicada]);

  // "Cargar más" solo vale sobre una lista quieta que tiene más. El botón y la
  // carga automática pueden pedirlo a la vez; sin este cerrojo cada uno sumaba
  // una página y se saltaba (o pedía una que no existe). `cargandoMas` se pone
  // aquí mismo, no en el efecto, para que el render siguiente ya lo vea.
  const puedeCargarMas = useRef(false);
  puedeCargarMas.current =
    hayMas && !cargando && !cargandoMas && !revalidando && !error && ctx.clave === clave;
  const cargarMas = useCallback(() => {
    if (!puedeCargarMas.current) return;
    puedeCargarMas.current = false;
    setCargandoMas(true);
    setCtx((actual) => ({ ...actual, pagina: actual.pagina + 1 }));
  }, []);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return {
    productos,
    total,
    cargando,
    // La revalidación cuenta como "cargando más": así `GridProductos` rearma
    // su observador al terminar y, si el cliente ya estaba al fondo, la
    // siguiente tanda se pide sola.
    cargandoMas: cargandoMas || revalidando,
    error,
    hayMas,
    cargarMas,
    reintentar,
    esperandoBusqueda: busquedaAplicada !== filtros.busqueda,
  };
}
