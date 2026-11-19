import type { Paginated } from "../types";
import { api } from "./client";

/**
 * Plano de carga: furgones, canastillas y despachos con su acomodo en 3D.
 * Las medidas van en centímetros. La rejilla (cuántas caben a lo largo, a lo
 * ancho y hacia arriba) la calcula SIEMPRE el servidor.
 */

export type Modelo3D = "hino500" | "foton" | "generico";

export interface Furgon {
  id: number;
  nombre: string;
  placa: string;
  /** Marca, línea y versión como figuran en la tarjeta de propiedad. */
  referencia: string;
  modelo_3d: Modelo3D;
  /** Medidas INTERIORES del furgón (las pone el carrocero; se miden). */
  largo_cm: number;
  ancho_cm: number;
  alto_cm: number;
  volumen_m3: number;
  /** null = no se sabe: el peso no se puede validar. */
  carga_util_kg: number | null;
  distancia_entre_ejes_mm: number | null;
  altura_piso_mm: number | null;
  medidas_verificadas: boolean;
  activo: boolean;
}

export interface TipoCanastilla {
  id: number;
  nombre: string;
  largo_cm: number;
  ancho_cm: number;
  alto_cm: number;
  /** 0 = las que quepan por la altura del furgón. */
  max_apiladas: number;
  /** Peso de una canastilla llena, kg. null = no se sabe. */
  peso_lleno_kg: string | null;
  activa: boolean;
}

export interface Rejilla {
  furgon: { largo: number; ancho: number; alto: number };
  canastilla: { largo: number; ancho: number; alto: number };
  /** La canastilla va atravesada (su largo a lo ancho del furgón). */
  girada: boolean;
  /** A lo largo del furgón. Fila 0 = fondo (contra la cabina). */
  filas: number;
  /** A lo ancho. */
  columnas: number;
  niveles: number;
  capacidad: number;
}

/** Canastillas de un mismo destino o cliente. `orden` 1 se entrega primero. */
export interface GrupoCarga {
  id: string;
  nombre: string;
  cantidad: number;
  orden: number;
  color: string;
  direccion?: string;
}

export interface Posicion {
  grupo: string;
  fila: number;
  columna: number;
  nivel: number;
  /** Centro en cm (lo calcula el servidor): x desde la cabina, y desde la pared izquierda, z desde el piso. */
  x_cm?: number;
  y_cm?: number;
  z_cm?: number;
  rotacion?: number;
}

export type EstadoDespacho = "BORRADOR" | "CONFIRMADO";

export interface PedidoDelDia {
  id: number;
  cliente_id: number | null;
  cliente_nombre: string;
  direccion: string;
  telefono: string;
  estado: string;
  total: string;
  fecha_programada: string | null;
  despacho: { id: number; nombre: string; estado: EstadoDespacho } | null;
  canastillas: number | null;
}

export interface Planificacion {
  fecha: string;
  pedidos: PedidoDelDia[];
  resumen: { pedidos: number; asignados: number; sin_vehiculo: number; canastillas: number; despachos: number };
}

export interface PedidoAsignado {
  pedido: number;
  grupo: string;
  canastillas: number;
}

export interface Revision {
  errores: string[];
  advertencias: string[];
  indicadores: {
    canastillas_total: number;
    canastillas_ubicadas: number;
    capacidad_canastillas: number;
    volumen_furgon_m3: number;
    volumen_ocupado_m3: number;
    peso_estimado_kg: number | null;
    carga_util_kg: number | null;
  };
}

export interface PlanoResumen {
  id: number;
  nombre: string;
  fecha: string;
  estado: EstadoDespacho;
  furgon: number;
  furgon_nombre: string;
  modelo_3d: Modelo3D;
  total_canastillas: number;
  total_pedidos: number;
  total_destinos: number;
  capacidad: number;
  actualizado: string;
}

