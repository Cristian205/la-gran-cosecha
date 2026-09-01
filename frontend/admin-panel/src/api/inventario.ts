import type { Paginated } from "../types";
import { api } from "./client";

/**
 * El inventario, tal como lo expone el backend.
 *
 * La asimetría de esta API es deliberada y conviene no "arreglarla": las
 * existencias se LEEN, pero no se escriben. No hay forma de fijar una cantidad
 * con un PATCH; solo de registrar lo que pasó —una entrada, un conteo, un
 * traslado— y dejar que el saldo se derive. Un saldo sin movimiento que lo
 * explique es exactamente el descuadre que el inventario existe para impedir.
 */

export interface Existencia {
  id: number;
  producto: number;
  producto_nombre: string;
  producto_codigo: string;
  ubicacion: number;
  ubicacion_nombre: string;
  /** Lo que hay fisicamente. Llega como cadena: es un decimal, no un float. */
  cantidad: string;
  /** Comprometido en pedidos confirmados y todavia sin entregar. */
  reservada: string;
  /** `cantidad - reservada`. Lo unico que se puede prometer a un cliente. */
  disponible: string;
  fecha_actualizacion: string;
}

export interface Ubicacion {
  id: number;
  nombre: string;
  codigo: string;
  tipo: "TIENDA" | "BODEGA" | "VEHICULO";
  es_predeterminada: boolean;
  activa: boolean;
}

export type TipoMovimiento =
  | "ENTRADA"
  | "SALIDA"
  | "AJUSTE"
  | "TRASLADO"
  | "RESERVA"
  | "LIBERACION";

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  tipo_display: string;
  producto: number;
  producto_nombre: string;
  ubicacion: number;
  presentacion: number | null;
  /** Con signo: una salida es negativa. */
  cantidad: string;
  saldo_resultante: string | null;
  origen_tipo: string;
  origen_id: number | null;
  usuario_nombre: string;
  motivo: string;
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerUbicaciones(): Promise<Ubicacion[]> {
  const { data } = await api.get<Paginated<Ubicacion> | Ubicacion[]>(
    "/inventory/locations/"
  );
  return unwrap(data);
}

export async function obtenerExistencias(params?: {
  ubicacion?: number;
  search?: string;
}): Promise<Existencia[]> {
  const { data } = await api.get<Paginated<Existencia> | Existencia[]>(
    "/inventory/stock/",
    { params }
  );
  return unwrap(data);
}

export async function obtenerMovimientos(params: {
  producto?: number;
  ubicacion?: number;
  tipo?: TipoMovimiento;
}): Promise<Movimiento[]> {
  const { data } = await api.get<Paginated<Movimiento> | Movimiento[]>(
    "/inventory/movements/",
    { params }
  );
  return unwrap(data);
}

// ---------- Las tres operaciones ----------
export async function registrarEntrada(payload: {
  producto_id: number;
  cantidad: string;
  ubicacion_id?: number | null;
  motivo?: string;
}): Promise<Existencia> {
  const { data } = await api.post<Existencia>("/inventory/stock/entrada/", payload);
  return data;
}

export async function registrarAjuste(payload: {
  producto_id: number;
  /** El TOTAL contado, no la diferencia: es lo que la persona tiene delante. */
  cantidad_contada: string;
  ubicacion_id?: number | null;
  motivo?: string;
}): Promise<Existencia> {
  const { data } = await api.post<Existencia>("/inventory/stock/ajuste/", payload);
  return data;
}

export async function registrarTraslado(payload: {
  producto_id: number;
  origen_id: number;
  destino_id: number;
  cantidad: string;
  motivo?: string;
}): Promise<Existencia> {
  const { data } = await api.post<Existencia>("/inventory/stock/traslado/", payload);
  return data;
}
