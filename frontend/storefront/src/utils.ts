const formatterCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatoPrecio(valor: number | string): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return formatterCOP.format(Number.isFinite(n) ? n : 0);
}

export function telHref(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(numero: string, mensaje = ""): string {
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** Quita tildes y pasa a minúsculas para comparar texto sin importar acentos. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Misma paleta rotativa que el panel admin (frontend/admin-panel/src/pages/products/ProductsPage.tsx)
// para que una categoría se vea del mismo color en la tienda y en el panel. Con más
// tonos que categorías esperadas para que id % N no repita color entre dos categorías.
const PALETA_CATEGORIA = [
  "linear-gradient(135deg, #059669, #047857)",
  "linear-gradient(135deg, #2563eb, #1d4ed8)",
  "linear-gradient(135deg, #d97706, #b45309)",
  "linear-gradient(135deg, #db2777, #be185d)",
  "linear-gradient(135deg, #7c3aed, #6d28d9)",
  "linear-gradient(135deg, #0891b2, #0e7490)",
  "linear-gradient(135deg, #dc2626, #b91c1c)",
  "linear-gradient(135deg, #0d9488, #0f766e)",
  "linear-gradient(135deg, #65a30d, #4d7c0f)",
  "linear-gradient(135deg, #e11d48, #be123c)",
  "linear-gradient(135deg, #0284c7, #0369a1)",
  "linear-gradient(135deg, #a855f7, #9333ea)",
];

export function colorCategoria(id: number): string {
  return PALETA_CATEGORIA[id % PALETA_CATEGORIA.length];
}

/** Incremento mínimo permitido para la cantidad de un producto. */
export function pasoCantidad(permiteFraccion: boolean, tipoCantidad: string): number {
  if (!permiteFraccion) return 1;
  if (tipoCantidad === "cuarto") return 0.25;
  if (tipoCantidad === "medio") return 0.5;
  return 1;
}

/** Suma `delta` a `valor` respetando el paso permitido, sin bajar de un paso. */
export function ajustarCantidad(valor: number, delta: number, paso: number): number {
  const n = Math.round((valor + delta) / paso) * paso;
  return Math.max(paso, Number(n.toFixed(2)));
}

const FRACCIONES: Record<number, string> = { 25: "1/4", 50: "1/2", 75: "3/4" };

/**
 * Formatea una cantidad en notación de fracción legible para el cliente
 * (1.5 -> "1 1/2", 0.25 -> "1/4") en vez de decimales ("1,5") que confunden
 * en el mostrador. Los productos sin fracción siempre muestran un entero.
 */
export function formatoCantidad(valor: number, permiteFraccion: boolean): string {
  if (!permiteFraccion || !Number.isFinite(valor)) {
    return String(Math.round(valor) || 0);
  }
  const entero = Math.floor(valor + 1e-6);
  const resto = Math.round((valor - entero) * 100);
  if (resto <= 0) return String(entero);
  const frac = FRACCIONES[resto] ?? `${resto}/100`;
  return entero > 0 ? `${entero} ${frac}` : frac;
}
