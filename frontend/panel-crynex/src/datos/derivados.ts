/**
 * Lo que el panel deduce de la API, no lo que se inventa.
 *
 * El backend expone empresas, planes, permisos y suscripciones. Métricas como
 * el MRR o la lista de "requiere atención" no tienen endpoint propio, pero sí
 * son calculables con exactitud a partir de esos cuatro catálogos — y se
 * calculan aquí, en un solo sitio, para que la tarjeta del resumen y la ficha
 * de la empresa nunca digan cosas distintas.
 *
 * Lo que NO se puede deducir (consumo de almacenamiento, número de productos,
 * histórico de cambios de plan) no se estima: se marca como sin dato. Un
 * número aproximado en un panel de administración es peor que un hueco, porque
 * se toman decisiones con él.
 */
import { diasHasta } from "./formato";
import type {
  ClaveLimite,
  EstadoNegocio,
  EstadoSuscripcion,
  Negocio,
  Permiso,
  Plan,
  Suscripcion,
} from "../api/tipos";

export type Tono = "ok" | "aviso" | "malo" | "info" | "neutro";

/** Cuando una suscripción cuenta como ingreso recurrente de verdad. */
const FACTURA = new Set<EstadoSuscripcion>(["ACTIVA"]);
/** Cuando una empresa está operativa. Refleja `Tenant.esta_operativo`. */
const OPERATIVO = new Set<EstadoNegocio>(["ACTIVO", "PRUEBA"]);

export const ETIQUETA_ESTADO: Record<EstadoNegocio, string> = {
  ACTIVO: "Activa",
  PRUEBA: "En prueba",
  SUSPENDIDO: "Suspendida",
  ARCHIVADO: "Archivada",
};

export const TONO_ESTADO: Record<EstadoNegocio, Tono> = {
  ACTIVO: "ok",
  PRUEBA: "info",
  SUSPENDIDO: "malo",
  ARCHIVADO: "neutro",
};

