import { api } from "./client";
import type { DespachoDelDia, FurgonResumen, PedidoPlanificacion, ProductoConsolidado } from "./logistica";

/**
 * Lotes de despacho: la preparación del despacho de un día.
 *
 * El recorrido es el mismo que en el servidor (`apps/logistica/lotes.py`):
 * se eligen los pedidos del día desde la tabla de pedidos, el servidor los
 * reparte entre las turbos que salen esa fecha, el administrador corrige el
 * reparto, se generan los planos de carga (el constructor 3D), se revisa el
 * resumen, se confirma y se baja la documentación.
 *
 * Los productos y los pedidos los calcula SIEMPRE el servidor con las reglas
 * de carga: aquí no se estima nada que allí no se pueda reproducir.
 */

export type EstadoLote =
  | "PREPARACION"
  | "PREPARADO"
  | "CONFIRMADO"
  | "EN_RUTA"
  | "ENTREGADO"
  | "ANULADO";

/** Dónde empieza o termina el recorrido de un vehículo. */
export interface PuntoRecorrido {
  nombre: string;
  direccion: string;
}

/** Una parada del lote: un cliente con sus pedidos, o una entrega extraordinaria. */
export interface ParadaLote {
  /** `c<cliente>`, `p<pedido>` (pedido sin cliente) o `x<n>` (extraordinaria). */
  key: string;
  cliente: number | null;
  nombre: string;
  direccion: string;
  telefono?: string;
  /** Posición en la secuencia de entrega (1 = primera). */
  orden: number;
  pedidos: PedidoPlanificacion[];
  productos: ProductoConsolidado[];
  /** Las que se van a cargar: fijadas a mano o estimadas con las reglas. */
  canastillas_calculadas: number;
  canastillas: number;
  /** Las canastillas las fijó alguien, no las reglas de carga. */
  manual: boolean;
  peso_kg: number | null;
  sin_regla: string[];
  /** El cliente está en la ruta de este vehículo ese día. */
  en_ruta: boolean;
  nota_ruta: string;
  /** No sale de un pedido: la agregó el administrador. */
  extra: boolean;
  nota: string;
  /** El cliente no está en la ruta del vehículo donde quedó. */
  fuera_de_ruta?: boolean;
}

export interface MetricasVehiculo {
  canastillas: number;
  pedidos: number;
  paradas: number;
  capacidad: number | null;
  tope: number | null;
  peso_kg: number | null;
  carga_util_kg: number | null;
  pct: number;
  /** Supera capacidad o carga útil: el despacho no se podrá confirmar. */
  exceso: string | null;
  /** Falta el vehículo o sus medidas: la ruta no se puede despachar. */
  incompleta: string | null;
}

export interface VehiculoLote {
  clave: string;
  ruta_id: number | null;
  ajuste_id: number | null;
  origen: "ruta" | "ajuste" | "extra" | "despacho" | "manual";
  nombre: string;
  color: string;
  furgon: FurgonResumen | null;
  capacidad: {
    canastillas: number;
    posiciones: number;
    niveles: number;
    carga_util_kg: number | null;
    tope_por_peso: number | null;
    errores: string[];
  } | null;
  ruta_paradas: Array<{ cliente_id: number; nombre: string; direccion: string; nota: string }>;
  paradas_sin_pedido: Array<{ cliente_id: number; nombre: string; direccion: string; nota: string }>;
  inicio: PuntoRecorrido | null;
  fin: PuntoRecorrido | null;
  paradas: ParadaLote[];
  metricas: MetricasVehiculo;
  despacho: DespachoDelDia | null;
}

export interface ResumenLote {
  pedidos_total: number;
  pedidos_asignados: number;
  pedidos_sin_asignar: number;
  clientes: number;
  vehiculos: number;
  vehiculos_disponibles: number;
  paradas: number;
  paradas_extra: number;
  canastillas: number;
  capacidad: number;
  peso_kg: number | null;
  despachos: number;
  despachos_confirmados: number;
  /** Impiden confirmar. */
  errores: string[];
  /** Se muestran pero no bloquean. */
  advertencias: string[];
  puede_confirmar: boolean;
}

export interface EventoLote {
  id: number;
  tipo: "CREADO" | "DISTRIBUIDO" | "AJUSTE" | "GENERADO" | "CONFIRMADO" | "ESTADO" | "ANULADO" | "DOCUMENTO";
  tipo_etiqueta: string;
  detalle: string;
  datos: Record<string, unknown>;
  usuario: string;
  cuando: string;
}

export interface Lote {
  id: number;
  numero: number;
  nombre: string;
  fecha: string;
  dia_nombre: string;
  estado: EstadoLote;
  estado_etiqueta: string;
  /** Todavía se puede cambiar el reparto. */
  abierto: boolean;
  notas: string;
  programacion: { id: number; nombre: string } | null;
  rutas_canceladas: Array<{ clave: string; nombre: string; motivo: string; ajuste_id: number }>;
  tipo_canastilla: { id: number; nombre: string; peso_lleno_kg: number | null };
  vehiculos: VehiculoLote[];
  sin_asignar: Array<PedidoPlanificacion & { motivo: string }>;
  /** Lo que el motor hizo por un motivo que no se ve en el resultado. */
  notas_motor: string[];
  despachos: DespachoDelDia[];
  resumen: ResumenLote;
  eventos: EventoLote[];
  creado_por: string;
  confirmado_por: string;
  confirmado_en: string | null;
  creado: string;
  actualizado: string;
}

