/**
 * Los períodos del dashboard y cómo se nombran.
 *
 * Las fechas son LOCALES: `toISOString()` da la fecha en UTC, y en Colombia
 * (UTC−5) desde las 7 de la noche "hoy" pasaba a ser mañana — el dashboard
 * pedía un día que todavía no había empezado.
 */
export type Preset = "hoy" | "7d" | "30d" | "mes" | "personalizado";

export interface Rango {
  desde: string;
  hasta: string;
}

export const OPCIONES_PRESET: { valor: Preset; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "7d", etiqueta: "7 días" },
  { valor: "30d", etiqueta: "30 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-24" → Date a medianoche local (no UTC). */
export function aFecha(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const hora = iso.length > 10 ? Number(iso.slice(11, 13)) : 0;
  return new Date(a, m - 1, d, hora);
}

export function rangoDesdePreset(preset: Exclude<Preset, "personalizado">, hoy = new Date()): Rango {
  const hasta = fechaLocal(hoy);
  const menos = (dias: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - dias);
    return fechaLocal(d);
  };
  if (preset === "hoy") return { desde: hasta, hasta };
  if (preset === "7d") return { desde: menos(6), hasta };
  if (preset === "mes") return { desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta };
  return { desde: menos(29), hasta };
}

const CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

/** "24 sep" (sin el punto que añade es-CO: "sept."). */
export function fechaCorta(iso: string): string {
  return CORTA.format(aFecha(iso)).replace(".", "");
}

export function rangoLegible({ desde, hasta }: Rango): string {
  return desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
}

/** Con qué se compara el período, dicho como lo diría una persona. */
export function etiquetaComparacion(preset: Preset): string {
  if (preset === "hoy") return "vs. ayer";
  if (preset === "7d") return "vs. 7 días anteriores";
  if (preset === "30d") return "vs. 30 días anteriores";
  return "vs. período anterior";
}

/** El título de un punto de la serie según su grano. */
export function etiquetaDeCubeta(inicio: string, granularidad: "hora" | "dia" | "semana"): string {
  if (granularidad === "hora") return `${inicio.slice(11, 13)}:00`;
  if (granularidad === "semana") return `Semana del ${fechaCorta(inicio)}`;
  return new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" })
    .format(aFecha(inicio))
    .replace(/\./g, "");
}

export function saludo(hora = new Date().getHours()): string {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
