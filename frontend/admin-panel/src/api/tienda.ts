/**
 * El constructor de la tienda del negocio.
 *
 * Todo lo de aquí va contra `/content/paginas/`, que el backend acota al
 * negocio de la petición: este panel no puede alcanzar la tienda de otro
 * cliente ni aunque adivine un id.
 *
 * El catálogo de bloques llega por `/content/constructor/`, que es de solo
 * lectura. Crear bloques o plantillas es cambiar lo que la plataforma ofrece y
 * eso lo administra Crynex, no cada negocio.
 */
import { api } from "./client";

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

export interface CampoEsquema {
  tipo: "string" | "number" | "boolean" | "array" | "object" | "enum";
  titulo?: string;
  ayuda?: string;
  default?: unknown;
  minimo?: number;
  maximo?: number;
  opciones?: string[];
  items?: CampoEsquema;
  properties?: Record<string, CampoEsquema>;
}

export interface Bloque {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaBloque;
  esquema_props: CampoEsquema;
  variantes: { codigo: string; nombre: string }[];
  requiere_datos: boolean;
  unico_por_pagina: boolean;
  a_sangre: boolean;
  activo: boolean;
  orden: number;
}

export interface BloqueColocado {
  id: string;
  tipo: string;
  variante: string;
  props: Record<string, unknown>;
  visible: { movil: boolean; tablet: boolean; escritorio: boolean };
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

export interface PaginaTienda {
  id: number;
  ruta: string;
  titulo: string;
  tipo: "HOME" | "CATALOGO" | "PRODUCTO" | "CATEGORIA" | "LIBRE";
  seo_titulo: string;
  seo_descripcion: string;
  activa: boolean;
  tiene_borrador: boolean;
  version_publicada: number | null;
  bloques_publicados: number;
  fecha_actualizacion: string;
}

interface Paginado<T> {
  results?: T[];
}

/** El listado viene paginado por la configuración global de DRF. */
function filas<T>(datos: T[] | Paginado<T>): T[] {
  return Array.isArray(datos) ? datos : (datos.results ?? []);
}

export interface OpcionToken {
  valor: string;
  nombre: string;
}

/**
 * Una perilla del aspecto de la tienda.
 *
 * El catálogo lo administra Crynex; cada negocio elige sus valores. Un token
 * que no esté en el catálogo se ignora al resolver el tema, así que retirar uno
 * devuelve a todas las tiendas a su valor por defecto sin migrar nada.
 */
export interface TokenTema {
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo:
    | "MARCA"
    | "NAVEGACION"
    | "TIPOGRAFIA"
    | "SUPERFICIE"
    | "FORMA"
    | "DENSIDAD"
    // La caja va en el MISMO catálogo que la tienda: un negocio tiene una
    // identidad, y el mostrador es otra superficie que la lleva puesta. Ver
    // `TokenTema.Grupo.CAJA`.
    | "CAJA";
  tipo: "COLOR" | "MEDIDA" | "NUMERO" | "OPCION" | "TEXTO";
  variable_css: string;
  valor_por_defecto: string;
  opciones: OpcionToken[];
  unidad: string;
}

export const ETIQUETA_GRUPO: Record<TokenTema["grupo"], string> = {
  MARCA: "Marca",
  NAVEGACION: "Navegación",
  TIPOGRAFIA: "Tipografía",
  SUPERFICIE: "Superficies",
  FORMA: "Formas y espacios",
  DENSIDAD: "Densidad",
  CAJA: "Punto de venta",
};

export const tienda = {
  async catalogo(): Promise<Bloque[]> {
    const { data } = await api.get<{ bloques: Bloque[] }>("/content/constructor/");
    return data.bloques;
  },

  /**
   * El catálogo de perillas del tema, tal como lo define Crynex.
   *
   * Viene de la misma petición que los bloques —el endpoint ya lo mandaba y
   * nadie lo leía— así que abrir la pestaña de apariencia no cuesta una
   * llamada más.
   */
  async tokens(): Promise<TokenTema[]> {
    const { data } = await api.get<{ tokens: TokenTema[] }>("/content/constructor/");
    return data.tokens ?? [];
  },

  /** Lo que este negocio ha cambiado, por código de token. */
  async valoresDeTema(): Promise<Record<string, string>> {
    const { data } = await api.get<{ tokens?: Record<string, string> }>(
      "/content/site-config/"
    );
    return data.tokens ?? {};
  },

  async guardarTema(valores: Record<string, string>): Promise<void> {
    await api.patch("/content/site-config/", { tokens: valores });
  },

  async paginas(): Promise<PaginaTienda[]> {
    const { data } = await api.get<PaginaTienda[] | Paginado<PaginaTienda>>(
      "/content/paginas/"
    );
    return filas(data);
  },

  async borrador(paginaId: number): Promise<VersionPagina> {
    const { data } = await api.get<VersionPagina>(
      `/content/paginas/${paginaId}/borrador/`
    );
    return data;
  },

  async guardarBorrador(
    paginaId: number,
    composicion: Composicion
  ): Promise<VersionPagina> {
    const { data } = await api.patch<VersionPagina>(
      `/content/paginas/${paginaId}/borrador/`,
      { composicion }
    );
    return data;
  },

  async publicar(paginaId: number): Promise<VersionPagina> {
    const { data } = await api.post<VersionPagina>(
      `/content/paginas/${paginaId}/publicar/`
    );
    return data;
  },

  async versiones(paginaId: number): Promise<VersionPagina[]> {
    const { data } = await api.get<VersionPagina[]>(
      `/content/paginas/${paginaId}/versiones/`
    );
    return data;
  },

  async restaurar(paginaId: number, numero: number): Promise<VersionPagina> {
    const { data } = await api.post<VersionPagina>(
      `/content/paginas/${paginaId}/restaurar/${numero}/`
    );
    return data;
  },
};

// ==========================================================================
// Utilidades de composición
// ==========================================================================
export function nuevoId(tipo: string, existentes: Composicion): string {
  let n = 1;
  const usados = new Set(existentes.map((b) => b.id));
  while (usados.has(`${tipo}-${n}`)) n += 1;
  return `${tipo}-${n}`;
}

/**
 * Un bloque nuevo con las propiedades por defecto de su esquema ya puestas.
 *
 * Se rellenan porque el servidor no las inventa: un bloque recién colocado sin
 * `titulo` se pintaría sin encabezado y quien acaba de arrastrarlo pensaría
 * que está roto.
 */
export function bloqueNuevo(bloque: Bloque, existentes: Composicion): BloqueColocado {
  const props: Record<string, unknown> = {};
  for (const [clave, campo] of Object.entries(bloque.esquema_props?.properties ?? {})) {
    if (campo.default !== undefined) props[clave] = campo.default;
  }
  return {
    id: nuevoId(bloque.codigo, existentes),
    tipo: bloque.codigo,
    variante: bloque.variantes[0]?.codigo ?? "",
    props,
    visible: { movil: true, tablet: true, escritorio: true },
  };
}

export function mover(composicion: Composicion, desde: number, hasta: number): Composicion {
  if (desde === hasta || hasta < 0 || hasta >= composicion.length) return composicion;
  const copia = [...composicion];
  const [pieza] = copia.splice(desde, 1);
  copia.splice(hasta, 0, pieza);
  return copia;
}
