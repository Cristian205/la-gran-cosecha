export type NodoSidebar =
  | { tipo: "item"; clave: string }
  | { tipo: "grupo"; id: string; titulo: string; items: string[] };

export interface Usuario {
  id: number;
  uid: string;
  nombre_usuario: string;
  email_usuario: string;
  rol_usuario: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  es_administrador: boolean;
  debe_cambiar_password: boolean;
  permisos: string[];
  ultimo_login_exitoso: string | null;
  fecha_creacion: string;
  sidebar_layout: NodoSidebar[] | null;
  notificaciones_silenciadas: string[];
  /** Rol dentro del negocio activo. Es el que decide el acceso; `rol_usuario`
   *  se conserva como etiqueta para la interfaz. */
  rol_en_negocio: string | null;
  /** Los negocios en los que trabaja esta persona. Solo viene en `/auth/me/`
   *  y en el login: en un listado del equipo llega como null. */
  negocios: Negocio[] | null;
}

export interface Negocio {
  uuid: string;
  slug: string;
  nombre: string;
  rol: string;
  activo: boolean;
}

export interface PermisoItem {
  codename: string;
  etiqueta: string;
}

export interface ModuloPermisos {
  modulo: string;
  permisos: PermisoItem[];
}

export interface Categoria {
  id: number;
  nombre_categoria: string;
  abreviatura: string;
  orden: number;
  estado_categoria: boolean;
  imagen_url: string | null;
}

export interface UnidadMedida {
  id: number;
  nombre_unidad: string;
  abreviatura_unidad: string;
  estado_unidad: boolean;
}

export interface HistorialPrecio {
  id: number;
  presentacion: number;
  presentacion_nombre: string;
  precio_anterior: string;
  precio_nuevo: string;
  usuario: number;
  usuario_nombre: string;
  usuario_rol:string;
  fecha_cambio: string;
}

export interface Presentacion {
  id: number;
  nombre_presentacion: string;
  unidad_venta: number;
  unidad_venta_nombre: string;
  factor_conversion: string;
  precio_unitario: string;
  estado_presentacion: boolean;
}

export interface Producto {
  id: number;
  codigo_producto: string;
  nombre_producto: string;
  categoria: number;
  categoria_nombre: string;
  unidad_base: number | null;
  unidad_base_nombre: string | null;
  tipo_cantidad: string;
  permite_fraccion: boolean;
  estado_producto: boolean;
  imagen_url: string | null;
  orden: number;
  presentaciones: Presentacion[];
}

export interface Pedido {
  id: number;
  cliente: number | null;
  cliente_nombre: string;
  estado: string;
  total_pedido: string;
  fecha_pedido: string;
  num_items: number;
}

export interface DetallePedido {
  id: number;
  detalle_id: number;
  presentacion_id: number | null;
  producto_id: number | null;
  presentacion_nombre: string | null;
  nombre_producto: string;
  categoria: string;
  unidad_id: number | null;
  unidad_nombre: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  personalizado: boolean;
  estado_revision: "PENDIENTE" | "ACEPTADO" | "RECHAZADO" | null;
}

export interface ProductoPendiente {
  id: number;
  nombre_personalizado: string;
  cantidad: string;
  precio_unitario: string;
  unidad_id: number | null;
  unidad_nombre: string;
  categoria_id: number | null;
  categoria_nombre: string;
  pedido: number;
  cliente_nombre: string;
  fecha_modificacion: string;
}

export interface PedidoDetalle {
  id: number;
  cliente: number | null;
  cliente_nombre: string;
  estado: string;
  total_pedido: string;
  observaciones: string | null;
  fecha_pedido: string;
  detalles: DetallePedido[];
}

export interface HistorialDetallePedido {
  id: number;
  detalle: number;
  producto_nombre: string;
  campo: string;
  campo_etiqueta: string;
  valor_anterior: string;
  valor_nuevo: string;
  usuario: number;
  usuario_nombre: string;
  fecha: string;
  motivo: string | null;
}

export interface Lote {
  id: number;
  tipo: "IMPRESION" | "ENTREGA";
  tipo_display: string;
  usuario: number;
  usuario_nombre: string;
  cantidad_pedidos: number;
  total_lote: string;
  fecha_creacion: string;
}

export interface LoteDetalle extends Lote {
  pedidos: Pedido[];
}

