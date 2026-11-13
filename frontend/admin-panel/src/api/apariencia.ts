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

// ---------- La letra del nombre del negocio (sidebar) ----------
//
// La misma tabla que `tienda/src/lib/tema.ts → FUENTES_TITULO`: el backend
// dice qué clave usa la tienda para escribir el nombre (`marca_tipografia`,
// ver `apps/content/aspecto_panel.py`) y aquí se traduce a la familia y a su
// hoja de Google. «heredada» = la fuente del texto, que el panel ya tiene.
const FUENTES_MARCA: Record<string, { pila: string; familia: string }> = {
  playfair: { pila: '"Playfair Display", Georgia, "Times New Roman", serif', familia: "Playfair+Display:ital,wght@0,400..800;1,400..800" },
  cormorant: { pila: '"Cormorant Garamond", Georgia, "Times New Roman", serif', familia: "Cormorant+Garamond:ital,wght@0,500;0,700;1,500;1,700" },
  "dm-serif": { pila: '"DM Serif Display", Georgia, "Times New Roman", serif', familia: "DM+Serif+Display:ital@0;1" },
  fraunces: { pila: '"Fraunces", Georgia, "Times New Roman", serif', familia: "Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800" },
};

export interface TipografiaMarca {
  fuente: string;
  italica: boolean;
}

/** Pone `--fuente-marca` y `--fuente-marca-estilo` en la raíz y carga la hoja si hace falta. */
export function aplicarTipografiaDeMarca(t: TipografiaMarca | undefined) {
  const raiz = document.documentElement.style;
  const elegida = t ? FUENTES_MARCA[t.fuente] : undefined;
  if (!elegida) {
    raiz.removeProperty("--fuente-marca");
    raiz.setProperty("--fuente-marca-estilo", t?.italica ? "italic" : "normal");
    return;
  }
  const id = "fuente-marca-hoja";
  const href = `https://fonts.googleapis.com/css2?family=${elegida.familia}&display=swap`;
  let enlace = document.getElementById(id) as HTMLLinkElement | null;
  if (!enlace) {
    enlace = document.createElement("link");
    enlace.id = id;
    enlace.rel = "stylesheet";
    document.head.appendChild(enlace);
  }
  if (enlace.href !== href) enlace.href = href;
  raiz.setProperty("--fuente-marca", elegida.pila);
  raiz.setProperty("--fuente-marca-estilo", t!.italica ? "italic" : "normal");
}
