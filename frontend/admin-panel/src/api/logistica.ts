import type { Paginated } from "../types";
import { api } from "./client";

/**
 * Plano de carga: furgones, canastillas y despachos con su acomodo en 3D.
 * Las medidas van en centímetros. El ESQUEMA (dónde va cada pila, su
 * orientación y cuántas se apilan) lo calcula SIEMPRE el servidor: el visor 3D,
 * el plano 2D y el PDF dibujan los mismos datos.
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
  /** Cómo se carga el vehículo. Vacío = rejilla uniforme. */
  esquema_carga: ConfigEsquema | Record<string, never>;
  activo: boolean;
}

export type ConfigEsquema =
  | { tipo: "rejilla" }
  | {
      tipo: "frente_columnas";
      /** null = las que quepan. */
      frente: number | null;
      izquierda: number | null;
      derecha: number | null;
      niveles: number;
      pasillo_min_cm: number;
      orientacion_laterales: "longitudinal" | "transversal";
    };

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

export type ZonaPila = "frente" | "izquierda" | "derecha" | "rejilla";

/** Un lugar del piso donde se apilan canastillas. */
export interface Pila {
  /** Centro en cm: x desde la pared de la cabina, y desde la pared IZQUIERDA. */
  x: number;
  y: number;
  /** 0 = largo de la canastilla a lo largo del furgón; 90 = atravesada. */
  rot: 0 | 90;
  zona: ZonaPila;
  /** Por dónde se descarga: desde la puerta (rejilla) o desde el pasillo. */
  acceso: "puerta" | "pasillo";
  /** «T1», «I3», «D2», «F2-C1»… */
  etiqueta: string;
}

/** El esquema de carga calculado por el servidor (antes «rejilla»). */
export interface Rejilla {
  furgon: { largo: number; ancho: number; alto: number };
  canastilla: { largo: number; ancho: number; alto: number };
  esquema: "rejilla" | "frente_columnas";
  pilas: Pila[];
  niveles: number;
  capacidad: number;
  avisos: string[];
  errores: string[];
  pasillo_cm?: number;
  frente_fondo_cm?: number;
  largo_usado_cm?: number;
}

/** Canastillas de un mismo destino o cliente. `orden` 1 se entrega primero. */
export interface GrupoCarga {
  id: string;
  nombre: string;
  cantidad: number;
  orden: number;
  color: string;
  direccion?: string;
  /** Número identificador visible (independiente del orden de entrega). */
  numero?: number;
  /** Cliente de la tienda al que corresponde (despachos generados desde la planificación). */
  cliente?: number;
}

export interface Posicion {
  grupo: string;
  /** Índice en `Rejilla.pilas`. */
  pila: number;
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
  /** De qué ruta salió (vacío = armado a mano). */
  ruta_clave: string;
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
  /** Pilas que el acomodo automático no toca. */
  bloqueos: number[];
  notas: string;
  estado: EstadoDespacho;
  pedidos_detalle: Array<PedidoDelDia & { grupo: string; canastillas: number }>;
  revision: Revision;
  /** Por destino: sus pedidos y productos consolidados (para acomodarlos en el editor). */
  entregas: EntregaDestino[];
  ruta_clave: string;
  creado_por_nombre: string;
  confirmado_por_nombre: string;
  confirmado_en: string | null;
  creado: string;
  actualizado: string;
}

/** Un destino del despacho con lo que lleva (sale de los pedidos reales). */
export interface EntregaDestino {
  grupo: string;
  orden: number;
  numero: number;
  cliente_id: number | null;
  nombre: string;
  direccion: string;
  telefono: string;
  recibe: string;
  canastillas: number;
  pedidos: Array<{ id: number; estado: string; observaciones: string; indicaciones: string }>;
  productos: Array<{ clave: string; producto: string; unidad: string; cantidad: string; pedidos: Array<{ id: number; cantidad: string }>; notas: string[] }>;
  peso_kg: number | null;
  sin_regla: string[];
}

export type PlanoPayload = Pick<
  PlanoCarga,
  "nombre" | "fecha" | "furgon" | "tipo_canastilla" | "grupos" | "posiciones" | "bloqueos" | "notas"
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

/** El esquema de un vehículo SIN guardarlo (vista previa del formulario). */
export async function vistaPreviaEsquema(
  furgon: Pick<Furgon, "largo_cm" | "ancho_cm" | "alto_cm" | "esquema_carga">,
  tipoCanastilla: number
): Promise<Rejilla> {
  const { data } = await api.post<Rejilla>("/logistica/furgones/vista-previa/", {
    ...furgon,
    tipo_canastilla: tipoCanastilla,
  });
  return data;
}

/** La guía de carga y entrega en PDF (pasa por el cliente con sesión: lleva el token). */
export async function descargarPdfPlano(id: number): Promise<Blob> {
  const { data } = await api.get(`/logistica/planos/${id}/pdf/`, { responseType: "blob" });
  return data as Blob;
}

// =====================================================================
// Programación semanal de rutas
// =====================================================================

