/**
 * Las cuatro necesidades con las que alguien llega a /contacto.
 *
 * Cada una tiene su enlace (`#cotizar`, `#buscar-producto`…) para que
 * cualquier botón de la página —o de otra página: `/contacto#cotizar`— abra
 * directamente su camino en el selector, sin que los bloques se conozcan
 * entre sí. Quien escucha esos enlaces es `ContactIntentSelector`.
 */
export type Intencion = "pedido" | "cotizacion" | "producto" | "hablar";

export const ENLACE_DE: Record<Intencion, string> = {
  pedido: "#hacer-pedido",
  cotizacion: "#cotizar",
  producto: "#buscar-producto",
  hablar: "#hablar",
};

export function intencionDelEnlace(hash: string): Intencion | null {
  const limpio = hash.startsWith("#") ? hash : `#${hash}`;
  const par = Object.entries(ENLACE_DE).find(([, enlace]) => enlace === limpio);
  return par ? (par[0] as Intencion) : null;
}

/** El `motivo` con el que el backend clasifica la solicitud. */
export const MOTIVO_DE: Record<Intencion, string> = {
  pedido: "PEDIDO",
  cotizacion: "COTIZACION",
  producto: "PRODUCTO_ESPECIAL",
  hablar: "CONSULTA",
};
