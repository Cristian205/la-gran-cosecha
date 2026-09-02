import type { Paginated } from "../types";
import { api } from "./client";

/**
 * La caja.
 *
 * La asimetría de esta API es la misma que en inventario y por la misma razón:
 * las ventas se LEEN como recurso y se cambian con operaciones con nombre. No
 * existe un `PATCH /ventas/1/ {"estado":"PAGADA"}`, porque cobrar no es escribir
 * un campo — es registrar pagos y mover el inventario en la misma transacción.
 */

export type Busqueda = "rejilla" | "categorias" | "codigo_barras" | "lista";

/** Cómo se comporta la caja de ESTE negocio. Lo decide su perfil. */
export interface PerfilPOS {
  busqueda: Busqueda;
  muestra_imagenes: boolean;
  pide_atributos_en_linea: boolean;
  permite_nota_por_linea: boolean;
  /** Qué panel va al lado del carrito. Lo aportan los módulos. */
  panel_lateral: string | null;
}

export interface MedioPago {
  id: number;
  codigo: string;
  nombre: string;
  tipo: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO" | "OTRO";
  activo: boolean;
  orden: number;
  /** Solo el efectivo se cuenta en el arqueo: lo demás llega al banco. */
  cuenta_en_caja: boolean;
}

export interface Turno {
  id: number;
  ubicacion: number;
  ubicacion_nombre: string;
  abierto_por: string;
  fondo_inicial: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  total_declarado: string | null;
  total_calculado: string | null;
  diferencia: string | null;
  nota_cierre: string;
  esta_abierto: boolean;
}

export interface LineaVenta {
  id: number;
  presentacion: number;
  /** Cómo se llamaba al venderse. No se relee por clave foránea. */
  nombre_congelado: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  atributos: Record<string, string>;
  nota: string;
}

export interface Pago {
  id: number;
  medio: number;
  medio_nombre: string;
  importe: string;
  referencia: string;
  fecha: string;
}

export interface Venta {
  id: number;
  turno: number;
  numero: number;
  estado: "ABIERTA" | "PAGADA" | "ANULADA";
  estado_display: string;
  cliente: number | null;
  cliente_nombre: string;
  subtotal: string;
  descuento: string;
  total: string;
  /** Lo que aportó el panel lateral. Opaco para la caja. */
  contexto: Record<string, unknown>;
  nota: string;
  fecha: string;
  fecha_pago: string | null;
  motivo_anulacion: string;
  lineas: LineaVenta[];
  pagos: Pago[];
}

export interface PanelLateral {
  clave: string;
  nombre: string;
  descripcion: string;
}

/**
 * Como SE VE la caja de este negocio, frente a `PerfilPOS`, que es que HACE.
 *
 * Sale del tema del negocio —el mismo que viste su tienda—, asi que la caja de
 * una boutique es rosa y espaciada y la de una ferreteria gris y apretada sin
 * una sola condicion en esta pantalla.
 */
export interface AspectoPOS {
  /** Variables CSS que se aplican al contenedor de la caja. */
  variables: Record<string, string>;
  /** Donde va el carrito. El servidor ya lo valido contra lo que existe. */
  disposicion: string;
}

export interface ConfiguracionPOS {
  perfil_pos: PerfilPOS;
  aspecto: AspectoPOS;
  turno: Turno | null;
  medios_pago: MedioPago[];
  paneles: PanelLateral[];
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerConfiguracion(): Promise<ConfiguracionPOS> {
  const { data } = await api.get<ConfiguracionPOS>("/pos/configuracion/");
  return data;
}

export async function abrirTurno(fondoInicial: string): Promise<Turno> {
  const { data } = await api.post<Turno>("/pos/turnos/abrir/", {
    fondo_inicial: fondoInicial || "0",
  });
  return data;
}

export async function obtenerArqueo(
  turnoId: number
): Promise<{ fondo_inicial: string; efectivo_esperado: string; ventas: number }> {
  const { data } = await api.get(`/pos/turnos/${turnoId}/arqueo/`);
  return data;
}

export async function cerrarTurno(
  turnoId: number,
  totalDeclarado: string,
  nota: string
): Promise<Turno> {
  const { data } = await api.post<Turno>(`/pos/turnos/${turnoId}/cerrar/`, {
    total_declarado: totalDeclarado,
    nota,
  });
  return data;
}

/**
 * Abre una venta con lo que aporte el panel lateral.
 *
 * `aporte` es opaco para la caja: viaja entero a `Venta.contexto`. La única
 * clave que se saca de ahí es `cliente_id`, y no por capricho — el cliente es
 * una columna de `Venta` desde antes de que existieran los paneles, y dejarlo
 * dentro del JSON obligaría a leer las ventas por cliente rebuscando en un
 * campo sin índice.
 */
export async function abrirVenta(
  aporte: Record<string, unknown> = {}
): Promise<Venta> {
  const { cliente_id, ...contexto } = aporte;
  const { data } = await api.post<Venta>("/pos/ventas/abrir/", {
    cliente_id: (cliente_id as number | undefined) ?? null,
    contexto,
  });
  return data;
}

export async function agregarLinea(
  ventaId: number,
  payload: {
    presentacion_id: number;
    cantidad: string;
    nota?: string;
    atributos?: Record<string, string>;
  }
): Promise<Venta> {
  const { data } = await api.post<Venta>(`/pos/ventas/${ventaId}/lineas/`, payload);
  return data;
}

export async function quitarLinea(ventaId: number, lineaId: number): Promise<Venta> {
  const { data } = await api.delete<Venta>(`/pos/ventas/${ventaId}/lineas/${lineaId}`);
  return data;
}

export async function cobrar(
  ventaId: number,
  pagos: { medio_id: number; importe: string; referencia?: string }[],
  descuento = "0"
): Promise<Venta> {
  const { data } = await api.post<Venta>(`/pos/ventas/${ventaId}/cobrar/`, {
    pagos,
    descuento,
  });
  return data;
}

export async function anularVenta(ventaId: number, motivo: string): Promise<Venta> {
  const { data } = await api.post<Venta>(`/pos/ventas/${ventaId}/anular/`, { motivo });
  return data;
}

export async function obtenerVentasDelTurno(turnoId: number): Promise<Venta[]> {
  const { data } = await api.get<Paginated<Venta> | Venta[]>("/pos/ventas/", {
    params: { turno: turnoId },
  });
  return unwrap(data);
}
