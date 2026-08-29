export interface Categoria {
  id: number;
  nombre_categoria: string;
  abreviatura: string;
  orden: number;
  estado_categoria: boolean;
  imagen_url: string | null;
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
  /** Precio más bajo entre las presentaciones activas; lo anota el backend. */
  precio_desde: string | null;
  presentaciones: Presentacion[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UnidadMedida {
  id: number;
  nombre_unidad: string;
  abreviatura_unidad: string;
}

export interface ItemCarrito {
  productoId: number;
  productoNombre: string;
  imagenUrl: string | null;
  presentacionId: number;
  presentacionNombre: string;
  precioUnitario: number;
  cantidad: number;
  permiteFraccion: boolean;
  tipoCantidad: string;
}

export interface ItemPersonalizado {
  id: string;
  nombre: string;
  cantidad: number;
  unidadId: number | null;
  unidadNombre: string;
  categoriaId: number;
  categoriaNombre: string;
}

export interface RespuestaPedido {
  success: boolean;
  pedido_id: number;
  total: number;
  estado: string;
}

export interface SiteConfig {
  /** El nombre del negocio. Lo devuelve el backend desde StoreSettings. */
  nombre_empresa: string;
  logo_url: string | null;
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
}

export interface Testimonio {
  id: number;
  nombre: string;
  rol: string;
  texto: string;
  estrellas: number;
}

export interface TrustBadge {
  id: number;
  tipo: "insignia" | "estadistica";
  icono: "leaf" | "truck" | "shield" | "users";
  valor: string;
  etiqueta: string;
}

export interface BeneficioComercial {
  id: number;
  icono: "truck" | "clock" | "package" | "wallet" | "headset" | "check" | "shield" | "users";
  titulo: string;
  texto: string;
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
}
