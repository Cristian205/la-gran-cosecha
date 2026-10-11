import type { PresentacionAnidada, PresentacionPayload } from "../../api/resources";
import type { Presentacion } from "../../types";
import { aDecimalApi, leerNumero, validarRegla } from "../../utils/cantidades";

/**
 * Una presentación tal como la edita el formulario: todo texto (lo que el
 * usuario escribe, con coma o punto) hasta el momento de enviarla.
 *
 * Con producto ya guardado, cada borrador se persiste al pulsar "Guardar
 * presentación". Con producto nuevo, los borradores viven aquí y se crean
 * junto al producto en una sola transacción: si algo falla no queda ni el
 * producto ni presentaciones huérfanas.
 */
export interface BorradorPresentacion {
  /** Identidad local estable (las nuevas no tienen id hasta guardarse). */
  clave: string;
  id?: number;
  version?: number;
  nombre_presentacion: string;
  unidad_venta: number | "";
  precio_unitario: string;
  factor_conversion: string;
  cantidad_minima: string;
  incremento_cantidad: string;
  decimales_cantidad: number;
  estado_presentacion: boolean;
  imagen_url?: string | null;
  /** Foto nueva elegida (se sube después de guardar la presentación). */
  archivo?: File | null;
  /** Se pidió quitar la foto guardada. */
  quitarImagen?: boolean;
  /** Errores que devolvió el servidor al guardar el producto nuevo. */
  erroresServidor?: ErroresPresentacion;
}

export type CampoPresentacion =
  | "nombre_presentacion"
  | "unidad_venta"
  | "precio_unitario"
  | "factor_conversion"
  | "cantidad_minima"
  | "incremento_cantidad"
  | "decimales_cantidad";

export type ErroresPresentacion = Partial<Record<CampoPresentacion | "general", string>>;

/** Orden en que se recorren los campos para enfocar el primer error. */
export const ORDEN_CAMPOS: CampoPresentacion[] = [
  "nombre_presentacion",
  "unidad_venta",
  "precio_unitario",
  "cantidad_minima",
  "incremento_cantidad",
  "decimales_cantidad",
  "factor_conversion",
];

let contador = 0;
export function nuevaClave(): string {
  contador += 1;
  return `nueva-${Date.now()}-${contador}`;
}

/** "2000.00" → "2000"; "0.50" → "0,5": como lo escribiría una persona. */
function legible(valor: string): string {
  const n = leerNumero(valor);
  if (!n) return valor;
  return aDecimalApi(valor)!.replace(".", ",");
}

export function borradorVacio(): BorradorPresentacion {
  return {
    clave: nuevaClave(),
    nombre_presentacion: "",
    unidad_venta: "",
    precio_unitario: "",
    factor_conversion: "1",
    cantidad_minima: "1",
    incremento_cantidad: "1",
    decimales_cantidad: 0,
    estado_presentacion: true,
  };
}

export function borradorDesde(p: Presentacion): BorradorPresentacion {
  return {
    clave: `id-${p.id}`,
    id: p.id,
    version: p.version,
    nombre_presentacion: p.nombre_presentacion,
    unidad_venta: p.unidad_venta,
    precio_unitario: legible(p.precio_unitario),
    factor_conversion: legible(p.factor_conversion),
    cantidad_minima: legible(p.cantidad_minima ?? "1"),
    incremento_cantidad: legible(p.incremento_cantidad ?? "1"),
    decimales_cantidad: p.decimales_cantidad ?? 0,
    estado_presentacion: p.estado_presentacion,
    imagen_url: p.imagen_url ?? null,
  };
}

/** Copia para "Duplicar": registro nuevo, sin id ni foto, con otro nombre. */
export function duplicado(b: BorradorPresentacion): BorradorPresentacion {
  return {
    ...b,
    clave: nuevaClave(),
    id: undefined,
    version: undefined,
    imagen_url: null,
    archivo: null,
    quitarImagen: false,
    erroresServidor: undefined,
    nombre_presentacion: `${b.nombre_presentacion} (copia)`.slice(0, 200),
  };
}

/**
 * El precio como lo escribe la gente: "2.000" y "2.000,50" usan el punto de
 * miles (dos mil), no el decimal. Sin esto "2.000" se guardaría como $2.
 */
export function textoPrecio(texto: string): string {
  const t = texto.trim().replace(/\s|\$/g, "");
  return /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "") : t;
}

const normalizar = (texto: string) => texto.split(/\s+/).filter(Boolean).join(" ").toLocaleLowerCase("es");

/**
 * Validación del navegador. Mismas reglas y mensajes que el servidor
 * (`PresentacionGestionSerializer`); el servidor vuelve a validar igual.
 *
 * `hermanas`: las otras presentaciones del producto, para detectar el
 * duplicado (mismo nombre sin distinguir mayúsculas + misma unidad).
 */
