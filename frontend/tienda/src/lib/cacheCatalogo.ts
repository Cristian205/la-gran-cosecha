/**
 * La caché del catálogo en el navegador.
 *
 * Sin ella, cada recarga de /tienda volvía a la primera tanda: quien había
 * bajado hasta el producto 150 tenía que volver a bajar —y la tienda volvía a
 * pedir al backend, una por una, las mismas siete tandas—. Aquí se guarda la
 * lista acumulada del ÚLTIMO filtro visto y dónde iba el scroll; al recargar,
 * `useCatalogo` la pinta de inmediato y la revalida en segundo plano (ver
 * `revalidar` en el hook), de modo que un precio o una foto cambiados en el
 * panel sí llegan, sin volver a paginar desde cero.
 *
 * Es categoría funcional (ver `lib/legal/cookies.ts`): sin ese permiso no se
 * guarda nada y la tienda se comporta como antes.
 */
import { almacenamientoFuncional } from "@/lib/legal/cookies";
import type { Producto } from "@/lib/tipos";

export const CLAVE_CACHE_CATALOGO = "kryonx-catalogo";

/** Sube si cambia la forma de lo guardado: lo viejo se descarta solo. */
const VERSION = 1;

/** Pasado esto, la lista guardada no se usa: se empieza de cero. */
const VIGENCIA_MS = 12 * 60 * 60 * 1000;

export interface CatalogoGuardado {
  v: number;
  /** Identidad del filtro (`claveDe` en el hook). */
  clave: string;
  pagina: number;
  productos: Producto[];
  total: number | null;
  hayMas: boolean;
  guardado: number;
  /** Posición vertical de la página al salir. */
  scroll?: number;
}

function leer(): CatalogoGuardado | null {
  try {
    const crudo = almacenamientoFuncional.getItem(CLAVE_CACHE_CATALOGO);
    if (typeof crudo !== "string") return null;
    const dato = JSON.parse(crudo) as CatalogoGuardado;
    if (dato?.v !== VERSION || !Array.isArray(dato.productos)) return null;
    if (Date.now() - dato.guardado > VIGENCIA_MS) return null;
    return dato;
  } catch {
    return null;
  }
}

/** La lista guardada para ESTE filtro, o null. */
export function leerCatalogo(clave: string): CatalogoGuardado | null {
  const dato = leer();
  return dato && dato.clave === clave && dato.productos.length > 0 ? dato : null;
}

export function guardarCatalogo(dato: Omit<CatalogoGuardado, "v" | "guardado" | "scroll">): void {
  const previo = leer();
  const completo: CatalogoGuardado = {
    ...dato,
    v: VERSION,
    guardado: Date.now(),
    // El scroll solo se conserva si sigue siendo la misma lista.
    scroll: previo?.clave === dato.clave ? previo.scroll : undefined,
  };
  try {
    void almacenamientoFuncional.setItem(CLAVE_CACHE_CATALOGO, JSON.stringify(completo));
  } catch {
    // Lleno o bloqueado: la tienda sigue sin caché.
  }
}

export function guardarScrollCatalogo(clave: string, scroll: number): void {
  const previo = leer();
  if (!previo || previo.clave !== clave) return;
  try {
    void almacenamientoFuncional.setItem(
      CLAVE_CACHE_CATALOGO,
      JSON.stringify({ ...previo, scroll: Math.round(scroll) })
    );
  } catch {
    // Igual que arriba.
  }
}

export function borrarCatalogo(): void {
  void almacenamientoFuncional.removeItem(CLAVE_CACHE_CATALOGO);
}

/**
 * ¿Esta carga es una recarga (o un "atrás" que rehízo la página)? Solo ahí se
 * devuelve el scroll: quien entra a /tienda desde un enlace espera empezar
 * arriba, aunque la lista ya esté guardada.
 */
export function esRecarga(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "reload" || nav?.type === "back_forward";
  } catch {
    return false;
  }
}
