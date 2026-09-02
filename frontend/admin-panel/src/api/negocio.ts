import { api } from "./client";

/**
 * El perfil del negocio: qué sabe hacer y qué módulos usa.
 *
 * Conviene tener presente la distinción que gobierna toda esta pantalla,
 * porque es la que evita que Crynex se convierta en una aplicación por sector:
 *
 *   sector       una ETIQUETA. Se muestra, se usa para sugerir en el alta,
 *                y nada más. Nadie ramifica sobre ella.
 *   capacidades  lo que de verdad gobierna el comportamiento.
 *
 * Por eso el formulario edita capacidades y enseña el sector como texto.
 */

export interface Capacidad {
  codigo: string;
  nombre: string;
  descripcion: string;
  defecto: boolean;
}

export interface EjeAtributo {
  codigo: string;
  nombre: string;
  tipo: "TEXTO" | "OPCION" | "NUMERO";
  opciones: string[];
  obligatorio: boolean;
  usar_en_pos: boolean;
  usar_en_filtros: boolean;
}

export interface PerfilNegocio {
  sector: string;
  capacidades: Record<string, boolean>;
  esquema_atributos: EjeAtributo[];
  perfil_pos: Record<string, unknown>;
  politica_stock: Record<string, boolean>;
  dashboard: string[];
  preset_nombre: string | null;
  esta_configurado: boolean;
  fecha_actualizacion: string;
  /** Viaja con el perfil para no duplicar las etiquetas en el frontend. */
  catalogo_capacidades: Capacidad[];
}

export interface Modulo {
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  icono: string;
  /** Lo dice el plan contratado. */
  disponible: boolean;
  /** Lo dice el cliente. Un módulo funciona solo si las dos son ciertas. */
  activo: boolean;
}

export interface PreguntaAlta {
  codigo: string;
  texto: string;
}

export interface PresetSugerido {
  preset: { slug: string; nombre: string; descripcion: string; icono: string };
  puntos: number;
  /** Por qué se sugiere. La explicación es la mitad del valor. */
  motivos: string[];
  modulos_no_cubiertos: string[];
}

export async function obtenerPerfil(): Promise<PerfilNegocio> {
  const { data } = await api.get<PerfilNegocio>("/business/perfil/");
  return data;
}

export async function guardarPerfil(
  cambios: Partial<Pick<PerfilNegocio, "sector" | "capacidades" | "politica_stock" | "esquema_atributos">>
): Promise<PerfilNegocio> {
  const { data } = await api.patch<PerfilNegocio>("/business/perfil/", cambios);
  return data;
}

export async function obtenerModulos(): Promise<Modulo[]> {
  const { data } = await api.get<Modulo[]>("/business/modulos/");
  return data;
}

export async function cambiarModulo(slug: string, activo: boolean): Promise<Modulo[]> {
  const { data } = await api.post<Modulo[]>("/business/modulos/", { slug, activo });
  return data;
}

export async function obtenerAlta(): Promise<{
  preguntas: PreguntaAlta[];
  sectores: { slug: string; nombre: string; icono: string }[];
}> {
  const { data } = await api.get("/business/alta/");
  return data;
}

export async function sugerirPresets(
  senales: Record<string, boolean>,
  sector = ""
): Promise<PresetSugerido[]> {
  const { data } = await api.post<PresetSugerido[]>("/business/alta/", { sector, senales });
  return data;
}

export async function adoptarPreset(
  preset: string,
  senales: Record<string, boolean>,
  sector = ""
): Promise<PerfilNegocio> {
  const { data } = await api.post<PerfilNegocio>("/business/alta/adoptar/", {
    preset,
    sector,
    senales,
  });
  return data;
}