export function validarBorrador(
  b: BorradorPresentacion,
  hermanas: BorradorPresentacion[]
): ErroresPresentacion {
  const errores: ErroresPresentacion = {};
  const nombre = normalizar(b.nombre_presentacion);
  if (!nombre) errores.nombre_presentacion = "Escribe el nombre de la presentación.";
  else if (b.nombre_presentacion.trim().length > 200)
    errores.nombre_presentacion = "El nombre admite como máximo 200 caracteres.";
  if (b.unidad_venta === "") errores.unidad_venta = "Elige la unidad en la que se vende.";

  const precioTexto = textoPrecio(b.precio_unitario);
  const precio = leerNumero(precioTexto);
  if (!precioTexto) errores.precio_unitario = "Escribe el precio de venta.";
  else if (precioTexto.startsWith("-")) errores.precio_unitario = "El precio no puede ser negativo.";
  else if (!precio) errores.precio_unitario = "Escribe solo números (ej: 2000 o 2000,50).";
  else if (precio.decimales > 2) errores.precio_unitario = "El precio admite como máximo 2 decimales.";
  else if (precio.escalado === 0) errores.precio_unitario = "El precio debe ser mayor que cero.";
  else if (precio.escalado > 9_999_999_999.99 * 1_000_000) errores.precio_unitario = "El precio es demasiado grande.";

  const factor = leerNumero(b.factor_conversion || "1");
  if (!factor || factor.escalado === 0) errores.factor_conversion = "La equivalencia debe ser un número mayor que cero.";
  else if (factor.decimales > 3) errores.factor_conversion = "La equivalencia admite como máximo 3 decimales.";

  Object.assign(errores, validarRegla(b.cantidad_minima, b.incremento_cantidad, b.decimales_cantidad));

  if (!errores.nombre_presentacion && b.unidad_venta !== "") {
    const repetida = hermanas.find(
      (h) =>
        h.clave !== b.clave &&
        h.unidad_venta === b.unidad_venta &&
        normalizar(h.nombre_presentacion) === nombre
    );
    if (repetida) {
      errores.nombre_presentacion = repetida.estado_presentacion
        ? "Ya existe una presentación con este nombre y esta unidad."
        : "Ya existe una presentación inactiva con este nombre y esta unidad. Actívala en lugar de crear otra.";
    }
  }
  return errores;
}

/** Datos listos para la API (decimales con punto, nombre limpio). */
export function aPayload(b: BorradorPresentacion, productoId: number): PresentacionPayload {
  return {
    producto: productoId,
    nombre_presentacion: b.nombre_presentacion.split(/\s+/).filter(Boolean).join(" "),
    unidad_venta: Number(b.unidad_venta),
    precio_unitario: aDecimalApi(textoPrecio(b.precio_unitario)) ?? b.precio_unitario,
    factor_conversion: aDecimalApi(b.factor_conversion || "1") ?? "1",
    cantidad_minima: aDecimalApi(b.cantidad_minima) ?? b.cantidad_minima,
    incremento_cantidad: aDecimalApi(b.incremento_cantidad) ?? b.incremento_cantidad,
    decimales_cantidad: b.decimales_cantidad,
    estado_presentacion: b.estado_presentacion,
    ...(b.version !== undefined ? { version: b.version } : {}),
  };
}

export function aAnidada(b: BorradorPresentacion): PresentacionAnidada {
  const p = aPayload(b, 0);
  return {
    id: b.id ?? null,
    nombre_presentacion: p.nombre_presentacion,
    unidad_venta: p.unidad_venta,
    precio_unitario: p.precio_unitario,
    factor_conversion: p.factor_conversion,
    cantidad_minima: p.cantidad_minima,
    incremento_cantidad: p.incremento_cantidad,
    decimales_cantidad: p.decimales_cantidad,
    estado_presentacion: p.estado_presentacion,
  };
}

/** `{campo: ["msg"]}` de DRF → `{campo: "msg"}`; lo que no es un campo, a `general`. */
export function erroresDesdeServidor(data: unknown): ErroresPresentacion {
  const errores: ErroresPresentacion = {};
  if (!data || typeof data !== "object") return errores;
  if (Array.isArray(data)) {
    if (typeof data[0] === "string") errores.general = data[0];
    return errores;
  }
  for (const [campo, valor] of Object.entries(data as Record<string, unknown>)) {
    const mensaje = Array.isArray(valor) ? String(valor[0] ?? "") : typeof valor === "string" ? valor : "";
    if (!mensaje) continue;
    if ((ORDEN_CAMPOS as string[]).includes(campo)) errores[campo as CampoPresentacion] = mensaje;
    else errores.general = errores.general ?? mensaje;
  }
  return errores;
}
