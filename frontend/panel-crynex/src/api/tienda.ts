/**
 * El catálogo del motor de tiendas, visto desde el Control Center.
 *
 * Son los tipos que devuelve `apps/storefront`. El `esquema_props` de cada
 * bloque es lo que dibuja el panel de propiedades del editor: por eso se tipa
 * con cuidado aquí en vez de tratarlo como un JSON opaco — el editor se genera
 * de él, y un esquema mal entendido produce un formulario que guarda basura.
 */
import { api } from "./cliente";

export type CategoriaBloque =
  | "ESTRUCTURA"
  | "CONTENIDO"
  | "CATALOGO"
  | "PRUEBA_SOCIAL"
  | "CONVERSION";

export const ETIQUETA_CATEGORIA: Record<CategoriaBloque, string> = {
  ESTRUCTURA: "Estructura",
  CONTENIDO: "Contenido",
  CATALOGO: "Catálogo",
  PRUEBA_SOCIAL: "Prueba social",
  CONVERSION: "Conversión",
};

/** Un campo del esquema de propiedades de un bloque. */
export interface CampoEsquema {
  tipo: "string" | "number" | "boolean" | "array" | "object" | "enum";
  titulo?: string;
  ayuda?: string;
  default?: unknown;
  minimo?: number;
  maximo?: number;
  /** Para `enum`. */
  opciones?: string[];
  /** Para `array`: la forma de cada elemento. */
  items?: CampoEsquema;
  /** Para `object`. */
  properties?: Record<string, CampoEsquema>;
}

export interface Variante {
  codigo: string;
  nombre: string;
}

export interface Bloque {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaBloque;
  icono: string;
  esquema_props: CampoEsquema;
  variantes: Variante[];
  requiere_datos: boolean;
  unico_por_pagina: boolean;
  a_sangre: boolean;
  activo: boolean;
  orden: number;
}

/** Un bloque colocado en una composición. La forma que valida el servidor. */
export interface BloqueColocado {
  id: string;
  tipo: string;
  variante: string;
  props: Record<string, unknown>;
  visible: { movil: boolean; tablet: boolean; escritorio: boolean };
}

export type Composicion = BloqueColocado[];

export interface Tema {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  valores: Record<string, unknown>;
  activo: boolean;
  orden: number;
}

export interface Plantilla {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  sector: string;
  vista_previa: string;
  tema: number | null;
  tema_nombre?: string;
  /** Ruta → composición. Es el molde que se copia al adoptarla. */
  paginas: Record<string, Composicion>;
  /** El aspecto que propone, por código de token. */
  tema_valores: Record<string, string>;
  /** La identidad que propone: color de marca, tipografía, redondeo. Son
   *  campos de la configuración del negocio, no tokens, porque de
   *  `color_primario` cuelga una escala entera. Se copian al adoptarla. */
  marca: Record<string, string>;
  activa: boolean;
  es_predeterminada: boolean;
  orden: number;
}

export type GrupoToken =
  | "MARCA"
  | "NAVEGACION"
  | "TIPOGRAFIA"
  | "SUPERFICIE"
  | "FORMA"
  | "DENSIDAD"
  | "CAJA";

export const ETIQUETA_GRUPO: Record<GrupoToken, string> = {
  MARCA: "Marca",
  NAVEGACION: "Navegación",
  TIPOGRAFIA: "Tipografía",
  SUPERFICIE: "Superficies",
  FORMA: "Formas y espacios",
  DENSIDAD: "Densidad",
  CAJA: "Punto de venta",
};

/** Una perilla del aspecto de la tienda. */
export interface TokenTema {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo: GrupoToken;
  tipo: "COLOR" | "MEDIDA" | "NUMERO" | "OPCION" | "TEXTO";
  variable_css: string;
  valor_por_defecto: string;
  opciones: { valor: string; nombre: string }[];
  unidad: string;
  orden: number;
  activo: boolean;
}

/** Las empresas, solo para elegir contra cuál se previsualiza una plantilla. */
export interface NegocioBreve {
  id: number;
  slug: string;
  nombre: string;
  dominios: string[];
}

