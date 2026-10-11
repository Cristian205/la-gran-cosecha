import type { FuenteTitulos } from "../contenido/tipos";

/** El nombre que se enseña de cada familia y la pila CSS con la que se pinta. */
export const FUENTES: Record<FuenteTitulos, { nombre: string; css: string }> = {
  sans: { nombre: "Inter Tight", css: '"Inter Tight", system-ui, sans-serif' },
  serif: { nombre: "Fraunces", css: '"Fraunces", Georgia, serif' },
  editorial: { nombre: "Instrument Serif", css: '"Instrument Serif", Georgia, serif' },
  grotesca: { nombre: "Space Grotesk", css: '"Space Grotesk", system-ui, sans-serif' },
  display: { nombre: "DM Serif Display", css: '"DM Serif Display", Georgia, serif' },
};
