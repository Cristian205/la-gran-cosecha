import type { Paginated } from "../types";
import { api } from "./client";

/**
 * El reparto.
 *
 * Misma asimetría que en la caja, el inventario y la agenda: las zonas y los
 * repartidores son un CRUD normal —son catálogos— y los envíos se leen así
 * pero se cambian con operaciones con nombre. No hay `PATCH`: asignar obliga a
 * contar lo que el repartidor ya lleva, y eso pasa por un bloqueo del servidor.
 */

/** Cómo llama este negocio a quien reparte. Los datos NOMBRAN, el código
 *  PINTA: la pantalla no dice «Repartidor» en ningún sitio si el negocio
 *  prefiere «Domiciliario». */
export interface ConfiguracionEnvios {
  nombre_repartidor: string;
  nombre_repartidor_plural: string;
  tarifa_base: string;
  minutos_de_promesa: number;
  /** Si está encendido, una dirección sin zona se rechaza en vez de cobrarse a
   *  tarifa base. */
  exige_zona: boolean;
}

export interface Zona {
  id: number;
  codigo: string;
  nombre: string;
  tarifa: string;
  /** 0 significa «lo que diga el negocio», no cero minutos. */
  minutos_de_promesa: number;
  activa: boolean;
  orden: number;
}

export interface Repartidor {
  id: number;
  nombre: string;
  telefono: string;
  vehiculo: string;
  carga_maxima: number;
  /** Cuántos lleva encima ahora. Lo cuenta el servidor. */
  carga_actual: number;
  activo: boolean;
  orden: number;
}

export type EstadoEnvio =
  | "PENDIENTE"
  | "ASIGNADO"
  | "EN_RUTA"
  | "ENTREGADO"
  | "DEVUELTO"
  | "CANCELADO";

export interface Envio {
  id: number;
  zona: number | null;
  zona_nombre: string;
  repartidor: number | null;
  repartidor_nombre: string;
  cliente: number | null;
  nombre_contacto: string;
  telefono_contacto: string;
  direccion: string;
  referencia: string;
  tarifa: string;
  cobro_contra_entrega: boolean;
  monto_a_cobrar: string;
  estado: EstadoEnvio;
  estado_display: string;
  /** A dónde puede ir DESDE aquí. Lo decide el servidor: reimplementar la
   *  tabla de transiciones en TypeScript es cómo acaban divergiendo el panel y
   *  la API, y el síntoma son botones que se pulsan y no hacen nada. */
  siguientes: { valor: EstadoEnvio; etiqueta: string }[];
  origen: "PANEL" | "CAJA" | "TIENDA";
  nota: string;
  prometido_para: string | null;
  salida: string | null;
  entrega: string | null;
  venta: number | null;
  pedido: number | null;
  fecha_creacion: string;
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

// ==========================================================================
// CONFIGURACIÓN
// ==========================================================================
export async function obtenerConfiguracion(): Promise<ConfiguracionEnvios> {
  const { data } = await api.get<ConfiguracionEnvios>("/domicilios/configuracion/");
  return data;
}

export async function guardarConfiguracion(
  payload: Partial<ConfiguracionEnvios>
): Promise<ConfiguracionEnvios> {
  const { data } = await api.put<ConfiguracionEnvios>(
    "/domicilios/configuracion/",
    payload
  );
  return data;
}

// ==========================================================================
// CATÁLOGOS
// ==========================================================================
export async function obtenerZonas(): Promise<Zona[]> {
  const { data } = await api.get<Paginated<Zona> | Zona[]>("/domicilios/zonas/");
  return unwrap(data);
}

export async function guardarZona(payload: Partial<Zona>): Promise<Zona> {
  if (payload.id) {
    const { data } = await api.put<Zona>(`/domicilios/zonas/${payload.id}/`, payload);
    return data;
  }
  const { data } = await api.post<Zona>("/domicilios/zonas/", payload);
  return data;
}

export async function obtenerRepartidores(): Promise<Repartidor[]> {
  const { data } = await api.get<Paginated<Repartidor> | Repartidor[]>(
    "/domicilios/repartidores/"
  );
  return unwrap(data);
}

/** A quiénes todavía les cabe algo. Es la lista del desplegable de asignar. */
export async function obtenerDisponibles(): Promise<Repartidor[]> {
  const { data } = await api.get<Repartidor[]>("/domicilios/repartidores/disponibles/");
  return data;
}

export async function guardarRepartidor(
  payload: Partial<Repartidor>
): Promise<Repartidor> {
  if (payload.id) {
    const { data } = await api.put<Repartidor>(
      `/domicilios/repartidores/${payload.id}/`,
      payload
    );
    return data;
  }
  const { data } = await api.post<Repartidor>("/domicilios/repartidores/", payload);
  return data;
}

// ==========================================================================
// ENVÍOS
// ==========================================================================
/**
 * El tablero. Sin ventana devuelve lo que sigue vivo, que es lo que mira quien
 * está despachando; con ventana pasa a ser el modo auditoría.
 */
export async function obtenerTablero(params?: {
  desde?: string;
  hasta?: string;
  estado?: EstadoEnvio[];
}): Promise<Envio[]> {
  const { data } = await api.get<Envio[]>("/domicilios/envios/tablero/", { params });
  return data;
}

export async function crearEnvio(payload: {
  direccion: string;
  zona_id?: number | null;
  cliente_id?: number | null;
  pedido_id?: number | null;
  venta_id?: number | null;
  nombre_contacto?: string;
  telefono_contacto?: string;
  referencia?: string;
  tarifa?: string | null;
  cobro_contra_entrega?: boolean;
  monto_a_cobrar?: string;
  nota?: string;
}): Promise<Envio> {
  const { data } = await api.post<Envio>("/domicilios/envios/crear/", payload);
  return data;
}

export async function asignarEnvio(
  envioId: number,
  repartidorId: number
): Promise<Envio> {
  const { data } = await api.post<Envio>(`/domicilios/envios/${envioId}/asignar/`, {
    repartidor_id: repartidorId,
  });
  return data;
}

export async function cambiarEstado(
  envioId: number,
  estado: EstadoEnvio,
  nota?: string
): Promise<Envio> {
  const { data } = await api.post<Envio>(`/domicilios/envios/${envioId}/estado/`, {
    estado,
    nota,
  });
  return data;
}

export async function enlazarVenta(envioId: number, ventaId: number): Promise<Envio> {
  const { data } = await api.post<Envio>(
    `/domicilios/envios/${envioId}/enlazar-venta/`,
    { venta_id: ventaId }
  );
  return data;
}
