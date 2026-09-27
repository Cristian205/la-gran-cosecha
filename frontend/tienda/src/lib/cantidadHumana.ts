/**
 * Cantidades dichas como las diría una persona en el mercado.
 *
 *   0.25 caja   → "1/4 de caja"
 *   0.5  caja   → "1/2 caja"
 *   0.75 caja   → "3/4 de caja"
 *   1    libra  → "1 libra"
 *   1.5  caja   → "1 caja y 1/2"
 *   2    bulto  → "2 bultos"
 *
 * Es lo que muestra el carrito como confirmación del pedido: quien lo abre
 * dos segundos tiene que saber qué pidió sin traducir "1,5" ni leer
 * "1 cajas". El control − 1 + sigue trabajando con el número; esto es solo
 * la lectura.
 *
 * Genérico a propósito: la unidad llega del catálogo de cada negocio
 * (libra, canastilla, racimo, "caja x 20"…), así que no hay listas de
 * palabras escritas aquí, sino las reglas del plural en español.
 */

const FRACCION: Record<number, string> = { 25: "1/4", 50: "1/2", 75: "3/4" };

/**
 * "caja" → "cajas", "unidad" → "unidades", "lápiz" → "lápices".
 * Las abreviaturas ("kg", "lb", "unid.") no se pluralizan. En unidades de
 * varias palabras ("caja x 20", "bolsa de 5 kg") se pluraliza la primera.
 */
export function pluralUnidad(unidad: string, cantidad: number): string {
  const limpia = unidad.trim();
  if (!limpia || Math.abs(cantidad - 1) < 1e-6 || cantidad < 1) return limpia;
  const [primera, ...resto] = limpia.split(/\s+/);
  if (primera.includes(".") || /^[^aeiouáéíóú]{1,3}$/i.test(primera) || /s$/i.test(primera)) return limpia;
  let plural: string;
  if (/[aeiouáéó]$/i.test(primera)) plural = `${primera}s`;
  else if (/z$/i.test(primera)) plural = `${primera.slice(0, -1)}ces`;
  else plural = `${sinTildeFinal(primera)}es`;
  return [plural, ...resto].join(" ");
}

/** "camión" → "camion" antes de "-es" (camiones): la tilde de la última sílaba cae al pluralizar. */
function sinTildeFinal(palabra: string): string {
  return palabra.replace(/([áéíóú])([nsl])$/i, (_, v: string, c: string) => v.normalize("NFD")[0] + c);
}

/**
 * La cantidad con su unidad, en palabras. `unidad` va tal cual la escribió
 * el negocio, pasada a minúscula: "1 libra", no "1 Libra" en medio de una
 * frase.
 */
export function cantidadConUnidad(valor: number, unidadOriginal: string): string {
  const unidad = unidadOriginal.trim().toLowerCase() || "unidad";
  if (!Number.isFinite(valor) || valor <= 0) return `0 ${pluralUnidad(unidad, 0)}`;

  const entero = Math.floor(valor + 1e-6);
  const resto = Math.round((valor - entero) * 100);
  const fraccion = FRACCION[resto];

  if (resto === 0) return `${entero} ${pluralUnidad(unidad, entero)}`;
  if (fraccion && entero === 0) return resto === 50 ? `1/2 ${unidad}` : `${fraccion} de ${unidad}`;
  if (fraccion) return `${entero} ${pluralUnidad(unidad, entero)} y ${fraccion}`;

  // Un decimal que no es cuarto ni medio (llega escrito a mano en un
  // producto sin fracciones fijas): se dice con coma, nunca "1.3".
  const decimal = valor.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return `${decimal} ${pluralUnidad(unidad, valor)}`;
}

/** "Castillo · Libra" → { variante: "Castillo", unidad: "Libra" }. */
export function partesPresentacion(presentacionNombre: string): { variante: string; unidad: string } {
  const corte = presentacionNombre.lastIndexOf(" · ");
  if (corte === -1) return { variante: presentacionNombre.trim(), unidad: "" };
  return {
    variante: presentacionNombre.slice(0, corte).trim(),
    unidad: presentacionNombre.slice(corte + 3).trim(),
  };
}
