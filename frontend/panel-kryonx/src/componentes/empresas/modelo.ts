/**
 * Una empresa vista como WORKSPACE: la única entidad de la que leen la tabla y
 * las tarjetas.
 *
 * No es otra fuente de datos: se calcula a partir de lo que el panel ya tiene
 * cargado (empresas, planes, suscripciones, permisos y alertas). Las dos vistas
 * reciben exactamente la misma lista, filtrada y ordenada aquí, así que no
 * pueden contar cosas distintas sobre la misma empresa.
 */
import { useMemo } from "react";
import type { EstadoNegocio, Negocio, Suscripcion } from "../../api/tipos";
import {
  alertasDe,
  modulosDe,
  razonDe,
  usoDe,
  type Alerta,
  type Indicador,
  type Salud,
} from "../../datos/derivados";
import { usarPlataforma } from "../../datos/plataforma";

export interface Empresa {
  negocio: Negocio;
  suscripcion: Suscripcion | null;
  /** El indicador de usuarios (usados / límite). */
  usuarios: Indicador;
  /** El indicador que más aprieta: decide la columna de uso. */
  tenso: Indicador;
  /** Módulos con al menos un permiso concedido. */
  modulos: number;
  salud: Salud;
  /** La alerta más grave, para explicar la salud ("Dominios al 100%"). */
  alerta: Alerta | null;
  /** Lo mismo que antes marcaba la fila para el filtro "requieren atención". */
  atencion: boolean;
}

/** En qué tramo de consumo está, para el filtro de uso. */
export type NivelUso = "sin" | "normal" | "alto" | "limite";

export function nivelUso(empresa: Empresa): NivelUso {
  const razon = razonDe(empresa.tenso);
  if (razon === null) return "sin";
  if (razon >= 1) return "limite";
  if (razon >= 0.75) return "alto";
  return "normal";
}

export function usarEmpresas(negocios: Negocio[]): Empresa[] {
  const { planes, permisos, suscripciones, suscripcionDe, planDe } = usarPlataforma();

  return useMemo(() => {
    const alertas = alertasDe(negocios, planes, suscripciones);
    // `alertasDe` ya viene con lo crítico primero: la primera de cada empresa
    // es la peor.
    const peor = new Map<number, Alerta>();
    for (const a of alertas) if (!peor.has(a.negocioId)) peor.set(a.negocioId, a);

    return negocios.map((negocio) => {
      const suscripcion = suscripcionDe(negocio.id);
      const plan = planDe(negocio);
      const indicadores = usoDe(negocio, plan, suscripcion);
      const tenso = indicadores.reduce<Indicador>(
        (max, i) => ((razonDe(i) ?? -1) > (razonDe(max) ?? -1) ? i : max),
        indicadores[0]
      );
      const alerta = peor.get(negocio.id) ?? null;
      return {
        negocio,
        suscripcion,
        usuarios: indicadores[0],
        tenso,
        modulos: modulosDe(permisos, plan).filter((m) => m.concedidos.length > 0).length,
        salud: !alerta ? "ok" : alerta.nivel === "critico" ? "malo" : "aviso",
        alerta,
        atencion:
          negocio.estado === "SUSPENDIDO" ||
          !negocio.plan ||
          suscripcion?.estado === "VENCIDA" ||
          suscripcion?.estado === "CANCELADA" ||
          (razonDe(tenso) ?? 0) >= 0.9,
      };
    });
  }, [negocios, planes, permisos, suscripciones, suscripcionDe, planDe]);
}

// ---------------------------------------------------------------- filtros

export interface FiltrosEmpresas {
  texto: string;
  estado: EstadoNegocio | "";
  plan: string;
  salud: Salud | "";
  uso: NivelUso | "";
  modulos: "" | "con" | "sin";
}

export const FILTROS_VACIOS: FiltrosEmpresas = {
  texto: "",
  estado: "",
  plan: "",
  salud: "",
  uso: "",
  modulos: "",
};

/** Cuántos de los filtros de "Más filtros" están puestos. */
export function filtrosExtraActivos(f: FiltrosEmpresas): number {
  return [f.salud, f.uso, f.modulos].filter(Boolean).length;
}

export function hayFiltros(f: FiltrosEmpresas): boolean {
  return Object.values(f).some(Boolean);
}

export function filtrarEmpresas(
  lista: Empresa[],
  f: FiltrosEmpresas,
  soloAtencion: boolean
): Empresa[] {
  const busqueda = f.texto.trim().toLowerCase();
  return lista.filter((e) => {
    const { negocio } = e;
    if (soloAtencion && !e.atencion) return false;
    if (f.estado && negocio.estado !== f.estado) return false;
    if (f.plan && negocio.plan?.slug !== f.plan) return false;
    if (f.salud && e.salud !== f.salud) return false;
    if (f.uso && nivelUso(e) !== f.uso) return false;
    if (f.modulos === "con" && e.modulos === 0) return false;
    if (f.modulos === "sin" && e.modulos > 0) return false;
    if (!busqueda) return true;
    return (
      negocio.nombre.toLowerCase().includes(busqueda) ||
      negocio.slug.toLowerCase().includes(busqueda) ||
      negocio.dominios.some((d) => d.includes(busqueda))
    );
  });
}

// ------------------------------------------------------------------ orden

export type Columna = "nombre" | "estado" | "plan" | "usuarios" | "renovacion";
export interface Orden {
  columna: Columna;
  sentido: "asc" | "desc";
}

export function ordenarEmpresas(lista: Empresa[], orden: Orden): Empresa[] {
  const signo = orden.sentido === "asc" ? 1 : -1;
  return [...lista].sort((a, b) => {
    switch (orden.columna) {
      case "estado":
        return signo * a.negocio.estado.localeCompare(b.negocio.estado);
      case "plan":
        return signo * (a.negocio.plan?.nombre ?? "").localeCompare(b.negocio.plan?.nombre ?? "");
      case "usuarios":
        return signo * (a.negocio.usuarios - b.negocio.usuarios);
      case "renovacion":
        return (
          signo *
          (a.suscripcion?.fecha_fin ?? "9999").localeCompare(b.suscripcion?.fecha_fin ?? "9999")
        );
      default:
        return signo * a.negocio.nombre.localeCompare(b.negocio.nombre);
    }
  });
}

// ------------------------------------------------------------- resolución

/**
 * A dónde lleva "Resolver" según el problema. Solo destinos que existen: las
 * pestañas de la ficha de la empresa. Una empresa suspendida no se resuelve
 * navegando sino reactivándola, y eso lo decide quien llama.
 */
export function destinoDeAlerta(alerta: Alerta): string | null {
  const base = `/empresas/${alerta.negocioId}`;
  switch (alerta.tipo) {
    case "uso":
      if (alerta.id.endsWith(":max_dominios")) return `${base}/dominios`;
      if (alerta.id.endsWith(":max_usuarios")) return `${base}/usuarios`;
      return `${base}/uso`;
    case "sin-plan":
    case "suscripcion":
    case "renovacion":
      return `${base}/suscripcion`;
    default:
      return null;
  }
}