export interface PlanoCarga {
  id: number;
  nombre: string;
  fecha: string;
  furgon: number;
  furgon_nombre: string;
  tipo_canastilla: number;
  medidas: Rejilla;
  grupos: GrupoCarga[];
  posiciones: Posicion[];
  notas: string;
  estado: EstadoDespacho;
  pedidos_detalle: Array<PedidoDelDia & { grupo: string; canastillas: number }>;
  revision: Revision;
  creado_por_nombre: string;
  confirmado_por_nombre: string;
  confirmado_en: string | null;
  creado: string;
  actualizado: string;
}

export type PlanoPayload = Pick<
  PlanoCarga,
  "nombre" | "fecha" | "furgon" | "tipo_canastilla" | "grupos" | "posiciones" | "notas"
> & { pedidos?: PedidoAsignado[] };

const lista = <T>(d: Paginated<T> | T[]): T[] => (Array.isArray(d) ? d : d.results);

export async function listarFurgones(): Promise<Furgon[]> {
  const { data } = await api.get<Furgon[]>("/logistica/furgones/");
  return data;
}

export async function guardarFurgon(payload: Partial<Furgon>): Promise<Furgon> {
  const { data } = payload.id
    ? await api.put<Furgon>(`/logistica/furgones/${payload.id}/`, payload)
    : await api.post<Furgon>("/logistica/furgones/", payload);
  return data;
}

export async function eliminarFurgon(id: number): Promise<void> {
  await api.delete(`/logistica/furgones/${id}/`);
}

export async function listarCanastillas(): Promise<TipoCanastilla[]> {
  const { data } = await api.get<TipoCanastilla[]>("/logistica/canastillas/");
  return data;
}

export async function guardarCanastilla(payload: Partial<TipoCanastilla>): Promise<TipoCanastilla> {
  const { data } = payload.id
    ? await api.put<TipoCanastilla>(`/logistica/canastillas/${payload.id}/`, payload)
    : await api.post<TipoCanastilla>("/logistica/canastillas/", payload);
  return data;
}

export async function eliminarCanastilla(id: number): Promise<void> {
  await api.delete(`/logistica/canastillas/${id}/`);
}

export async function listarPlanos(fecha?: string): Promise<PlanoResumen[]> {
  const { data } = await api.get<Paginated<PlanoResumen> | PlanoResumen[]>("/logistica/planos/", {
    params: { page_size: 100, ...(fecha ? { fecha } : {}) },
  });
  return lista(data);
}

export async function consultarPlanificacion(fecha: string): Promise<Planificacion> {
  const { data } = await api.get<Planificacion>("/logistica/planos/planificacion/", { params: { fecha } });
  return data;
}

export async function confirmarPlano(id: number): Promise<PlanoCarga> {
  const { data } = await api.post<PlanoCarga>(`/logistica/planos/${id}/confirmar/`);
  return data;
}

export async function reabrirPlano(id: number): Promise<PlanoCarga> {
  const { data } = await api.post<PlanoCarga>(`/logistica/planos/${id}/reabrir/`);
  return data;
}

export async function duplicarPlano(id: number, fecha: string): Promise<PlanoCarga> {
  const { data } = await api.post<PlanoCarga>(`/logistica/planos/${id}/duplicar/`, { fecha });
  return data;
}

export async function obtenerPlano(id: number): Promise<PlanoCarga> {
  const { data } = await api.get<PlanoCarga>(`/logistica/planos/${id}/`);
  return data;
}

export async function guardarPlano(payload: PlanoPayload, id?: number): Promise<PlanoCarga> {
  const { data } = id
    ? await api.put<PlanoCarga>(`/logistica/planos/${id}/`, payload)
    : await api.post<PlanoCarga>("/logistica/planos/", payload);
  return data;
}

export async function eliminarPlano(id: number): Promise<void> {
  await api.delete(`/logistica/planos/${id}/`);
}

export async function consultarRejilla(furgon: number, tipoCanastilla: number): Promise<Rejilla> {
  const { data } = await api.get<Rejilla>("/logistica/planos/rejilla/", {
    params: { furgon, tipo_canastilla: tipoCanastilla },
  });
  return data;
}