/** Lo que devuelve el generador de enlaces de prueba. */
export interface EnlaceDePrueba {
  url: string;
  negocio: string;
  /** Cuánto vale, en horas. Se enseña: un enlace que caduca sin avisar es un
   *  enlace que alguien va a abrir un lunes y no va a entender. */
  horas: number;
  rutas: string[];
}

export const tienda = {
  tokens: () => api.get<TokenTema[]>("/platform/theme-tokens/"),
  bloques: () => api.get<Bloque[]>("/platform/blocks/"),
  temas: () => api.get<Tema[]>("/platform/themes/"),
  plantillas: () => api.get<Plantilla[]>("/platform/templates/"),

  negocios: () => api.get<NegocioBreve[]>("/platform/tenants/"),

  /**
   * Un enlace para ver una plantilla en una empresa real, sin asignársela.
   *
   * No escribe nada en el negocio: el enlace lleva un testigo firmado y la
   * tienda compone al vuelo. Es lo que separa «enséñamela» de «póngasela».
   */
  enlaceDePrueba: (plantillaId: number, negocioId: number) =>
    api.post<EnlaceDePrueba>(`/platform/templates/${plantillaId}/enlace-de-prueba/`, {
      negocio: negocioId,
    }),

  crearPlantilla: (datos: Partial<Plantilla>) =>
    api.post<Plantilla>("/platform/templates/", datos),
  guardarPlantilla: (id: number, cambios: Partial<Plantilla>) =>
    api.patch<Plantilla>(`/platform/templates/${id}/`, cambios),
  borrarPlantilla: (id: number) => api.delete<void>(`/platform/templates/${id}/`),

  /**
   * Da de alta un cliente. Es un flujo, no un CRUD: el negocio nace con su
   * configuración de tienda, su suscripción y su página de inicio.
   */
  altaNegocio: (datos: AltaNegocio) =>
    api.post<{ id: number; slug: string; nombre: string }>(
      "/platform/tenants/",
      datos
    ),

  /** Le pone a un cliente la plantilla de tienda que se le indique. */
  aplicarPlantilla: (
    negocioId: number,
    plantilla: string,
    opciones: { aplicar_tema?: boolean; publicar?: boolean } = {}
  ) =>
    api.post<{ paginas: string[]; publicadas: boolean }>(
      `/platform/tenants/${negocioId}/aplicar-plantilla/`,
      { plantilla, ...opciones }
    ),
};

export interface AltaNegocio {
  nombre: string;
  slug: string;
  dominio?: string;
  plan?: string;
  plantilla?: string;
  aplicar_tema?: boolean;
  estado?: string;
}

// ==========================================================================
// Utilidades de composición
// ==========================================================================

/** Identificador de bloque, único dentro de su página. */
export function nuevoId(tipo: string, existentes: Composicion): string {
  let n = 1;
  const usados = new Set(existentes.map((b) => b.id));
  while (usados.has(`${tipo}-${n}`)) n += 1;
  return `${tipo}-${n}`;
}

/**
 * Un bloque nuevo, con las propiedades por defecto de su esquema ya puestas.
 *
 * Se rellenan aquí y no se dejan vacías porque el servidor no las inventa: un
 * bloque recién colocado sin `titulo` se pintaría sin encabezado, y quien lo
 * acaba de arrastrar pensaría que está roto.
 */
export function bloqueNuevo(bloque: Bloque, existentes: Composicion): BloqueColocado {
  return {
    id: nuevoId(bloque.codigo, existentes),
    tipo: bloque.codigo,
    variante: bloque.variantes[0]?.codigo ?? "",
    props: valoresPorDefecto(bloque.esquema_props),
    visible: { movil: true, tablet: true, escritorio: true },
  };
}

export function valoresPorDefecto(esquema: CampoEsquema | undefined): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, campo] of Object.entries(esquema?.properties ?? {})) {
    if (campo.default !== undefined) salida[clave] = campo.default;
  }
  return salida;
}

/** Mueve un bloque de posición. Devuelve una lista nueva. */
export function mover(composicion: Composicion, desde: number, hasta: number): Composicion {
  if (desde === hasta || hasta < 0 || hasta >= composicion.length) return composicion;
  const copia = [...composicion];
  const [pieza] = copia.splice(desde, 1);
  copia.splice(hasta, 0, pieza);
  return copia;
}
