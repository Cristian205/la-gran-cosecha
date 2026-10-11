/**
 * Regla de cantidad de una presentación: desde cuánto y de cuánto en cuánto
 * se pide. Copia exacta de `backend/apps/catalog/cantidades.py` — si cambia
 * una, cambia la otra, porque el servidor rechaza lo que este archivo deje
 * pasar.
 *
 * Todo se calcula con enteros escalados (millonésimas), nunca con `float`:
 * con coma flotante 0,5 + 0,25 · 3 no da exactamente 1,25 y una cantidad
 * válida acabaría marcada como inválida.
 */

/** Tope de `DetallePedido.cantidad` en el servidor. */
export const MAX_DECIMALES = 2;
const ESCALA = 1_000_000;
const MAXIMO = 99_999_999.99;

export interface Numero {
  /** Valor × 1.000.000, exacto. */
  escalado: number;
  decimales: number;
}

/** Lee "1,5", "1.5" o "2" sin pasar por float. `null` si no es un número ≥ 0. */
export function leerNumero(texto: string | number | null | undefined): Numero | null {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).trim().replace(",", ".");
  const m = /^(\d+)(?:\.(\d+))?$/.exec(limpio);
  if (!m) return null;
  const frac = (m[2] ?? "").replace(/0+$/, "");
  if (frac.length > 6) return null;
  const escalado = Number(m[1]) * ESCALA + Number((frac || "0").padEnd(6, "0"));
  if (!Number.isSafeInteger(escalado)) return null;
  return { escalado, decimales: frac.length };
}

function aTexto(escalado: number): string {
  const entero = Math.floor(escalado / ESCALA);
  const frac = String(escalado % ESCALA).padStart(6, "0").replace(/0+$/, "");
  return frac ? `${entero},${frac}` : String(entero);
}

/** 0.5 → "0,5"; "2.00" → "2". Como se escribe en Colombia. */
export function formatearCantidad(valor: string | number): string {
  const n = leerNumero(valor);
  return n ? aTexto(n.escalado) : String(valor);
}

/** El mismo número en formato de API ("0.25"), o `null` si no se entiende. */
export function aDecimalApi(texto: string): string | null {
  const n = leerNumero(texto);
  if (!n) return null;
  return aTexto(n.escalado).replace(",", ".");
}

export type ErroresRegla = Partial<
  Record<"cantidad_minima" | "incremento_cantidad" | "decimales_cantidad", string>
>;

/** Los errores de una regla, por campo. Mismos mensajes que el servidor. */
export function validarRegla(
  minimaTexto: string,
  incrementoTexto: string,
  decimales: number
): ErroresRegla {
  const errores: ErroresRegla = {};
  let precision = decimales;
  if (!Number.isInteger(decimales) || decimales < 0 || decimales > MAX_DECIMALES) {
    errores.decimales_cantidad = `Elige entre 0 y ${MAX_DECIMALES} decimales.`;
    precision = MAX_DECIMALES;
  }

  const campos = [
    ["cantidad_minima", minimaTexto, "La cantidad mínima", "Escribe la cantidad mínima."],
    ["incremento_cantidad", incrementoTexto, "El incremento", "Escribe el incremento."],
  ] as const;
  const leidos: Record<string, Numero | null> = {};
  for (const [campo, texto, nombre, siVacio] of campos) {
    const vacio = String(texto ?? "").trim() === "";
    const negativo = /^\s*-/.test(String(texto ?? ""));
    const n = leerNumero(texto);
    leidos[campo] = n;
    if (vacio) errores[campo] = siVacio;
    else if (negativo || (n && n.escalado === 0)) errores[campo] = `${nombre} debe ser mayor que cero.`;
    else if (!n) errores[campo] = `${nombre} debe ser un número.`;
    else if (n.escalado > MAXIMO * ESCALA) errores[campo] = `${nombre} es demasiado grande.`;
    else if (n.decimales > precision)
      errores[campo] =
        precision === 0
          ? `${nombre} no puede tener decimales con esta precisión.`
          : `${nombre} admite como máximo ${precision} decimal${precision > 1 ? "es" : ""}.`;
  }

  const minima = leidos.cantidad_minima;
  const paso = leidos.incremento_cantidad;
  if (!errores.cantidad_minima && !errores.incremento_cantidad && minima && paso) {
    if (minima.escalado % paso.escalado !== 0) {
      errores.cantidad_minima =
        "La cantidad mínima debe ser múltiplo del incremento " +
        `(por ejemplo ${aTexto(paso.escalado)} o ${aTexto(paso.escalado * 2)}).`;
    }
  }
  return errores;
}

/** Las primeras `cuantas` cantidades válidas, ya formateadas. */
export function ejemplosCantidad(minimaTexto: string, incrementoTexto: string, cuantas = 6): string[] {
  const minima = leerNumero(minimaTexto);
  const paso = leerNumero(incrementoTexto);
  if (!minima || !paso || paso.escalado === 0) return [];
  return Array.from({ length: cuantas }, (_, i) => aTexto(minima.escalado + paso.escalado * i));
}

/** ¿Cae `cantidad` en la secuencia mínima, mínima + incremento, …? */
export function cantidadValida(
  cantidad: string | number,
  minimaTexto: string | number,
  incrementoTexto: string | number,
  decimales: number
): boolean {
  const valor = leerNumero(cantidad);
  const minima = leerNumero(minimaTexto);
  const paso = leerNumero(incrementoTexto);
  if (!valor || !minima || !paso || paso.escalado === 0) return false;
  if (valor.escalado < minima.escalado || valor.decimales > decimales) return false;
  return (valor.escalado - minima.escalado) % paso.escalado === 0;
}

/** "desde 0,5 · de 0,25 en 0,25", para resúmenes compactos. */
export function describirRegla(minima: string, incremento: string): string {
  const m = formatearCantidad(minima);
  const p = formatearCantidad(incremento);
  return m === p ? `de ${p} en ${p}` : `desde ${m} · de ${p} en ${p}`;
}

/** Atajos frecuentes: cubren casi todos los negocios sin pensar en números. */
export const PRESETS_CANTIDAD = [
  { id: "entero", titulo: "Unidades completas", ejemplo: "1, 2, 3…", minima: "1", incremento: "1", decimales: 0 },
  { id: "medio", titulo: "Medias unidades", ejemplo: "½, 1, 1½…", minima: "0,5", incremento: "0,5", decimales: 1 },
  { id: "cuarto", titulo: "Cuartos de unidad", ejemplo: "¼, ½, ¾…", minima: "0,25", incremento: "0,25", decimales: 2 },
] as const;
