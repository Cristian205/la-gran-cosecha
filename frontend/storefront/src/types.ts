export interface Categoria {
  id: number;
  nombre_categoria: string;
  abreviatura: string;
  orden: number;
  estado_categoria: boolean;
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
  logo_url: string | null;
  color_primario: string;
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
  icono: "leaf" | "truck" | "shield" | "users";
  valor: string;
  etiqueta: string;
}