export const ETIQUETA_SUSCRIPCION: Record<EstadoSuscripcion, string> = {
  ACTIVA: "Activa",
  PRUEBA: "En prueba",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

export const TONO_SUSCRIPCION: Record<EstadoSuscripcion, Tono> = {
  ACTIVA: "ok",
  PRUEBA: "info",
  VENCIDA: "malo",
  CANCELADA: "neutro",
};

// ---------------------------------------------------------------- métricas

export interface Metricas {
  empresas: number;
  altasEsteMes: number;
  activas: number;
  operativas: number;
  mrr: number;
  moneda: string;
  /** Empresas que facturan: el denominador honesto del ARPU. */
  facturando: number;
  arpu: number;
  sinPlan: number;
}

export function metricas(
  negocios: Negocio[],
  planes: Plan[],
  suscripciones: Suscripcion[]
): Metricas {
  const porId = new Map(planes.map((p) => [p.id, p]));
  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  let mrr = 0;
  let facturando = 0;
  for (const suscripcion of suscripciones) {
    if (!FACTURA.has(suscripcion.estado)) continue;
    const plan = porId.get(suscripcion.plan);
    if (!plan) continue;
    const precio = Number(plan.precio_mensual);
    if (!Number.isFinite(precio) || precio <= 0) continue;
    mrr += precio;
    facturando += 1;
  }

  return {
    empresas: negocios.length,
    altasEsteMes: negocios.filter((n) => new Date(n.fecha_creacion) >= inicioDeMes)
      .length,
    activas: negocios.filter((n) => n.estado === "ACTIVO").length,
    operativas: negocios.filter((n) => OPERATIVO.has(n.estado)).length,
    mrr,
    // Todos los planes comparten moneda en la práctica; se toma la del primero
    // con precio para no rotular un total con una divisa que no es.
    moneda: planes.find((p) => Number(p.precio_mensual) > 0)?.moneda ?? "COP",
    facturando,
    arpu: facturando ? Math.round(mrr / facturando) : 0,
    sinPlan: negocios.filter((n) => !n.plan).length,
  };
}

// -------------------------------------------------------------------- uso

export interface Indicador {
  clave: string;
  etiqueta: string;
  usado: number | null;
  limite: number | null;
  /** Sufijo de la unidad, cuando el número solo no se entiende. */
  unidad?: "mb";
  /** El backend todavía no mide este consumo. */
  sinDato?: boolean;
}

export function razonDe({ usado, limite }: Indicador): number | null {
  if (usado === null || limite === null || limite <= 0) return null;
  return Math.min(usado / limite, 1);
}

export function nivelDe(indicador: Indicador): Tono {
  const razon = razonDe(indicador);
  if (razon === null) return "neutro";
  if (razon >= 0.9) return "malo";
  if (razon >= 0.75) return "aviso";
  return "ok";
}

/** El límite pactado con esta empresa; si no, el de su plan. */
export function limite(
  clave: ClaveLimite,
  plan: Plan | null,
  suscripcion: Suscripcion | null
): number | null {
  const extra = suscripcion?.limites_extra ?? {};
  if (clave in extra) return extra[clave];
  if (plan && clave in (plan.limites ?? {})) return plan.limites[clave] ?? null;
  return null;
}

/**
 * El consumo de una empresa frente a sus límites.
 *
 * Usuarios y dominios se miden de verdad —el serializador los cuenta—; los
 * productos y el almacenamiento aparecen con su límite y sin consumo, porque
 * la API todavía no lo reporta y fingirlo sería mentir en la pantalla desde la
 * que se suspende a un cliente.
 */
export function usoDe(
  negocio: Negocio,
  plan: Plan | null,
  suscripcion: Suscripcion | null
): Indicador[] {
  return [
    {
      clave: "max_usuarios",
      etiqueta: "Usuarios",
      usado: negocio.usuarios,
      limite: limite("max_usuarios", plan, suscripcion),
    },
    {
      clave: "max_dominios",
      etiqueta: "Dominios",
      usado: negocio.dominios.length,
      limite: limite("max_dominios", plan, suscripcion),
    },
    {
      clave: "max_productos",
      etiqueta: "Productos",
      usado: null,
      limite: limite("max_productos", plan, suscripcion),
      sinDato: true,
    },
    {
      clave: "max_almacenamiento_mb",
      etiqueta: "Almacenamiento",
      usado: null,
      limite: limite("max_almacenamiento_mb", plan, suscripcion),
      unidad: "mb",
      sinDato: true,
    },
  ];
}

// ---------------------------------------------------------------- módulos

export interface Modulo {
  nombre: string;
  concedidos: Permiso[];
  disponibles: Permiso[];
}

/**
 * Las soluciones de Crynex que una empresa tiene contratadas.
 *
 * Un módulo no es una tabla: es el campo `modulo` con el que el catálogo de
 * permisos ya se agrupa. Una empresa lo tiene activo cuando su plan concede al
 * menos un permiso de ese módulo, que es exactamente la regla que aplica
 * `Subscription.permisos_disponibles()` en el servidor.
 */
export function modulosDe(permisos: Permiso[], plan: Plan | null): Modulo[] {
  const concedidos = new Set(plan?.permisos ?? []);
  const grupos = new Map<string, Modulo>();
  for (const permiso of permisos) {
    if (!permiso.activo) continue;
    let grupo = grupos.get(permiso.modulo);
    if (!grupo) {
      grupo = { nombre: permiso.modulo, concedidos: [], disponibles: [] };
      grupos.set(permiso.modulo, grupo);
    }
    grupo.disponibles.push(permiso);
    if (concedidos.has(permiso.codename)) grupo.concedidos.push(permiso);
  }
  return [...grupos.values()];
}

// ---------------------------------------------------------------- alertas

export type NivelAlerta = "critico" | "aviso";

export interface Alerta {
  id: string;
  nivel: NivelAlerta;
  negocioId: number;
  negocio: string;
  titulo: string;
  detalle: string;
}

/** Con cuántos días de antelación una renovación pasa a ser un aviso. */
const AVISO_RENOVACION = 15;

export function alertasDe(
  negocios: Negocio[],
  planes: Plan[],
  suscripciones: Suscripcion[]
): Alerta[] {
  const porTenant = new Map(suscripciones.map((s) => [s.tenant, s]));
  const porId = new Map(planes.map((p) => [p.id, p]));
  const alertas: Alerta[] = [];

  for (const negocio of negocios) {
    if (negocio.estado === "ARCHIVADO") continue;
    const suscripcion = porTenant.get(negocio.id) ?? null;
    const plan = suscripcion ? porId.get(suscripcion.plan) ?? null : null;
    const base = { negocioId: negocio.id, negocio: negocio.nombre };

    if (negocio.estado === "SUSPENDIDO") {
      alertas.push({
        ...base,
        id: `${negocio.id}:suspendida`,
        nivel: "critico",
        titulo: "Empresa suspendida",
        detalle: "No atiende peticiones hasta que se reactive.",
      });
    }

    if (!negocio.plan) {
      alertas.push({
        ...base,
        id: `${negocio.id}:sin-plan`,
        nivel: "aviso",
        titulo: "Sin plan asignado",
        detalle: "No tiene permisos disponibles hasta contratar uno.",
      });
    }

    if (suscripcion?.estado === "VENCIDA" || suscripcion?.estado === "CANCELADA") {
      alertas.push({
        ...base,
        id: `${negocio.id}:suscripcion`,
        nivel: "critico",
        titulo:
          suscripcion.estado === "VENCIDA"
            ? "Suscripción vencida"
            : "Suscripción cancelada",
        detalle: "Sus usuarios han perdido el acceso a los módulos del plan.",
      });
    } else if (suscripcion?.fecha_fin) {
      const dias = diasHasta(suscripcion.fecha_fin);
      if (dias !== null && dias >= 0 && dias <= AVISO_RENOVACION) {
        alertas.push({
          ...base,
          id: `${negocio.id}:renovacion`,
          nivel: dias <= 3 ? "critico" : "aviso",
          titulo: `Renovación ${dias === 0 ? "hoy" : `en ${dias} días`}`,
          detalle: `Plan ${suscripcion.plan_nombre}.`,
        });
      }
    }

    for (const indicador of usoDe(negocio, plan, suscripcion)) {
      const razon = razonDe(indicador);
      if (razon === null || razon < 0.9) continue;
      alertas.push({
        ...base,
        id: `${negocio.id}:${indicador.clave}`,
        nivel: razon >= 1 ? "critico" : "aviso",
        titulo: `${indicador.etiqueta} al ${Math.round(razon * 100)}%`,
        detalle:
          razon >= 1
            ? `Alcanzó el límite de su plan (${indicador.limite}).`
            : `${indicador.usado} de ${indicador.limite} en uso.`,
      });
    }
  }

  // Lo crítico primero: es una bandeja de trabajo, no un histórico.
  return alertas.sort((a, b) =>
    a.nivel === b.nivel
      ? a.negocio.localeCompare(b.negocio)
      : a.nivel === "critico"
        ? -1
        : 1
  );
}

// -------------------------------------------------------------- actividad

export type TipoEvento = "alta" | "suscripcion";

export interface Evento {
  id: string;
  fecha: string;
  tipo: TipoEvento;
  titulo: string;
  detalle: string;
  negocioId: number;
  negocio: string;
}

/**
 * La actividad que se puede reconstruir hoy.
 *
 * No hay tabla de auditoría todavía, así que esto no es un registro de eventos:
 * son las marcas de tiempo que los propios modelos guardan (el alta de una
 * empresa, el inicio de su suscripción). La vista lo dice para que nadie la lea
 * como un histórico completo, y el componente ya acepta la forma que tendrá el
 * registro real cuando exista.
 */
export function actividadDe(
  negocios: Negocio[],
  suscripciones: Suscripcion[],
  cuantos = 12
): Evento[] {
  const porId = new Map(negocios.map((n) => [n.id, n]));
  const eventos: Evento[] = negocios.map((negocio) => ({
    id: `alta:${negocio.id}`,
    fecha: negocio.fecha_creacion,
    tipo: "alta" as const,
    titulo: "Empresa dada de alta",
    detalle: negocio.slug,
    negocioId: negocio.id,
    negocio: negocio.nombre,
  }));

  for (const suscripcion of suscripciones) {
    const negocio = porId.get(suscripcion.tenant);
    if (!negocio) continue;
    eventos.push({
      id: `sus:${suscripcion.id}`,
      // `fecha_inicio` es una fecha sin hora; se ancla al día para ordenar.
      fecha: `${suscripcion.fecha_inicio}T00:00:00`,
      tipo: "suscripcion",
      titulo: "Suscripción iniciada",
      detalle: `Plan ${suscripcion.plan_nombre}`,
      negocioId: negocio.id,
      negocio: negocio.nombre,
    });
  }

  return eventos
    .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha))
    .slice(0, cuantos);
}
