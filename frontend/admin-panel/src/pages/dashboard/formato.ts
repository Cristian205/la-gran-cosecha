/**
 * Formato de cifras y variaciones del dashboard.
 *
 * La variación es honesta por diseño: un «−100 %» en rojo cuando hoy aún no se
 * ha vendido nada alarma sin informar. Por eso los casos sin base se dicen con
 * palabras y en tono neutro, y el porcentaje solo aparece cuando hay dos
 * números que comparar. La diferencia absoluta acompaña siempre al %.
 */
import { formatoPrecio } from "../../utils";

export const numero = (n: number) => Math.round(n).toLocaleString("es-CO");

const COMPACTO = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 1,
});

/** "$ 1,2 M" para ejes y espacios estrechos. */
export const precioCompacto = (n: number) => COMPACTO.format(n).replace(/\s/g, " ");

export const porcentaje = (n: number, decimales = 1) =>
  `${n.toLocaleString("es-CO", { maximumFractionDigits: decimales, minimumFractionDigits: 0 })} %`;

/** Cantidades comerciales: hasta dos decimales (0,5 kg), sin ceros de relleno. */
export const cantidad = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

export { formatoPrecio };

export type Variacion =
  | { tipo: "sube" | "baja" | "igual"; porcentaje: string | null; diferencia: string }
  | { tipo: "neutra"; texto: string };

const UMBRAL_IGUAL = 0.5;

/**
 * Cómo cambió `actual` frente a `anterior`. `null` si no se pidió comparar
 * (`anterior` indefinido o nulo cuando el período no tiene base).
 */
export function variacion(
  actual: number | null,
  anterior: number | null | undefined,
  formatear: (n: number) => string = numero
): Variacion | null {
  if (anterior === undefined) return null;
  if (actual === null && anterior === null) return { tipo: "neutra", texto: "Sin datos en ninguno de los dos períodos" };
  if (actual === null) return { tipo: "neutra", texto: `Período anterior: ${formatear(anterior!)}` };
  if (anterior === null) return { tipo: "neutra", texto: "Sin datos del período anterior" };
  if (actual === 0 && anterior === 0) return { tipo: "neutra", texto: "Sin movimiento en ninguno de los dos períodos" };

  const dif = actual - anterior;
  const diferencia = `${dif > 0 ? "+" : dif < 0 ? "−" : ""}${formatear(Math.abs(dif))}`;
  if (anterior === 0) return { tipo: "sube", porcentaje: null, diferencia };
  const pct = (dif / anterior) * 100;
  if (Math.abs(pct) < UMBRAL_IGUAL) return { tipo: "igual", porcentaje: "0 %", diferencia };
  const abs = Math.abs(pct);
  const texto = abs >= 100 ? `${Math.round(abs).toLocaleString("es-CO")} %` : porcentaje(abs);
  return { tipo: dif > 0 ? "sube" : "baja", porcentaje: texto, diferencia };
}

export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
