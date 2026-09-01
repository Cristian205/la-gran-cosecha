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

export async function crearCategoria(
  payload: Omit<Categoria, "id" | "imagen_url">,
  imagen?: File | null
): Promise<Categoria> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => form.append(key, String(value)));
  if (imagen) form.append("imagen", imagen);
  const { data } = await api.post<Categoria>("/catalog/categories/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function actualizarCategoria(
  id: number,
  payload: Omit<Categoria, "id" | "imagen_url">,
  imagen?: File | null
): Promise<Categoria> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => form.append(key, String(value)));
  if (imagen) form.append("imagen", imagen);
  const { data } = await api.patch<Categoria>(`/catalog/categories/${id}/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function eliminarCategoria(id: number): Promise<void> {
  await api.delete(`/catalog/categories/${id}/`);
}

export async function obtenerUnidades(): Promise<UnidadMedida[]> {
  const { data } = await api.get<Paginated<UnidadMedida> | UnidadMedida[]>(
    "/catalog/units/"
  );
  return unwrap(data);
}

// ---------- Productos ----------
/** Catálogo completo, para los selectores de producto que lo cargan de una vez. */
export async function obtenerProductos(params?: {
  search?: string;
  categoria?: number;
  estado?: string;
}): Promise<Producto[]> {
  const { data } = await api.get<Paginated<Producto>>("/catalog/products/", {
    params: { ...params, estado: params?.estado ?? "todos", page_size: 500 },
  });
  return unwrap(data);
}

export interface PaginaProductos {
  resultados: Producto[];
  total: number;
}

/**
 * Una página del catálogo. Devuelve además `total` (el `count` de la API) para
 * que la vista pueda mostrar cuántos productos hay en total, no solo los de la
 * página que está viendo.
 */
export async function obtenerPaginaProductos(params: {
  search?: string;
  categoria?: number;
  estado?: string;
  page: number;
  page_size: number;
}): Promise<PaginaProductos> {
  const { data } = await api.get<Paginated<Producto> | Producto[]>(
    "/catalog/products/",
    { params: { ...params, estado: params.estado ?? "todos" } }
  );
  return Array.isArray(data)
    ? { resultados: data, total: data.length }
    : { resultados: data.results, total: data.count };
}

export interface ProductoPayload {
  nombre_producto: string;
  categoria: number;
  unidad_base: number | null;
  tipo_cantidad: string;
  permite_fraccion: boolean;
  estado_producto: boolean;
  controla_stock: boolean;
  codigo_barras: string;
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

/**
 * Los navegadores solo dejan abrir una pestaña si el `window.open` sale del
 * clic del usuario. Como el PDF tarda en llegar, la pestaña se abre vacía
 * antes de pedirlo y se rellena al terminar; si aun así el bloqueador la
 * impide, el PDF se ofrece como descarga en lugar de perderse en silencio.
 */
function abrirPdfBlob(blob: Blob, ventana: Window | null, nombre: string) {
  const url = URL.createObjectURL(blob);
  if (ventana && !ventana.closed) {
    ventana.location.href = url;
  } else {
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }
  // Libera el objeto URL luego de que el navegador tuvo tiempo de abrirlo.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Cuando el error viene de una petición `blob`, el mensaje del backend
 *  llega como Blob y hay que leerlo para poder mostrarlo. */
async function normalizarErrorPdf(err: unknown): Promise<never> {
  const respuesta = (err as { response?: { data?: unknown } })?.response;
  if (respuesta?.data instanceof Blob) {
    try {
      const texto = await respuesta.data.text();
      respuesta.data = texto.trim().startsWith("{") ? JSON.parse(texto) : texto;
    } catch {
      /* se deja el Blob tal cual y el llamador usará su mensaje por defecto */
    }
  }
  throw err;
}

export async function descargarPdfPedido(id: number): Promise<void> {
  const ventana = window.open("", "_blank");
  try {
    const { data } = await api.get(`/orders/${id}/pdf/`, { responseType: "blob" });
    abrirPdfBlob(data, ventana, `Pedido_${id}.pdf`);
  } catch (err) {
    ventana?.close();
    return normalizarErrorPdf(err);
  }
}

export async function descargarPdfPedidosLote(ids: number[]): Promise<void> {
  const ventana = window.open("", "_blank");
  try {
    const { data } = await api.get(`/orders/pdf-lote/`, {
      params: { ids: ids.join(",") },
      responseType: "blob",
    });
    abrirPdfBlob(data, ventana, `Pedidos_${ids.join("-")}.pdf`);
  } catch (err) {
    ventana?.close();
    return normalizarErrorPdf(err);
  }
}
