/**
 * Los tipos que devuelve la API de la plataforma.
 *
 * Son un reflejo literal de los serializadores de `apps/billing`. Nada de lo
 * que hay aquí se inventa: si un dato no aparece en esta lista, el panel no
 * puede mostrarlo todavía y la interfaz lo dice en vez de rellenarlo.
 */

export interface Permiso {
  id: number;
  producto: number | null;
  modulo: string;
  codename: string;
  etiqueta: string;
  descripcion: string;
  orden: number;
  activo: boolean;
}

/** Las claves de `Plan.limites` que el backend conoce hoy. */
export type ClaveLimite =
  | "max_productos"
  | "max_usuarios"
  | "max_dominios"
  | "max_almacenamiento_mb";

export type EstadoComercial = "BORRADOR" | "ACTIVO" | "ARCHIVADO";

export type Periodicidad =
  | "UNICO"
  | "MENSUAL"
  | "BIMESTRAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL";

export interface Producto {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  icono: string;
  estado: EstadoComercial;
  orden: number;
  /** Cuantos permisos agrupa. */
  permisos: number;
  /** Cuantos planes lo conceden: decide si se puede archivar. */
  planes: number;
}

export interface Caracteristica {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  producto: number | null;
  producto_nombre?: string;
  orden: number;
  activo: boolean;
}

export interface TipoLimite {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  unidad: "UNIDAD" | "MB" | "PETICIONES";
  por_periodo: boolean;
  valor_por_defecto: number | null;
  /** Si la plataforma sabe medir el consumo, o solo fijar el tope. */
  medido: boolean;
  orden: number;
  activo: boolean;
}

export interface PrecioPlan {
  id: number;
  plan: number;
  moneda: string;
  periodicidad: Periodicidad;
  importe: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  notas: string;
  esta_vigente: boolean;
}

/** Un limite ya resuelto: el valor y si lo fija el plan o lo hereda. */
export interface LimiteEfectivo {
  valor: number | null;
  propio: boolean;
}

export interface Plan {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  /** Calculados del precio vigente; el importe real vive en `precios`. */
  precio_mensual: string;
  moneda: string;
  precios: PrecioPlan[];
  productos: { id: number; slug: string; nombre: string }[];
  caracteristicas: number[];
  limites_efectivos: Record<string, LimiteEfectivo>;
  estado: EstadoComercial;
  version: number;
  origen: number | null;
  trial_dias: number;
  /** Los codenames que este plan concede. Es la fila de la matriz. */
  permisos: string[];
  limites: Partial<Record<ClaveLimite, number | null>> & Record<string, number | null>;
  orden: number;
  /** Derivado de `estado`. Solo lectura: para cambiarlo se envia `estado`. */
  activo: boolean;
  es_predeterminado: boolean;
  /** Cuántas empresas lo tienen: decide si el plan se puede retirar. */
  negocios: number;
}

export type EstadoNegocio = "PRUEBA" | "ACTIVO" | "SUSPENDIDO" | "ARCHIVADO";
export type EstadoSuscripcion = "PRUEBA" | "ACTIVA" | "PAUSADA" | "VENCIDA" | "CANCELADA";

export interface Negocio {
  id: number;
  uuid: string;
  slug: string;
  nombre: string;
  estado: EstadoNegocio;
  fecha_creacion: string;
  plan: { slug: string; nombre: string } | null;
  estado_suscripcion: EstadoSuscripcion | null;
  dominios: string[];
  usuarios: number;
}

export interface Suscripcion {
  id: number;
  tenant: number;
  negocio: string;
  plan: number;
  plan_nombre: string;
  estado: EstadoSuscripcion;
  fecha_inicio: string;
  fecha_fin: string | null;
  limites_extra: Record<string, number | null>;
  /** Codenames concedidos a ESTA empresa además de los de su plan. */
  permisos_extra: string[];
  /** Codenames que el plan concede pero que a ESTA empresa se le apagó. Manda
   *  sobre `permisos_extra`: no se recupera colándolo también ahí. */
  permisos_excluidos: string[];
  notas: string;
}

/** Un miembro del equipo de una empresa, visto desde la plataforma. Solo lectura. */
export interface MiembroEquipo {
  nombre: string;
  email: string;
  rol: string;
  tiene_acceso_total: boolean;
  permisos: string[];
  activo: boolean;
}

/** El detalle de un dominio, aparte de la lista simple que trae `Negocio`. */
export interface DominioDetalle {
  hostname: string;
  es_primario: boolean;
  verificado: boolean;
}

export interface Resumen {
  negocios_total: number;
  negocios_por_estado: Record<string, number>;
  planes: { plan: string; negocios: number }[];
  permisos_activos: number;
}

/** Lo que `/auth/me/` devuelve y este panel usa. El serializador trae más. */
export interface UsuarioActual {
  id: number;
  nombre_usuario: string;
  email_usuario: string;
}
