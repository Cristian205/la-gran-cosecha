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
/**
 * Los tipos y las operaciones de una composicion viven en `@constructor`, que es
 * el codigo que este panel comparte con el editor de plantillas de Crynex.
 * Estaban declarados en los dos y ya habian empezado a separarse: este archivo
 * no declaraba `activo`, `id` ni `orden` en `TokenTema` —aunque el servidor los
 * manda— ni `icono` en `Bloque`. Ninguna de las dos cosas daba error, porque
 * cada panel era correcto por su cuenta. Eso es lo que hace peligrosa esta
 * duplicacion: no falla, diverge.
 *
 * Se REEXPORTAN para no tocar los sitios que ya importaban de aqui.
 * Ver `frontend/constructor/README.md`.
 */
export type {
  Bloque,
  BloqueColocado,
  CampoEsquema,
  CategoriaBloque,
  Composicion,
  EstadoVersion,
  GrupoToken,
  OpcionToken,
  TokenTema,
  Variante,
} from "@constructor/index";
export {
  ETIQUETA_CATEGORIA,
  ETIQUETA_GRUPO,
  actualizar,
  bloqueNuevo,
  duplicar,
  esHeredado,
  fijarToken,
  mover,
  nuevoId,
  quitar,
  tiposPuestos,
  tokensDelBloque,
  valoresPorDefecto,
} from "@constructor/index";

// Reexportar NO deja el nombre en ambito local, y este archivo los usa en las
// firmas de `tienda`. Por eso ademas se importan.
import type {
  Bloque,
  Composicion,
  EstadoVersion,
  TokenTema,
} from "@constructor/index";

import { api } from "./client";





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