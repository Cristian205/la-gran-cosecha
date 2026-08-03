import type {
  Categoria,
  Cliente,
  Estadisticas,
  HistorialDetallePedido,
  HistorialPrecio,
  Lote,
  LoteDetalle,
  ModuloPermisos,
  Paginated,
  Pedido,
  PedidoDetalle,
  Producto,
  ProductoPendiente,
  ReporteVentas,
  UnidadMedida,
  Usuario,
} from "../types";
import { api } from "./client";

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

// ---------- Estadísticas ----------
export async function obtenerEstadisticas(): Promise<Estadisticas> {
  const { data } = await api.get<Estadisticas>("/admin/stats/");
  return data;
}

export async function obtenerReporteVentas(params: {
  desde: string;
  hasta: string;
}): Promise<ReporteVentas> {
  const { data } = await api.get<ReporteVentas>("/admin/stats/reporte/", {
    params,
  });
  return data;
}

// ---------- Catálogo base ----------
export async function obtenerCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<Paginated<Categoria> | Categoria[]>(
    "/catalog/categories/"
  );
  return unwrap(data);
}

export async function obtenerUnidades(): Promise<UnidadMedida[]> {
  const { data } = await api.get<Paginated<UnidadMedida> | UnidadMedida[]>(
    "/catalog/units/"
  );
  return unwrap(data);
}

// ---------- Productos ----------
export async function obtenerProductos(params?: {
  search?: string;
  categoria?: number;
  estado?: string;
}): Promise<Producto[]> {
  const { data } = await api.get<Paginated<Producto>>("/catalog/products/", {
    params: { ...params, estado: params?.estado ?? "todos", page_size: 200 },
  });
  return unwrap(data);
}

export interface ProductoPayload {
  nombre_producto: string;
  categoria: number;
  unidad_base: number | null;
  tipo_cantidad: string;
  permite_fraccion: boolean;
  estado_producto: boolean;
  presentaciones: {
    id?: number | null;
    nombre_presentacion: string;
    unidad_venta: number;
    factor_conversion: string;
    precio_unitario: string;
  }[];
}

export async function crearProducto(payload: ProductoPayload): Promise<Producto> {
  const { data } = await api.post<Producto>("/catalog/products/", payload);
  return data;
}

export async function actualizarProducto(
  id: number,
  payload: ProductoPayload
): Promise<Producto> {
  const { data } = await api.put<Producto>(`/catalog/products/${id}/`, payload);
  return data;
}

export async function desactivarProducto(id: number): Promise<void> {
  await api.delete(`/catalog/products/${id}/`);
}

export async function obtenerHistorialPrecios(
  productoId: number
): Promise<HistorialPrecio[]> {
  const { data } = await api.get<HistorialPrecio[]>(
    `/catalog/products/${productoId}/historial-precios/`
  );
  return data;
}

