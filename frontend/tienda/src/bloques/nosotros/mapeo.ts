"use client";

import { useTransform, type MotionValue } from "motion/react";

/**
 * Mapeos del progreso de scroll a estilos, calculados en JavaScript.
 *
 * Existen por un detalle de Motion: `useTransform(valor, [a, b], [x, y])` con
 * `opacity` o `clip-path` se "acelera" con la línea de tiempo nativa del
 * navegador, y dentro de un escenario `position: sticky` esa línea se queda
 * congelada en su primer valor — la ventana del manifiesto nunca se abría y
 * su texto nunca aparecía. La forma con función no se acelera: se recalcula
 * en cada frame y funciona igual dentro o fuera de un sticky.
 */
const limitar = (v: number) => Math.min(1, Math.max(0, v));
const mezclar = (a: number, b: number, t: number) => a + (b - a) * t;

function tramo(v: number, [desde, hasta]: [number, number]) {
  return hasta === desde ? (v >= hasta ? 1 : 0) : limitar((v - desde) / (hasta - desde));
}

/** Un número entre `valores[0]` y `valores[1]` mientras el progreso recorre `rango`. */
export function useRango(progreso: MotionValue<number>, rango: [number, number], valores: [number, number]) {
  return useTransform(progreso, (v) => mezclar(valores[0], valores[1], tramo(v, rango)));
}

/**
 * Una ventana `inset(... round ...)` que se abre de `margen` (en % por lado:
 * vertical, horizontal) a pantalla completa, y su radio de `radio` a 0.
 */
export function useVentana(
  progreso: MotionValue<number>,
  rango: [number, number],
  margen: [number, number],
  radio: number
) {
  return useTransform(progreso, (v) => {
    const t = 1 - tramo(v, rango);
    const y = (margen[0] * t).toFixed(2);
    const x = (margen[1] * t).toFixed(2);
    return `inset(${y}% ${x}% ${y}% ${x}% round ${(radio * t).toFixed(1)}px)`;
  });
}