/** 0 = lunes … 6 = domingo (como `date.weekday()` en el servidor). */
export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export interface ProgramacionSemanal {
  id: number;
  nombre: string;
  activa: boolean;
  notas: string;
  total_rutas: number;
}

export interface ParadaRutaLectura {
  cliente: number;
  cliente_nombre: string;
  direccion: string;
  nota: string;
  orden: number;
}

export interface ParadaRutaEscritura {
  cliente: number;
  nota?: string;
}

export interface Ruta {
  id: number;
  programacion: number;
  dia_semana: number;
  nombre: string;
  furgon: number;
  furgon_nombre: string;
  furgon_placa: string;
  color: string;
  notas: string;
  paradas: ParadaRutaLectura[];
}

export type RutaPayload = Omit<Ruta, "id" | "furgon_nombre" | "furgon_placa" | "paradas"> & { paradas: ParadaRutaEscritura[] };

/** Una ruta SOLO para una fecha: reemplaza o cancela la habitual, o es una ruta extra. */
export interface AjusteRuta {
  id: number;
  fecha: string;
  ruta: number | null;
  cancelada: boolean;
  nombre: string;
  furgon: number | null;
  furgon_nombre: string;
  color: string;
  paradas: ParadaRutaLectura[];
  motivo: string;
}

export type AjustePayload = Omit<AjusteRuta, "id" | "furgon_nombre" | "paradas"> & { paradas: ParadaRutaEscritura[] };

export async function listarProgramaciones(): Promise<ProgramacionSemanal[]> {
  const { data } = await api.get<ProgramacionSemanal[]>("/logistica/programaciones/");
  return data;
}

export async function guardarProgramacion(payload: Partial<ProgramacionSemanal>): Promise<ProgramacionSemanal> {
  const { data } = payload.id
    ? await api.patch<ProgramacionSemanal>(`/logistica/programaciones/${payload.id}/`, payload)
    : await api.post<ProgramacionSemanal>("/logistica/programaciones/", payload);
  return data;
}

export async function activarProgramacion(id: number): Promise<ProgramacionSemanal> {
  const { data } = await api.post<ProgramacionSemanal>(`/logistica/programaciones/${id}/activar/`);
  return data;
}

export async function duplicarProgramacion(id: number, nombre: string): Promise<ProgramacionSemanal> {
  const { data } = await api.post<ProgramacionSemanal>(`/logistica/programaciones/${id}/duplicar/`, { nombre });
  return data;
}

export async function eliminarProgramacion(id: number): Promise<void> {
  await api.delete(`/logistica/programaciones/${id}/`);
}

export async function listarRutas(programacion: number): Promise<Ruta[]> {
  const { data } = await api.get<Ruta[]>("/logistica/rutas/", { params: { programacion } });
  return data;
}

export async function guardarRuta(payload: RutaPayload, id?: number): Promise<Ruta> {
  const { data } = id
    ? await api.put<Ruta>(`/logistica/rutas/${id}/`, payload)
    : await api.post<Ruta>("/logistica/rutas/", payload);
  return data;
}

export async function eliminarRuta(id: number): Promise<void> {
  await api.delete(`/logistica/rutas/${id}/`);
}

export async function listarAjustes(fecha: string): Promise<AjusteRuta[]> {
  const { data } = await api.get<AjusteRuta[]>("/logistica/ajustes-ruta/", { params: { fecha } });
  return data;
}

export async function guardarAjuste(payload: AjustePayload, id?: number): Promise<AjusteRuta> {
  const { data } = id
    ? await api.put<AjusteRuta>(`/logistica/ajustes-ruta/${id}/`, payload)
    : await api.post<AjusteRuta>("/logistica/ajustes-ruta/", payload);
  return data;
}

export async function eliminarAjuste(id: number): Promise<void> {
  await api.delete(`/logistica/ajustes-ruta/${id}/`);
}

// =====================================================================
// Reglas de carga por presentación
// =====================================================================

export interface ReglaCarga {
  presentacion: number;
  producto: string;
  categoria: string;
  presentacion_nombre: string;
  /** Cómo se vende, tal cual: «Kilo», «Bulto de 50 kg». */
  unidad: string;
  /** Cuántas unidades de esta presentación llenan una canastilla. null = sin regla. */
  unidades_por_canastilla: string | null;
  /** Peso de UNA unidad, en kg. null = no se sabe. */
  peso_kg_por_unidad: string | null;
}

export async function listarReglasCarga(): Promise<ReglaCarga[]> {
  const { data } = await api.get<ReglaCarga[]>("/logistica/reglas-carga/");
  return data;
}

export async function guardarReglasCarga(
  reglas: Array<Pick<ReglaCarga, "presentacion" | "unidades_por_canastilla" | "peso_kg_por_unidad">>
): Promise<ReglaCarga[]> {
  const { data } = await api.post<ReglaCarga[]>("/logistica/reglas-carga/guardar/", reglas);
  return data;
}

// =====================================================================
// Centro de planificación diaria
// =====================================================================

