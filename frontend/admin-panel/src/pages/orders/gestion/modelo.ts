/**
 * El modelo del modal de gestión de pedidos, sin React: líneas editables,
 * qué cambió frente a lo guardado, validación y el cuerpo que se envía.
 *
 * Todo lo que decide si algo «cambió» o «es válido» vive aquí y no en los
 * componentes, para que la tabla, el resumen y el pie digan lo mismo.
 */
import type { EditarPedidoPayload } from "../../../api/resources";
import type { DetallePedido, OrigenLinea, PedidoDetalle } from "../../../types";
import { leerNumero } from "../../../utils/cantidades";

// ---------- Líneas ----------

export interface LineaEditable {
  /** Clave estable para React: `d<id>` las guardadas, `n<n>` las nuevas. */
  clave: string;
  /** Id del `DetallePedido`; `null` mientras no se guarde. */
  id: number | null;
  presentacion_id: number | null;
  producto_id: number | null;
  nombre_producto: string;
  presentacion_nombre: string | null;
  categoria: string;
  categoria_id: number | null;
  unidad_id: number | null;
  unidad_nombre: string;
  cantidad: string;
  precio_unitario: string;
  nota: string;
  personalizado: boolean;
  origen: OrigenLinea;
  estado_revision: DetallePedido["estado_revision"];
  cantidad_original: string | null;
  precio_original: string | null;
  agregado_por_nombre: string;
  fue_modificado: boolean;
  /** Marcada para quitar: se ve tachada hasta guardar, y se puede restaurar. */
  eliminada: boolean;
}

export function lineaDesdeDetalle(d: DetallePedido): LineaEditable {
  return {
    clave: `d${d.id}`,
    id: d.id,
    presentacion_id: d.presentacion_id,
    producto_id: d.producto_id,
    nombre_producto: d.nombre_producto ?? "",
    presentacion_nombre: d.presentacion_nombre,
    categoria: d.categoria ?? "",
    categoria_id: d.categoria_id ?? null,
    unidad_id: d.unidad_id,
    unidad_nombre: d.unidad_nombre ?? "",
    cantidad: normalizarDecimal(d.cantidad),
    precio_unitario: normalizarDecimal(d.precio_unitario),
    nota: d.nota ?? "",
    personalizado: d.personalizado,
    origen: d.origen ?? "CLIENTE",
    estado_revision: d.estado_revision,
    cantidad_original: d.cantidad_original,
    precio_original: d.precio_original,
    agregado_por_nombre: d.agregado_por_nombre ?? "",
    fue_modificado: d.fue_modificado ?? false,
    eliminada: false,
  };
}

/** "2.00" → "2"; "2.50" → "2.5". Lo que se edita en pantalla. */
export function normalizarDecimal(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor);
  return String(Math.round(n * 100) / 100);
}

/** Lee lo que escribe una persona ("1,5", "1.5", "2") como número; NaN si no se entiende. */
export function aNumero(texto: string | null | undefined): number {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return NaN;
  return Number(limpio);
}

/** Lo mismo en el formato de la API ("1.5"), o `null` si no es válido. */
export function aDecimalApi(texto: string): string | null {
  const n = aNumero(texto);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : null;
}

export function subtotalDe(linea: Pick<LineaEditable, "cantidad" | "precio_unitario">): number {
  const c = aNumero(linea.cantidad);
  const p = aNumero(linea.precio_unitario);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return 0;
  return Math.round(c * p * 100) / 100;
}

export function totalDe(lineas: LineaEditable[]): number {
  return lineas.filter((l) => !l.eliminada).reduce((acc, l) => acc + subtotalDe(l), 0);
}

/** Lo que pidió el cliente, según las cantidades/precios originales guardados. */
export function totalOriginal(pedido: PedidoDetalle): number | null {
  const originales = pedido.detalles.filter((d) => d.origen !== "ADMIN");
  if (originales.some((d) => d.cantidad_original === null)) return null;
  return originales.reduce(
    (acc, d) => acc + Number(d.cantidad_original) * Number(d.precio_original ?? d.precio_unitario),
    0
  );
}

// ---------- Validación ----------

export type ErroresLinea = Partial<Record<"cantidad" | "precio_unitario" | "nombre_producto" | "presentacion_id", string>>;

export function validarCantidad(texto: string): string | undefined {
  if (!String(texto).trim()) return "Escribe la cantidad.";
  const n = leerNumero(String(texto).replace(/\s/g, ""));
  if (!n) return "La cantidad debe ser un número.";
  if (n.escalado === 0) return "La cantidad debe ser mayor a 0.";
  if (n.decimales > 2) return "Máximo 2 decimales.";
  if (n.escalado > 99_999_999 * 1_000_000) return "La cantidad es demasiado grande.";
  return undefined;
}

export function validarPrecio(texto: string): string | undefined {
  if (!String(texto).trim()) return "Escribe el precio.";
  const n = leerNumero(String(texto).replace(/\s/g, ""));
  if (!n) return /^\s*-/.test(texto) ? "El precio no puede ser negativo." : "El precio debe ser un número.";
  if (n.decimales > 2) return "Máximo 2 decimales.";
  if (n.escalado > 9_999_999_999 * 1_000_000) return "El precio es demasiado grande.";
  return undefined;
}

