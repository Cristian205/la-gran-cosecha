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
  Presentacion,
  PanelEstadisticas,
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

/** Todo el dashboard de un período en una sola petición (ver `PanelEstadisticasView`). */
export async function obtenerPanel(params: { desde: string; hasta: string }): Promise<PanelEstadisticas> {
  const { data } = await api.get<PanelEstadisticas>("/admin/stats/panel/", { params });
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

export async function crearUnidad(datos: {
  nombre_unidad: string;
  abreviatura_unidad: string;
}): Promise<UnidadMedida> {
  const { data } = await api.post<UnidadMedida>("/catalog/units/", datos);
  return data;
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
  /** Opcional: al editar un producto existente el panel ya no lo manda
   *  (cada presentación se guarda por su endpoint) y el servidor no las toca. */
  presentaciones?: PresentacionAnidada[];
}

/** Una presentación dentro del guardado anidado del producto. */
export interface PresentacionAnidada {
  id?: number | null;
  nombre_presentacion: string;
  unidad_venta: number;
  factor_conversion: string;
  precio_unitario: string;
  cantidad_minima?: string;
  incremento_cantidad?: string;
  decimales_cantidad?: number;
  estado_presentacion?: boolean;
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

/** Cambia solo los campos enviados; no toca las presentaciones. */
export async function actualizarProductoParcial(
  id: number,
  cambios: Partial<Omit<ProductoPayload, "presentaciones">>
): Promise<Producto> {
  const { data } = await api.patch<Producto>(`/catalog/products/${id}/`, cambios);
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

/** La foto de una presentación concreta (el bulto, la libra…). */
export async function subirImagenPresentacion(id: number, archivo: File): Promise<void> {
  const form = new FormData();
  form.append("imagen", archivo);
  await api.post(`/catalog/presentations/${id}/imagen/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function quitarImagenPresentacion(id: number): Promise<void> {
  await api.delete(`/catalog/presentations/${id}/imagen/`);
}

// ---------- Presentaciones comerciales (una a una) ----------
export interface PresentacionPayload {
  producto: number;
  nombre_presentacion: string;
  unidad_venta: number;
  precio_unitario: string;
  factor_conversion: string;
  cantidad_minima: string;
  incremento_cantidad: string;
  decimales_cantidad: number;
  estado_presentacion: boolean;
  /** La versión leída; si otra persona guardó entretanto, el servidor da 409. */
  version?: number;
}

/** Todas las presentaciones del producto, activas e inactivas, en su orden. */
export async function obtenerPresentaciones(productoId: number): Promise<Presentacion[]> {
  const { data } = await api.get<Presentacion[]>("/catalog/presentations/", {
    params: { producto: productoId },
  });
  return data;
}

export async function crearPresentacion(payload: PresentacionPayload): Promise<Presentacion> {
  const { data } = await api.post<Presentacion>("/catalog/presentations/", payload);
  return data;
}

export async function actualizarPresentacion(
  id: number,
  cambios: Partial<PresentacionPayload>
): Promise<Presentacion> {
  const { data } = await api.patch<Presentacion>(`/catalog/presentations/${id}/`, cambios);
  return data;
}

export async function reordenarPresentaciones(
  productoId: number,
  ids: number[]
): Promise<Presentacion[]> {
  const { data } = await api.post<Presentacion[]>("/catalog/presentations/reordenar/", {
    producto: productoId,
    ids,
  });
  return data;
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

/**
 * Cuántos pedidos cumplen los filtros, sin traerlos: pide una página de un
 * solo registro y lee el `count` de la paginación. Para los indicadores, que
 * con `obtenerPedidos` se quedaban en los 100 más recientes.
 */
export async function contarPedidos(params?: {
  estado?: string;
  desde?: string;
  hasta?: string;
}): Promise<number> {
  const { data } = await api.get<Paginated<Pedido> | Pedido[]>("/orders/", {
    params: { ...params, page_size: 1 },
  });
  return Array.isArray(data) ? data.length : data.count;
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

/** Cuántos lotes hay en total (la lista de `obtenerLotes` llega hasta 200). */
export async function contarLotes(): Promise<number> {
  const { data } = await api.get<Paginated<Lote> | Lote[]>("/orders-lotes/", {
    params: { page_size: 1 },
  });
  return Array.isArray(data) ? data.length : data.count;
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

/**
 * Todos los clientes (o todos los que coinciden con `search`), recorriendo las
 * páginas. `obtenerClientes` se queda en los primeros 200: suficiente para un
 * selector, pero los indicadores y filtros de la vista de Clientes necesitan
 * la base completa para no mentir cuando el negocio crece.
 */
export async function obtenerTodosLosClientes(search?: string): Promise<Cliente[]> {
  const todos: Cliente[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<Paginated<Cliente> | Cliente[]>("/clients/", {
      params: { q: search || undefined, page_size: 500, page },
    });
    if (Array.isArray(data)) return data;
    todos.push(...data.results);
    if (!data.next) return todos;
  }
}

export interface ClientePayload {
  nombre_cliente: string;
  telefono_cliente?: string;
  direccion_cliente?: string;
  documento_cliente?: string;
  /** El equipo puede registrar el consentimiento que el cliente dio por teléfono o en persona. */
  acepta_whatsapp?: boolean;
  /** Solo las alertas que cambian: `{código: true/false}`. */
  alertas?: Record<string, boolean>;
}

/** Una alerta que la plataforma puede enviarle a un cliente (apps/orders/alertas_cliente.py). */
export interface AlertaCliente {
  codigo: string;
  tipo: "UTILIDAD" | "MARKETING";
  canal: "WHATSAPP" | "CORREO";
  por_defecto: boolean;
  nombre: string;
  descripcion: string;
}

/** Lo que ha sido un cliente para el negocio (apps/orders/hoja_de_vida.py). Montos como texto decimal. */
export interface HojaDeVidaCliente {
  cliente_desde: string | null;
  dias_como_cliente: number;
  total_pedidos: number;
  valor_total: string;
  ticket_promedio: string | null;
  primer_pedido: string | null;
  ultimo_pedido: string | null;
  dias_desde_ultimo: number | null;
  frecuencia_dias: number | null;
  dia_favorito: { dia: string; veces: number } | null;
  pedido_mayor: { id: number; total: string; fecha: string } | null;
  estados: Record<string, number>;
  productos_favoritos: { nombre: string; veces: number }[];
  productos_distintos: number;
  lineas_fuera_de_catalogo: number;
  relacion: { codigo: "SIN_PEDIDOS" | "NUEVO" | "FRECUENTE" | "OCASIONAL" | "INACTIVO"; etiqueta: string; regla: string };
  hitos: { fecha: string; tipo: string; texto: string; valor?: string }[];
  pedidos_recientes: {
    id: number;
    fecha: string;
    estado: string;
    estado_etiqueta: string;
    total: string;
    productos: number;
  }[];
}

export async function obtenerHojaDeVidaCliente(id: number): Promise<HojaDeVidaCliente> {
  const { data } = await api.get<HojaDeVidaCliente>(`/clients/${id}/hoja-de-vida/`);
  return data;
}

export async function obtenerAlertasCliente(): Promise<AlertaCliente[]> {
  const { data } = await api.get<AlertaCliente[]>("/clients/alertas/");
  return data;
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
