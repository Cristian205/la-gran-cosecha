export interface Permiso {
  id: number;
  modulo: string;
  codename: string;
  etiqueta: string;
  descripcion: string;
  orden: number;
  activo: boolean;
}

export interface Plan {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  precio_mensual: string;
  moneda: string;
  /** Los codenames que este plan concede. Es la fila de la matriz. */
  permisos: string[];
  limites: Record<string, number | null>;
  orden: number;
  activo: boolean;
  es_predeterminado: boolean;
  /** Cuántas empresas lo tienen: decide si el plan se puede retirar. */
  negocios: number;
}

export interface Negocio {
  id: number;
  uuid: string;
  slug: string;
  nombre: string;
  estado: string;
  fecha_creacion: string;
  plan: { slug: string; nombre: string } | null;
  estado_suscripcion: string | null;
  dominios: string[];
  usuarios: number;
}

export interface Resumen {
  negocios_total: number;
  negocios_por_estado: Record<string, number>;
  planes: { plan: string; negocios: number }[];
  permisos_activos: number;
}

export interface UsuarioPlataforma {
  id: number;
  nombre_usuario: string;
  email_usuario: string;
  es_staff_plataforma?: boolean;
}
