"use client";

import { Check } from "lucide-react";

export type Paso = "identificacion" | "datos" | "pedido" | "confirmar";

export const NOMBRE_PASO: Record<Paso, string> = {
  identificacion: "Identificación",
  datos: "Tus datos",
  pedido: "Tu pedido",
  confirmar: "Confirmar",
};

interface Props {
  pasos: Paso[];
  actual: Paso;
  /** Hasta qué paso (índice) se llegó: a esos se puede volver con un clic. */
  alcanzado: number;
  onIr: (paso: Paso) => void;
}

/**
 * Dónde estoy y cuánto falta: los pasos numerados, el actual resaltado y los
 * ya hechos con ✓. Un paso ya hecho se puede volver a abrir con un clic (para
 * corregir la dirección o una cantidad sin rehacer todo); uno al que todavía
 * no se llegó no, porque depende de los anteriores.
 */
export function PasosCheckout({ pasos, actual, alcanzado, onIr }: Props) {
  const indiceActual = pasos.indexOf(actual);
  return (
    <ol className="chk-pasos" aria-label="Pasos para enviar tu pedido">
      {pasos.map((p, i) => {
        const hecho = i < indiceActual;
        const esActual = i === indiceActual;
        const disponible = i <= alcanzado && !esActual;
        const estado = esActual ? "actual" : hecho ? "hecho" : i <= alcanzado ? "visitado" : "pendiente";
        return (
          <li key={p} className="chk-paso" data-estado={estado}>
            <button
              type="button"
              className="chk-paso-btn"
              onClick={() => onIr(p)}
              disabled={!disponible}
              aria-current={esActual ? "step" : undefined}
            >
              <span className="chk-paso-num" aria-hidden="true">
                {hecho ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className="chk-paso-nombre">{NOMBRE_PASO[p]}</span>
              <span className="sr-only">
                {esActual ? " (paso actual)" : hecho ? " (hecho)" : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
