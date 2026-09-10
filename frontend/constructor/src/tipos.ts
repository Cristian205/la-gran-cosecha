/**
 * La forma de una composición, en un solo sitio.
 *
 * Los dos paneles que construyen tiendas —el de Crynex, que edita plantillas, y
 * el del negocio, que edita su propia tienda— manipulan exactamente la misma
 * estructura. Hasta la fase 12 cada uno la tenía declarada por su cuenta, y ya
 * habían empezado a separarse:
 *
 *     `TokenTema`  el del negocio no declaraba `activo`, `id` ni `orden`,
 *                  aunque el servidor los manda. Un filtro por token retirado
 *                  no compilaba allí y sí aquí.
 *     `Bloque`     el del negocio no declaraba `icono`.
 *
 * Ninguna de las dos cosas daba error: cada panel era correcto por su cuenta.
 * Eso es lo que hace peligrosa esta clase de duplicación — no falla, diverge, y
 * un día alguien escribe la misma corrección dos veces con dos criterios.
 *
 * # Por qué esto y no un paquete de npm
 *
 * Porque no hace falta. Es un directorio de TypeScript que los dos proyectos
 * leen con un alias (`@constructor/*`). No añade dependencias, no cambia
 * ningún `package-lock.json`, no toca el CI ni el despliegue.
 *
 * Un paquete de verdad —con `npm workspaces`— haría falta para compartir
 * COMPONENTES, porque React no resuelve desde un directorio sin
 * `node_modules`. Y compartir componentes no es lo que hace falta: los dos
 * paneles tienen hojas de estilos distintas a propósito, así que la parte que
 * se repite de verdad es la que está aquí — los tipos y las operaciones.
 */

// ==========================================================================
// EL CATÁLOGO
// ==========================================================================
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

/**
 * Un campo del `esquema_props` de un bloque.
 *
 * Es un JSON Schema recortado: solo lo que el editor sabe dibujar. Vive en el
 * servidor y se usa para tres cosas —validar, dibujar el formulario y
 * documentar el bloque—, que es lo que evita que las tres se separen.
 */
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
  /**
   * Qué tokens de tema puede retocar SOLO este bloque, por código. De aquí sale
   * su pestaña de diseño, igual que la de contenido sale de `esquema_props`.
   * Vacío significa que obedece solo al tema de la tienda.
   */
  tokens_admitidos: string[];
  a_sangre: boolean;
  activo: boolean;
  orden: number;
}

// ==========================================================================
// LO COLOCADO
// ==========================================================================
export interface BloqueColocado {
  id: string;
  tipo: string;
  variante: string;
  props: Record<string, unknown>;
  visible: { movil: boolean; tablet: boolean; escritorio: boolean };
  /**
   * El aspecto propio de este bloque, por CÓDIGO de token.
   *
   * Se guarda así y no como variable CSS por lo mismo que `StoreSettings.tokens`:
   * la traducción a `--variable` la hace el servidor al servir la tienda, y
   * hacerla en un solo sitio es lo que evita que el editor y la tienda acaben
   * hablando dos idiomas.
   */
  estilo: Record<string, string>;
}

export type Composicion = BloqueColocado[];

export type EstadoVersion = "BORRADOR" | "PUBLICADA" | "ARCHIVADA";

export interface VersionPagina {
  id: number;
  numero: number;
  estado: EstadoVersion;
  composicion: Composicion;
  nota: string;
  autor_nombre: string;
  fecha_creacion: string;
  fecha_publicacion: string | null;
}

// ==========================================================================
// EL TEMA
// ==========================================================================
export type GrupoToken =
  | "MARCA"
  | "NAVEGACION"
  | "TIPOGRAFIA"
  | "SUPERFICIE"
  | "FORMA"
  //: Espaciado y sombras salieron de FORMA al llegar el estilo por bloque: son
  //: las dos perillas que más se retocan sección a sección, y mezcladas con los
  //: radios había que buscarlas. Ver `TokenTema.Grupo` en el backend.
  | "ESPACIADO"
  | "SOMBRA"
  | "DENSIDAD"
  //: La caja va en el MISMO catálogo que la tienda: un negocio tiene una
  //: identidad, y el mostrador es otra superficie que la lleva puesta.
  | "CAJA";

export const ETIQUETA_GRUPO: Record<GrupoToken, string> = {
  MARCA: "Marca",
  NAVEGACION: "Navegación",
  TIPOGRAFIA: "Tipografía",
  SUPERFICIE: "Superficies",
  FORMA: "Formas",
  ESPACIADO: "Espaciado",
  SOMBRA: "Sombras",
  DENSIDAD: "Densidad",
  CAJA: "Punto de venta",
};

export interface OpcionToken {
  valor: string;
  nombre: string;
}

/**
 * Una perilla del aspecto de la tienda.
 *
 * El catálogo lo administra Crynex; cada negocio elige sus valores. Un token que
 * no esté en el catálogo se ignora al resolver el tema, así que retirar uno
 * devuelve a todas las tiendas a su valor por defecto sin migrar nada.
 */
export interface TokenTema {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo: GrupoToken;
  tipo: "COLOR" | "MEDIDA" | "NUMERO" | "OPCION" | "TEXTO";
  variable_css: string;
  valor_por_defecto: string;
  opciones: OpcionToken[];
  unidad: string;
  orden: number;
  activo: boolean;
}
