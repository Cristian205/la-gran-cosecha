/**
 * Las opciones de fuente y forma de botón que un negocio puede elegir para su
 * tienda — compartidas porque el panel administrativo también las escucha
 * (ver AuthContext): la identidad de un negocio es una sola, y adoptar una
 * plantilla ya las trae puestas para los dos lugares a la vez.
 */
export interface OpcionFuente {
  valor: string;
  etiqueta: string;
  pila: string;
}

export const FUENTES: OpcionFuente[] = [
  { valor: "poppins", etiqueta: "Poppins", pila: '"Poppins", sans-serif' },
  { valor: "inter", etiqueta: "Inter", pila: '"Inter", sans-serif' },
  { valor: "nunito", etiqueta: "Nunito", pila: '"Nunito", sans-serif' },
  { valor: "work-sans", etiqueta: "Work Sans", pila: '"Work Sans", sans-serif' },
  { valor: "jakarta", etiqueta: "Plus Jakarta Sans", pila: '"Plus Jakarta Sans", sans-serif' },
  { valor: "quicksand", etiqueta: "Quicksand", pila: '"Quicksand", sans-serif' },
];

export interface OpcionRadio {
  valor: string;
  etiqueta: string;
  px: number;
}

export const RADIOS_BOTON: OpcionRadio[] = [
  { valor: "redondeado", etiqueta: "Redondeado", px: 999 },
  { valor: "suave", etiqueta: "Suave", px: 14 },
  { valor: "cuadrado", etiqueta: "Cuadrado", px: 6 },
];

export function pilaFuente(valor: string): string {
  return FUENTES.find((f) => f.valor === valor)?.pila ?? FUENTES[0].pila;
}

export function radioPx(valor: string): number {
  return RADIOS_BOTON.find((r) => r.valor === valor)?.px ?? 999;
}