export function validarLinea(l: LineaEditable): ErroresLinea {
  const errores: ErroresLinea = {};
  const c = validarCantidad(l.cantidad);
  if (c) errores.cantidad = c;
  const p = validarPrecio(l.precio_unitario);
  if (p) errores.precio_unitario = p;
  if (l.personalizado && !l.nombre_producto.trim()) errores.nombre_producto = "Escribe el nombre.";
  if (!l.personalizado && l.presentacion_id == null) errores.presentacion_id = "Elige la presentación.";
  return errores;
}

// ---------- Entrega ----------

export interface EntregaEditable {
  direccion_entrega: string;
  telefono_entrega: string;
  recibe_nombre: string;
  /** `YYYY-MM-DDTHH:mm` en hora local (lo que usa `<input type="datetime-local">`). */
  fecha_programada: string;
  indicaciones_entrega: string;
  notas_internas: string;
}

export const CAMPOS_ENTREGA = [
  "direccion_entrega",
  "telefono_entrega",
  "recibe_nombre",
  "fecha_programada",
  "indicaciones_entrega",
  "notas_internas",
] as const;

function isoALocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function entregaDesdePedido(p: PedidoDetalle): EntregaEditable {
  return {
    direccion_entrega: p.direccion_entrega ?? "",
    telefono_entrega: p.telefono_entrega ?? "",
    recibe_nombre: p.recibe_nombre ?? "",
    fecha_programada: isoALocal(p.fecha_programada),
    indicaciones_entrega: p.indicaciones_entrega ?? "",
    notas_internas: p.notas_internas ?? "",
  };
}

export function validarEntrega(e: EntregaEditable): Partial<Record<keyof EntregaEditable, string>> {
  const errores: Partial<Record<keyof EntregaEditable, string>> = {};
  const tel = e.telefono_entrega.trim();
  if (tel && (tel.match(/\d/g)?.length ?? 0) < 7) errores.telefono_entrega = "Escribe un teléfono válido (al menos 7 dígitos).";
  if (e.fecha_programada && Number.isNaN(new Date(e.fecha_programada).getTime()))
    errores.fecha_programada = "La fecha no es válida.";
  return errores;
}

// ---------- Cambios ----------

export interface ResumenCambios {
  editadas: number;
  agregadas: number;
  eliminadas: number;
  entrega: number;
  total: number;
}

function igualNumero(a: string | null, b: string | null): boolean {
  return aNumero(a) === aNumero(b);
}

export function lineaCambio(l: LineaEditable, original: LineaEditable | undefined): boolean {
  if (!original) return true;
  return (
    !igualNumero(l.cantidad, original.cantidad) ||
    !igualNumero(l.precio_unitario, original.precio_unitario) ||
    l.presentacion_id !== original.presentacion_id ||
    l.nombre_producto.trim() !== original.nombre_producto.trim() ||
    l.unidad_id !== original.unidad_id ||
    l.nota.trim() !== original.nota.trim()
  );
}

export function calcularCambios(
  lineas: LineaEditable[],
  base: Map<number, LineaEditable>,
  entrega: EntregaEditable,
  entregaBase: EntregaEditable
): ResumenCambios {
  let editadas = 0;
  let agregadas = 0;
  let eliminadas = 0;
  for (const l of lineas) {
    if (l.id === null) {
      if (!l.eliminada) agregadas += 1;
    } else if (l.eliminada) eliminadas += 1;
    else if (lineaCambio(l, base.get(l.id))) editadas += 1;
  }
  const entregaCambios = CAMPOS_ENTREGA.filter((c) => entrega[c].trim() !== entregaBase[c].trim()).length;
  return {
    editadas,
    agregadas,
    eliminadas,
    entrega: entregaCambios,
    total: editadas + agregadas + eliminadas + entregaCambios,
  };
}

// ---------- Envío ----------

export function construirPayload(
  lineas: LineaEditable[],
  entrega: EntregaEditable,
  entregaBase: EntregaEditable,
  version: string | null
): EditarPedidoPayload {
  const payload: EditarPedidoPayload = {
    version,
    detalles: lineas
      .filter((l) => !l.eliminada)
      .map((l) => {
        const base = {
          detalle_id: l.id,
          cantidad: aDecimalApi(l.cantidad) ?? l.cantidad,
          precio_unitario: aDecimalApi(l.precio_unitario) ?? l.precio_unitario,
          nota: l.nota.trim(),
        };
        if (l.personalizado) {
          return {
            ...base,
            nombre_producto: l.nombre_producto.trim(),
            unidad_id: l.unidad_id ?? undefined,
            categoria_id: l.id === null ? l.categoria_id ?? undefined : undefined,
          };
        }
        return { ...base, presentacion_id: l.presentacion_id ?? undefined };
      }),
  };
  // Solo lo que cambió: un campo que no se tocó no se reescribe.
  for (const campo of CAMPOS_ENTREGA) {
    if (entrega[campo].trim() === entregaBase[campo].trim()) continue;
    if (campo === "fecha_programada") {
      payload.fecha_programada = entrega.fecha_programada
        ? new Date(entrega.fecha_programada).toISOString()
        : null;
    } else {
      payload[campo] = entrega[campo].trim();
    }
  }
  return payload;
}