export async function subirImagenProducto(
  id: number,
  archivo: File
): Promise<void> {
  const form = new FormData();
  form.append("imagen", archivo);
  await api.post(`/catalog/products/${id}/imagen/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

// ---------- Pedidos ----------
export async function obtenerPedidos(params?: {
  search?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
}): Promise<Pedido[]> {
  const { data } = await api.get<Paginated<Pedido>>("/orders/", {
    params: { ...params, page_size: 100 },
  });
  return unwrap(data);
}

export async function obtenerPedido(id: number): Promise<PedidoDetalle> {
  const { data } = await api.get<PedidoDetalle>(`/orders/${id}/`);
  return data;
}

export interface EditarPedidoPayload {
  detalles: {
    detalle_id: number | null;
    presentacion_id?: number;
    nombre_producto?: string;
    unidad_id?: number;
    categoria_id?: number;
    cantidad: string;
    precio_unitario: string;
  }[];
  observaciones?: string;
}

export async function editarPedido(
  id: number,
  payload: EditarPedidoPayload
): Promise<{ success: boolean; total: string }> {
  const { data } = await api.patch(`/orders/${id}/`, payload);
  return data;
}

export async function entregarPedidos(
  ids: number[]
): Promise<{ success: boolean; actualizados: number; lote_id: number }> {
  const { data } = await api.post("/orders/entregar/", { ids });
  return data;
}

export async function eliminarPedido(id: number): Promise<void> {
  await api.delete(`/orders/${id}/`);
}

export async function obtenerHistorialPedido(
  id: number
): Promise<HistorialDetallePedido[]> {
  const { data } = await api.get<HistorialDetallePedido[]>(
    `/orders/${id}/historial/`
  );
  return data;
}

// ---------- Productos personalizados pendientes de revisión ----------
export async function obtenerProductosPendientes(): Promise<ProductoPendiente[]> {
  const { data } = await api.get<Paginated<ProductoPendiente> | ProductoPendiente[]>(
    "/orders-productos-pendientes/"
  );
  return unwrap(data);
}

export async function aprobarProductoPendiente(
  id: number,
  payload: ProductoPayload,
  presentacionIndex?: number
): Promise<Producto> {
  const { data } = await api.post<Producto>(`/orders-productos-pendientes/${id}/aprobar/`, {
    ...payload,
    ...(presentacionIndex !== undefined ? { presentacion_index: presentacionIndex } : {}),
  });
  return data;
}

export async function rechazarProductoPendiente(id: number): Promise<void> {
  await api.post(`/orders-productos-pendientes/${id}/rechazar/`);
}

// ---------- Lotes de pedidos ----------
export async function obtenerLotes(): Promise<Lote[]> {
  const { data } = await api.get<Paginated<Lote> | Lote[]>("/orders-lotes/", {
    params: { page_size: 200 },
  });
  return unwrap(data);
}

export async function obtenerLote(id: number): Promise<LoteDetalle> {
  const { data } = await api.get<LoteDetalle>(`/orders-lotes/${id}/`);
  return data;
}

// ---------- Clientes ----------
export async function obtenerClientes(search?: string): Promise<Cliente[]> {
  const { data } = await api.get<Paginated<Cliente>>("/clients/", {
    params: { q: search, page_size: 200 },
  });
  return unwrap(data);
}

export interface ClientePayload {
  nombre_cliente: string;
  telefono_cliente?: string;
  direccion_cliente?: string;
}

export async function crearCliente(payload: ClientePayload): Promise<Cliente> {
  const { data } = await api.post<Cliente>("/clients/", payload);
  return data;
}

export async function actualizarCliente(
  id: number,
  payload: ClientePayload
): Promise<Cliente> {
  const { data } = await api.put<Cliente>(`/clients/${id}/`, payload);
  return data;
}

export async function eliminarCliente(id: number): Promise<void> {
  await api.delete(`/clients/${id}/`);
}

// ---------- Usuarios ----------
export async function obtenerUsuarios(): Promise<Usuario[]> {
  const { data } = await api.get<Usuario[]>("/auth/users/");
  return data;
}

export interface CrearUsuarioResp {
  success: boolean;
  message: string;
  password_temporal: string;
  usuario: Usuario;
}

export async function crearUsuario(payload: {
  email: string;
  nombre: string;
  rol: string;
}): Promise<CrearUsuarioResp> {
  const { data } = await api.post<CrearUsuarioResp>("/auth/users/", payload);
  return data;
}

export async function eliminarUsuario(id: number): Promise<void> {
  await api.delete(`/auth/users/${id}/`);
}

export interface EditarUsuarioPayload {
  nombre_usuario?: string;
  rol_usuario?: string;
  is_active?: boolean;
}

export async function actualizarUsuario(
  id: number,
  payload: EditarUsuarioPayload
): Promise<Usuario> {
  const { data } = await api.patch<Usuario>(`/auth/users/${id}/`, payload);
  return data;
}

export async function obtenerPermisosDisponibles(): Promise<ModuloPermisos[]> {
  const { data } = await api.get<ModuloPermisos[]>("/auth/permisos-disponibles/");
  return data;
}

export async function obtenerPermisosUsuario(id: number): Promise<string[]> {
  const { data } = await api.get<{ permisos: string[] }>(`/auth/users/${id}/permisos/`);
  return data.permisos;
}

export async function actualizarPermisosUsuario(
  id: number,
  permisos: string[]
): Promise<void> {
  await api.put(`/auth/users/${id}/permisos/`, { permisos });
}

// ---------- Facturas PDF ----------
function abrirPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  // Libera el objeto URL luego de que el navegador tuvo tiempo de abrirlo.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function descargarPdfPedido(id: number): Promise<void> {
  const { data } = await api.get(`/orders/${id}/pdf/`, { responseType: "blob" });
  abrirPdfBlob(data);
}

export async function descargarPdfPedidosLote(ids: number[]): Promise<void> {
  const { data } = await api.get(`/orders/pdf-lote/`, {
    params: { ids: ids.join(",") },
    responseType: "blob",
  });
  abrirPdfBlob(data);
}
