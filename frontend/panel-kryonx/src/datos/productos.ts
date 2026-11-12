/**
 * Producto ↔ empresa, deducido de lo que ya existe.
 *
 * La plataforma no guarda «esta empresa contrató este producto»: una empresa
 * tiene UN plan y unos permisos extra o excluidos, y los productos son los
 * grupos de permisos (`Permiso.producto`). Este archivo hace ese cruce en un
 * solo lugar para que la ficha del producto y la de la empresa digan lo mismo.
 *
 * Nada de esto se persiste ni se inventa: es una lectura. Cuando exista una
 * asignación explícita (ver `docs/PRODUCTOS-Y-EMPRESAS.md`), esta función es
 * la que cambia; las pantallas que la consumen, no.
 */
import type { Negocio, Permiso, Plan, Producto, Suscripcion } from "../api/tipos";

const ESTADOS_VIGENTES = ["PRUEBA", "ACTIVA"];

/** Los codenames que una empresa tiene concedidos hoy (plan + extra − excluidos). */
export function concedidosDe(plan: Plan | null, suscripcion: Suscripcion | null | undefined): Set<string> {
  const excluidos = new Set(suscripcion?.permisos_excluidos ?? []);
  return new Set(
    [...(plan?.permisos ?? []), ...(suscripcion?.permisos_extra ?? [])].filter((c) => !excluidos.has(c))
  );
}

/** Cómo tiene una empresa un producto. */
export type CoberturaProducto = "completo" | "parcial" | "ninguno";

export interface ProductoEnEmpresa {
  negocio: Negocio;
  plan: Plan | null;
  suscripcion: Suscripcion | null;
  /** Permisos activos del producto que la empresa tiene concedidos. */
  concedidos: number;
  /** Permisos activos que tiene el producto. */
  total: number;
  /** De los concedidos, cuántos vienen del plan; el resto son extras de la empresa. */
  delPlan: number;
  cobertura: CoberturaProducto;
  /** Si su suscripción conserva hoy lo que concede (en prueba o activa). */
  vigente: boolean;
}

/** Los permisos activos de un producto. */
export function permisosDeProducto(producto: Producto, permisos: Permiso[]): Permiso[] {
  return permisos.filter((p) => p.producto === producto.id && p.activo);
}

/** Cómo está un producto en UNA empresa. */
export function productoEnEmpresa(
  producto: Producto,
  permisos: Permiso[],
  negocio: Negocio,
  plan: Plan | null,
  suscripcion: Suscripcion | null
): ProductoEnEmpresa {
  const propios = permisosDeProducto(producto, permisos);
  const concedidos = concedidosDe(plan, suscripcion);
  const delPlanSet = new Set(plan?.permisos ?? []);
  const tiene = propios.filter((p) => concedidos.has(p.codename));
  const delPlan = tiene.filter((p) => delPlanSet.has(p.codename)).length;
  return {
    negocio,
    plan,
    suscripcion,
    concedidos: tiene.length,
    total: propios.length,
    delPlan,
    cobertura: tiene.length === 0 ? "ninguno" : tiene.length === propios.length ? "completo" : "parcial",
    vigente: suscripcion ? ESTADOS_VIGENTES.includes(suscripcion.estado) : false,
  };
}

/** Las empresas que tienen algo de un producto, de la más completa a la menos. */
export function empresasDeProducto(
  producto: Producto,
  permisos: Permiso[],
  negocios: Negocio[],
  planes: Plan[],
  suscripciones: Suscripcion[]
): ProductoEnEmpresa[] {
  const porNegocio = new Map(suscripciones.map((s) => [s.tenant, s]));
  const porSlug = new Map(planes.map((p) => [p.slug, p]));
  return negocios
    .map((n) =>
      productoEnEmpresa(producto, permisos, n, n.plan ? (porSlug.get(n.plan.slug) ?? null) : null, porNegocio.get(n.id) ?? null)
    )
    .filter((e) => e.concedidos > 0)
    .sort((a, b) => b.concedidos / (b.total || 1) - a.concedidos / (a.total || 1) || a.negocio.nombre.localeCompare(b.negocio.nombre));
}

/** Los planes que conceden algún permiso del producto. */
export function planesDeProducto(producto: Producto, planes: Plan[]): Plan[] {
  return planes.filter((p) => p.productos.some((x) => x.id === producto.id));
}

/** Cuántas empresas tienen cada producto, en una pasada (para la lista). */
export function empresasPorProducto(
  productos: Producto[],
  permisos: Permiso[],
  negocios: Negocio[],
  planes: Plan[],
  suscripciones: Suscripcion[]
): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const p of productos) {
    resultado.set(p.id, empresasDeProducto(p, permisos, negocios, planes, suscripciones).length);
  }
  return resultado;
}

/**
 * Los nuevos `permisos_extra` y `permisos_excluidos` de una suscripción al
 * encender o apagar un conjunto de permisos (por ejemplo, todos los de un
 * producto). Es la misma regla que ya aplica la pestaña Módulos: encender
 * quita de excluidos y, si el plan no lo da, lo añade a extras; apagar quita
 * de extras y, si el plan lo da, lo añade a excluidos. Solo toca a ESA empresa:
 * ni el producto ni el plan cambian.
 */
export function cambiosDePermisos(
  plan: Plan | null,
  suscripcion: Suscripcion,
  codenames: string[],
  activar: boolean
): { permisos_extra: string[]; permisos_excluidos: string[] } {
  const delPlan = new Set(plan?.permisos ?? []);
  let extra = [...(suscripcion.permisos_extra ?? [])];
  let excluidos = [...(suscripcion.permisos_excluidos ?? [])];
  for (const c of codenames) {
    if (activar) {
      excluidos = excluidos.filter((x) => x !== c);
      if (!delPlan.has(c) && !extra.includes(c)) extra.push(c);
    } else {
      extra = extra.filter((x) => x !== c);
      if (delPlan.has(c) && !excluidos.includes(c)) excluidos.push(c);
    }
  }
  return { permisos_extra: extra, permisos_excluidos: excluidos };
}

export const ETIQUETA_ESTADO_PRODUCTO = {
  ACTIVO: "Publicado",
  BORRADOR: "Borrador",
  ARCHIVADO: "Archivado",
} as const;

export const TONO_ESTADO_PRODUCTO = {
  ACTIVO: "ok",
  BORRADOR: "aviso",
  ARCHIVADO: "neutro",
} as const;
