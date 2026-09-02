import type { Paginated } from "../types";
import { api } from "./client";

/**
 * La agenda.
 *
 * Misma asimetría que en la caja y en el inventario: los recursos son un CRUD
 * normal —son un catálogo— y las reservas se leen así pero se cambian con
 * operaciones con nombre. No hay `PATCH`: mover una reserva vuelve a disputar
 * un hueco y tiene que pasar por el bloqueo del servidor.
 */

/** Cómo llama este negocio a lo que reserva. Los datos NOMBRAN, el código
 *  PINTA: la pantalla no dice «Recursos» en ningún sitio. */
export interface ConfiguracionReservas {
  nombre_recurso: string;
  nombre_recurso_plural: string;
  duracion_minutos: number;
  antelacion_maxima_dias: number;
}

export interface Recurso {
  id: number;
  codigo: string;
  nombre: string;
  zona: string;
  capacidad: number;
  /** Cuántas reservas admite a la vez. Una mesa, una; una sala, veinte. */
  reservas_simultaneas: number;
  activo: boolean;
  orden: number;
  ubicacion_id: number | null;
  ubicacion_nombre: string;
}

export type EstadoReserva =
  | "PENDIENTE"
  | "CONFIRMADA"
  | "EN_CURSO"
  | "CUMPLIDA"
  | "CANCELADA"
  | "NO_ASISTIO";

export interface Reserva {
  id: number;
  recurso: number;
  recurso_nombre: string;
  recurso_zona: string;
  cliente: number | null;
  nombre_contacto: string;
  telefono_contacto: string;
  personas: number;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  estado_display: string;
  /** A dónde puede ir DESDE aquí. Lo decide el servidor: reimplementar la
   *  tabla de transiciones en TypeScript es cómo acaban divergiendo el panel y
   *  la API, y el síntoma son botones que se pulsan y no hacen nada. */
  siguientes: { valor: EstadoReserva; etiqueta: string }[];
  origen: "PANEL" | "CAJA" | "TIENDA";
  nota: string;
  venta: number | null;
  fecha_creacion: string;
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerConfiguracion(): Promise<ConfiguracionReservas> {
  const { data } = await api.get<ConfiguracionReservas>("/reservas/configuracion/");
  return data;
}

export async function guardarConfiguracion(
  payload: Partial<ConfiguracionReservas>
): Promise<ConfiguracionReservas> {
  const { data } = await api.put<ConfiguracionReservas>(
    "/reservas/configuracion/",
    payload
  );
  return data;
}

export async function obtenerRecursos(): Promise<Recurso[]> {
  const { data } = await api.get<Paginated<Recurso> | Recurso[]>("/reservas/recursos/");
  return unwrap(data);
}

export type RecursoPayload = Omit<
  Recurso,
  "id" | "ubicacion_nombre"
>;

export async function crearRecurso(payload: RecursoPayload): Promise<Recurso> {
  const { data } = await api.post<Recurso>("/reservas/recursos/", payload);
  return data;
}

export async function actualizarRecurso(
  id: number,
  payload: RecursoPayload
): Promise<Recurso> {
  const { data } = await api.put<Recurso>(`/reservas/recursos/${id}/`, payload);
  return data;
}

export async function eliminarRecurso(id: number): Promise<void> {
  await api.delete(`/reservas/recursos/${id}/`);
}

export async function obtenerAgenda(
  desde: string,
  hasta: string,
  recursoId?: number
): Promise<Reserva[]> {
  const { data } = await api.get<Reserva[]>("/reservas/reservas/agenda/", {
    params: { desde, hasta, ...(recursoId ? { recurso_id: recursoId } : {}) },
  });
  return data;
}

export async function obtenerLibres(desde: string, hasta: string): Promise<Recurso[]> {
  const { data } = await api.get<Recurso[]>("/reservas/reservas/libres/", {
    params: { desde, hasta },
  });
  return data;
}

export async function crearReserva(payload: {
  recurso_id: number;
  inicio: string;
  fin?: string | null;
  personas?: number;
  nombre_contacto: string;
  telefono_contacto?: string;
  nota?: string;
}): Promise<Reserva> {
  const { data } = await api.post<Reserva>("/reservas/reservas/crear/", payload);
  return data;
}

export async function reprogramar(
  id: number,
  payload: { inicio?: string; fin?: string; recurso_id?: number; personas?: number }
): Promise<Reserva> {
  const { data } = await api.post<Reserva>(
    `/reservas/reservas/${id}/reprogramar/`,
    payload
  );
  return data;
}

export async function cambiarEstado(
  id: number,
  estado: EstadoReserva
): Promise<Reserva> {
  const { data } = await api.post<Reserva>(`/reservas/reservas/${id}/estado/`, {
    estado,
  });
  return data;
}

/**
 * Cuelga de la reserva la venta que la atendió.
 *
 * Lo llama el panel de la caja después de abrir la venta. La dirección importa
 * y es la que sostiene toda la fase: de reserva a venta, y desde este módulo.
 * El POS solo guardó un diccionario opaco en `Venta.contexto` — sigue sin saber
 * que las reservas existen.
 */
export async function enlazarVenta(
  reservaId: number,
  ventaId: number
): Promise<Reserva> {
  const { data } = await api.post<Reserva>(
    `/reservas/reservas/${reservaId}/enlazar-venta/`,
    { venta_id: ventaId }
  );
  return data;
}