/** Un producto consolidado: cantidad en su unidad de venta ORIGINAL. */
export interface ProductoConsolidado {
  clave: string;
  producto: string;
  unidad: string;
  /** Decimal como texto («47», «2.5»). */
  cantidad: string;
  /** Cuánto aportó cada pedido. */
  pedidos: Array<{ id: number; cantidad: string }>;
  notas: string[];
  con_regla: boolean;
  /** Fracción de canastilla que ocupa (solo con regla de carga). */
  fraccion: number | null;
  peso_kg: number | null;
}

export interface DespachoDelDia {
  id: number;
  nombre: string;
  estado: EstadoDespacho;
  ruta_clave: string;
  furgon: number;
  canastillas: number;
  destinos: number;
  capacidad: number;
  errores: string[];
  advertencias: number;
  /** Borrador sin errores: se puede confirmar. */
  listo: boolean;
}

export interface PedidoPlanificacion {
  id: number;
  estado: string;
  cliente_id: number | null;
  cliente_nombre: string;
  direccion: string;
  telefono: string;
  recibe: string;
  observaciones: string;
  indicaciones: string;
  total: string;
  fecha_pedido: string | null;
  fecha_programada: string | null;
  productos: ProductoConsolidado[];
  fraccion: number;
  canastillas: number;
  peso_kg: number | null;
  sin_regla: string[];
  despacho: DespachoDelDia | null;
  canastillas_asignadas?: number;
  motivo?: string;
  aviso?: string;
}

export interface ParadaPropuesta {
  cliente_id: number | null;
  nombre: string;
  direccion: string;
  telefono: string;
  en_ruta: boolean;
  nota_ruta: string;
  orden: number;
  pedidos: PedidoPlanificacion[];
  productos: ProductoConsolidado[];
  canastillas: number;
  /** Las canastillas vienen de un despacho ya armado (o las fijó alguien). */
  canastillas_manual: boolean;
  sin_regla: string[];
  peso_kg: number | null;
}

export interface CapacidadVehiculo {
  canastillas: number;
  posiciones: number;
  niveles: number;
  carga_util_kg: number | null;
  /** Canastillas que permite la carga útil (si se conoce el peso de una llena). */
  tope_por_peso: number | null;
  errores: string[];
}

export interface FurgonResumen {
  id: number;
  nombre: string;
  placa: string;
  modelo_3d: Modelo3D;
  carga_util_kg: number | null;
  activo: boolean;
}

export interface VehiculoPropuesta {
  /** "r<id>" ruta semanal · "a<id>" ruta extra del día · "d<id>" despacho armado a mano · "f<id>" vehículo agregado. */
  clave: string;
  ruta_id: number | null;
  ajuste_id: number | null;
  origen: "ruta" | "ajuste" | "extra" | "despacho" | "manual";
  nombre: string;
  color: string;
  furgon: FurgonResumen | null;
  capacidad: CapacidadVehiculo | null;
  despacho: DespachoDelDia | null;
  /** Su despacho está confirmado: no se le asignan pedidos nuevos. */
  bloqueado: boolean;
  paradas: ParadaPropuesta[];
  /** La secuencia completa de la ruta ese día (con o sin pedido). */
  ruta_paradas: Array<{ cliente_id: number; nombre: string; direccion: string; nota: string }>;
  paradas_sin_pedido: Array<{ cliente_id: number; nombre: string; direccion: string; nota: string }>;
  ruta_total_paradas: number;
}

export interface PropuestaDia {
  fecha: string;
  dia_semana: number;
  dia_nombre: string;
  programacion: { id: number; nombre: string } | null;
  tipo_canastilla: { id: number; nombre: string; peso_lleno_kg: number | null };
  vehiculos: VehiculoPropuesta[];
  sin_asignar: PedidoPlanificacion[];
  rutas_canceladas: Array<{ clave: string; ruta_id: number; ajuste_id: number; nombre: string; motivo: string; furgon: FurgonResumen | null }>;
  despachos: DespachoDelDia[];
  resumen: { pedidos: number; asignados_en_despacho: number; sin_asignar: number; clientes: number; vehiculos: number };
}

export interface VehiculoAGenerar {
  clave: string;
  furgon: number;
  nombre: string;
  paradas: Array<{ cliente: number | null; pedidos: number[]; canastillas: number }>;
}

export async function consultarDia(fecha: string, tipoCanastilla?: number): Promise<PropuestaDia> {
  const { data } = await api.get<PropuestaDia>("/logistica/planificacion/dia/", {
    params: { fecha, ...(tipoCanastilla ? { tipo_canastilla: tipoCanastilla } : {}) },
  });
  return data;
}

export async function generarDespachos(
  fecha: string,
  tipoCanastilla: number,
  vehiculos: VehiculoAGenerar[],
  /** Pedidos retirados a mano de su vehículo: vuelven a quedar sin asignar. */
  liberar: number[] = []
): Promise<{ despachos: PlanoResumen[]; propuesta: PropuestaDia }> {
  const { data } = await api.post<{ despachos: PlanoResumen[]; propuesta: PropuestaDia }>("/logistica/planificacion/generar/", {
    fecha,
    tipo_canastilla: tipoCanastilla,
    vehiculos,
    liberar,
  });
  return data;
}
