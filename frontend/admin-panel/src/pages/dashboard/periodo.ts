/**
 * Los períodos del dashboard y cómo se nombran.
 *
 * Las fechas son LOCALES: `toISOString()` da la fecha en UTC, y en Colombia
 * (UTC−5) desde las 7 de la noche "hoy" pasaba a ser mañana — el dashboard
 * pedía un día que todavía no había empezado.
 */
import type { Granularidad, PeriodoRespuesta } from "./tipos";

export type Preset = "hoy" | "7d" | "30d" | "mes" | "mes_anterior" | "anio" | "personalizado";

export interface Rango {
  desde: string;
  hasta: string;
}

export const OPCIONES_PRESET: { valor: Preset; etiqueta: string; corta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy", corta: "Hoy" },
  { valor: "7d", etiqueta: "Últimos 7 días", corta: "7 días" },
  { valor: "30d", etiqueta: "Últimos 30 días", corta: "30 días" },
  { valor: "mes", etiqueta: "Este mes", corta: "Este mes" },
  { valor: "mes_anterior", etiqueta: "Mes anterior", corta: "Mes ant." },
  { valor: "anio", etiqueta: "Este año", corta: "Este año" },
  { valor: "personalizado", etiqueta: "Personalizado", corta: "Personalizado" },
];

/** El backend no acepta más de un año (366 días incluidos). */
export const MAX_DIAS = 366;

export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-24" (o "2026-09-24T13:00…") → Date local, no UTC. */
export function aFecha(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const hora = iso.length > 10 ? Number(iso.slice(11, 13)) : 0;
  return new Date(a, m - 1, d, hora);
}

export function diasDe({ desde, hasta }: Rango): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000) + 1;
}

export function rangoDesdePreset(preset: Exclude<Preset, "personalizado">, hoy = new Date()): Rango {
  const hasta = fechaLocal(hoy);
  const menos = (dias: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - dias);
    return fechaLocal(d);
  };
  switch (preset) {
    case "hoy":
      return { desde: hasta, hasta };
    case "7d":
      return { desde: menos(6), hasta };
    case "mes":
      return { desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta };
    case "mes_anterior":
      return {
        desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        // Día 0 del mes actual = último día del anterior.
        hasta: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      };
    case "anio":
      return { desde: fechaLocal(new Date(hoy.getFullYear(), 0, 1)), hasta };
    default:
      return { desde: menos(29), hasta };
  }
}

const CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
const CORTA_ANIO = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

/** "24 sep" (sin el punto que añade es-CO: "sept."). */
export function fechaCorta(iso: string, conAnio = false): string {
  return (conAnio ? CORTA_ANIO : CORTA).format(aFecha(iso)).replace(/\./g, "");
}

export function rangoLegible({ desde, hasta }: Rango): string {
  const otroAnio = aFecha(desde).getFullYear() !== new Date().getFullYear();
  if (desde === hasta) return fechaCorta(desde, otroAnio);
  return `${fechaCorta(desde, otroAnio)} – ${fechaCorta(hasta, otroAnio)}`;
}

/**
 * Contra qué se compara, como lo diría una persona: "vs. ayer hasta las
 * 10:00", "vs. 4 – 10 nov". Sale del período que DEVOLVIÓ el backend, así que
 * nunca contradice lo que se calculó.
 */
export function referenciaAnterior(periodo: PeriodoRespuesta): string | null {
  const a = periodo.anterior;
  if (!a) return null;
  const hora = a.hasta_hora ? ` hasta las ${a.hasta_hora}` : "";
  if (periodo.dias === 1) {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    return a.desde === fechaLocal(ayer) ? `vs. ayer${hora}` : `vs. ${fechaCorta(a.desde)}${hora}`;
  }
  return `vs. ${rangoLegible(a)}${hora}`;
}

/** El título de un punto de la serie según su grano. */
export function etiquetaDeCubeta(inicio: string, granularidad: Granularidad): string {
  const fecha = aFecha(inicio);
  if (granularidad === "hora") return `${inicio.slice(11, 13)}:00 – ${inicio.slice(11, 13)}:59`;
  if (granularidad === "semana") return `Semana del ${fechaCorta(inicio)}`;
  if (granularidad === "mes") {
    const t = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(fecha);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const t = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short" })
    .format(fecha)
    .replace(/\./g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** La etiqueta corta del eje X. */
export function etiquetaDeEje(inicio: string, granularidad: Granularidad): string {
  if (granularidad === "hora") return `${inicio.slice(11, 13)}h`;
  if (granularidad === "mes")
    return new Intl.DateTimeFormat("es-CO", { month: "short" }).format(aFecha(inicio)).replace(/\./g, "");
  return fechaCorta(inicio);
}

export const NOMBRE_GRANO: Record<Granularidad, string> = {
  hora: "por hora",
  dia: "por día",
  semana: "por semana",
  mes: "por mes",
};