export interface Cliente {
  id: number;
  nombre_cliente: string;
  telefono_cliente: string;
  direccion_cliente: string;
  fecha_registro_cliente: string;
  total_pedidos: number;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SiteConfig {
  logo_url: string | null;
  nombre_empresa: string;
  color_primario: string;
  color_primario_texto: string;
  color_secundario: string;
  color_secundario_texto: string;
  color_fondo: string;
  color_superficie: string;
  color_texto: string;
  fuente: string;
  radio_boton: string;
  ancho_buscador: number;
  espaciado_navbar: number;
  whatsapp_numero: string;
  whatsapp_mensaje_pedido: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  horario: string;
  historia: string;
  mision: string;
  paso1_titulo: string;
  paso1_texto: string;
  paso2_titulo: string;
  paso2_texto: string;
  paso3_titulo: string;
  paso3_texto: string;
  cotizacion_titulo: string;
  cotizacion_texto: string;
  cta_final_titulo: string;
  cta_final_texto: string;
  factura_eslogan: string;
  factura_nit: string;
  factura_proveedor: string;
  factura_telefono: string;
  factura_direccion: string;
}

export interface PromoBanner {
  id: number;
  imagen_url: string | null;
  etiqueta: string;
  titulo: string;
  texto: string;
  cta_texto: string;
  cta_href: string;
  orden: number;
  activo: boolean;
}

export interface Testimonio {
  id: number;
  nombre: string;
  rol: string;
  texto: string;
  estrellas: number;
  orden: number;
  activo: boolean;
}

export interface TrustBadge {
  id: number;
  tipo: "insignia" | "estadistica";
  icono: "leaf" | "truck" | "shield" | "users";
  valor: string;
  etiqueta: string;
  orden: number;
  activo: boolean;
}

export interface BeneficioComercial {
  id: number;
  icono: "truck" | "clock" | "package" | "wallet" | "headset" | "check" | "shield" | "users" | "leaf" | "sprout" | "droplet" | "shopping-bag" | "apple" | "badge-check" | "handshake" | "headphones" | "user-check";
  titulo: string;
  texto: string;
  orden: number;
  activo: boolean;
}

export interface OfertaProducto {
  id: number;
  presentacion: number;
  presentacion_detalle: Presentacion;
  producto_id: number;
  producto_nombre: string;
  producto_imagen_url: string | null;
  producto_categoria: number;
  producto_categoria_nombre: string;
  producto_permite_fraccion: boolean;
  producto_tipo_cantidad: string;
  precio_normal: string;
  precio_oferta: string;
  porcentaje_ahorro: number;
  fecha_fin: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface Estadisticas {
  caja_hoy: number;
  eficiencia: number;
  ventas_mes: number;
  crecimiento_mensual: number;
  ventas_anio: number;
  progreso_meta: number;
  pedidos_pendientes: number;
  total_clientes: number;
  total_productos: number;
  total_categorias: number;
  total_usuarios: number;
  ventas_7dias: { labels: string[]; data: number[] };
  top_productos: { nombre: string; cantidad: number }[];
  productos_por_categoria: { categoria: string; total: number }[];
  actividad_reciente: { tipo: string; msj: string }[];
  ultimos_pedidos: {
    id: number;
    cliente: string;
    estado: string;
    total: string;
    num_items: number;
    fecha: string;
  }[];
}

export interface ReportePedidoFila {
  id: number;
  fecha: string;
  cliente: string;
  estado: string;
  num_items: number;
  total: string;
}

export interface ReporteVentas {
  desde: string;
  hasta: string;
  total_ventas: number;
  total_pedidos: number;
  ticket_promedio: number;
  total_unidades_vendidas: number;
  clientes_nuevos: number;
  ventas_por_dia: { labels: string[]; data: number[] };
  ventas_por_categoria: { categoria: string; total: number }[];
  top_productos: { nombre: string; cantidad: number; total: number }[];
  pedidos: ReportePedidoFila[];
}

export interface Archivo {
  id: number;
  url: string | null;
  nombre_original: string;
  tipo: "IMAGEN" | "VIDEO" | "DOCUMENTO";
  content_type: string;
  tamano: number;
  ancho: number | null;
  alto: number | null;
  fecha_creacion: string;
  subido_por_nombre: string;
}

export interface Notificacion {
  id: number;
  tipo: "PEDIDO_NUEVO" | "CLIENTE_NUEVO" | "PRODUCTO_PERSONALIZADO" | "SISTEMA";
  titulo: string;
  mensaje: string;
  enlace: string;
  leida: boolean;
  fecha_creacion: string;
}
