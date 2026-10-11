/**
 * Qué es una marca para el Control Center.
 *
 * Todo lo que distingue a Kryon X de cualquier otra marca que use esta misma
 * base cabe aquí: nombre, logo, tres colores, una tipografía y una redondez.
 * Ningún componente conoce estos valores; el motor los convierte en tokens CSS
 * y el resto de la interfaz solo lee tokens.
 */

export const TIPOGRAFIAS = ["Inter", "Geist", "Manrope", "DM Sans", "IBM Plex Sans"] as const;
export type Tipografia = (typeof TIPOGRAFIAS)[number];

export type Redondez = "recta" | "media" | "suave";

export interface ColoresMarca {
  /** La firma: acción principal, selección, foco. */
  primario: string;
  /** El color del texto de marca sobre fondos oscuros. */
  secundario: string;
  /** El contrapunto: detalles, nunca estados. */
  acento: string;
}

export interface Marca {
  id: string;
  nombre: string;
  /** Lo que acompaña al nombre en el selector: «Control Center». */
  lema: string;
  /** URL o data URL del monograma. Sin logo se dibujan las iniciales. */
  logo: string | null;
  favicon: string | null;
  colores: ColoresMarca;
  tipografia: Tipografia;
  redondez: Redondez;
  /** Kryon X escribe su nombre con el degradado metálico del logotipo. */
  logotipoMetalico?: boolean;
  /** La marca de la plataforma: no se puede borrar. */
  sistema?: boolean;
}