export interface LoteResumido {
  id: number;
  numero: number;
  nombre: string;
  fecha: string;
  estado: EstadoLote;
  estado_etiqueta: string;
  pedidos: number;
  vehiculos: number;
  canastillas: number;
  despachos: number;
  despachos_confirmados: number;
  tipo_canastilla: number;
  creado_por: string;
  creado: string;
  actualizado: string;
}

/** Los pedidos que todavía se pueden planificar. */
export interface Elegibles {
  fechas: Array<{ fecha: string; dia_nombre: string; pedidos: number; clientes: number }>;
  fecha?: string;
  dia_nombre?: string;
  pedidos: PedidoPlanificacion[];
  resumen?: { pedidos: number; clientes: number; canastillas: number };
}

/** El reparto tal como se envía al guardar las correcciones. */
export interface DistribucionPayload {
  vehiculos: Array<{
    clave: string;
    furgon: number;
    nombre: string;
    color: string;
    inicio: PuntoRecorrido | null;
    fin: PuntoRecorrido | null;
    paradas: Array<{
      cliente: number | null;
      pedidos: number[];
      canastillas: number;
      manual: boolean;
      nota: string;
      extra: boolean;
      nombre?: string;
      direccion?: string;
    }>;
  }>;
}

export type DocumentoLote = "planos" | "productos" | "facturas" | "todo";

export const ETIQUETAS_DOCUMENTO: Record<DocumentoLote, string> = {
  planos: "Planos de carga y descarga",
  productos: "Relación de productos por parada",
  facturas: "Facturas de los pedidos",
  todo: "Documentación completa",
};

const RAIZ = "/logistica/lotes/";

export async function listarLotes(params: { fecha?: string; estado?: string } = {}): Promise<LoteResumido[]> {
  const { data } = await api.get<LoteResumido[]>(RAIZ, { params });
  return data;
}

export async function obtenerLote(id: number): Promise<Lote> {
  const { data } = await api.get<Lote>(`${RAIZ}${id}/`);
  return data;
}

export async function consultarElegibles(fecha?: string): Promise<Elegibles> {
  const { data } = await api.get<Elegibles>(`${RAIZ}elegibles/`, { params: fecha ? { fecha } : {} });
  return data;
}

export async function crearLote(payload: {
  fecha: string;
  pedidos: number[];
  tipo_canastilla: number;
  nombre?: string;
}): Promise<Lote> {
  const { data } = await api.post<Lote>(RAIZ, payload);
  return data;
}

export async function editarLote(id: number, payload: { nombre?: string; notas?: string }): Promise<Lote> {
  const { data } = await api.patch<Lote>(`${RAIZ}${id}/`, payload);
  return data;
}

export async function guardarDistribucion(id: number, payload: DistribucionPayload): Promise<Lote> {
  const { data } = await api.put<Lote>(`${RAIZ}${id}/distribucion/`, payload);
  return data;
}

export async function redistribuirLote(id: number): Promise<Lote> {
  const { data } = await api.post<Lote>(`${RAIZ}${id}/redistribuir/`);
  return data;
}

export async function cambiarPedidosLote(
  id: number,
  cambios: { agregar?: number[]; quitar?: number[] }
): Promise<Lote> {
  const { data } = await api.post<Lote>(`${RAIZ}${id}/pedidos/`, cambios);
  return data;
}

export async function generarDespachosLote(id: number): Promise<Lote> {
  const { data } = await api.post<Lote>(`${RAIZ}${id}/generar/`);
  return data;
}

export async function consultarResumenLote(id: number): Promise<ResumenLote> {
  const { data } = await api.get<ResumenLote>(`${RAIZ}${id}/resumen/`);
  return data;
}

export async function confirmarLote(id: number): Promise<Lote> {
  const { data } = await api.post<Lote>(`${RAIZ}${id}/confirmar/`);
  return data;
}

export async function cambiarEstadoLote(id: number, estado: EstadoLote): Promise<Lote> {
  const { data } = await api.post<Lote>(`${RAIZ}${id}/estado/`, { estado });
  return data;
}

export async function anularLote(id: number, motivo: string): Promise<Lote> {
  const { data } = await api.post<Lote>(`${RAIZ}${id}/anular/`, { motivo });
  return data;
}

/** La documentación del lote en PDF (pasa por el cliente con sesión). */
export async function descargarDocumentoLote(id: number, doc: DocumentoLote): Promise<Blob> {
  const { data } = await api.get(`${RAIZ}${id}/pdf/`, { params: { doc }, responseType: "blob" });
  return data as Blob;
}
