/**
 * Los presets de negocio, vistos desde el Control Center.
 *
 * Un preset es el punto de partida de un tipo de negocio: qué sabe hacer, qué
 * módulos usa, con qué ejes describe sus productos y con qué tienda arranca.
 * Adoptarlo COPIA todo eso al negocio, así que editar aquí no toca a nadie que
 * ya lo haya adoptado — que es exactamente lo que permite retocar «Ferretería»
 * con cuarenta clientes usándola.
 *
 * La promesa que sostiene esta pantalla: añadir un tipo de negocio nuevo tiene
 * que ser un alta aquí, sin una línea de código ni una migración. Si algún día
 * hace falta tocar el backend para dar de alta «floristería», la arquitectura
 * dejó de cumplir lo que prometía.
 */
import { api } from "./cliente";

/** Un eje que distingue una presentación de otra: talla, color, empaque. */
export interface EjeAtributo {
  codigo: string;
  nombre: string;
  tipo: "TEXTO" | "OPCION" | "NUMERO";
  opciones: string[];
  obligatorio: boolean;
  usar_en_pos: boolean;
  usar_en_filtros: boolean;
}

export interface Preset {
  slug: string;
  nombre: string;
  descripcion: string;
  /** Una ETIQUETA. Se muestra y puntúa en el alta; nadie ramifica sobre ella. */
  sector: string;
  icono: string;
  /** Sube sola al guardar. Dice con qué versión nació cada negocio. */
  version: number;
  /** Slugs de módulo. Recomendados: solo se encienden los que el plan cubra. */
  modulos: string[];
  /** Lo que de verdad gobierna el comportamiento del negocio. */
  capacidades: Record<string, boolean>;
  esquema_atributos: EjeAtributo[];
  perfil_pos: Record<string, unknown>;
  politica_stock: Record<string, boolean>;
  dashboard: string[];
  plantilla: number | null;
  tema: number | null;
  /** Lo que espera de las respuestas del alta, con su peso. */
  senales: Record<string, number>;
  activo: boolean;
  es_predeterminado: boolean;
  orden: number;
}

/**
 * Las capacidades que la plataforma sabe leer hoy.
 *
 * Se declaran aquí y no se piden al servidor porque esta pantalla es de
 * plataforma y no de un negocio: no hay `/business/perfil/` que consultar sin
 * elegir uno. La lista corta es deliberada — cada capacidad tiene un consumidor
 * real en el backend, y se amplía cuando el módulo que la lee existe.
 */
export const CAPACIDADES: { codigo: string; nombre: string; descripcion: string }[] = [
  {
    codigo: "acepta_pedidos_online",
    nombre: "Acepta pedidos por la tienda",
    descripcion: "Apagado, la tienda es un catálogo que se ve pero no se compra.",
  },
  {
    codigo: "controla_stock",
    nombre: "Lleva inventario",
    descripcion: "Los productos nuevos nacen contando existencias.",
  },
  {
    codigo: "vende_por_peso",
    nombre: "Vende por peso o fracción",
    descripcion: "Media libra, tres cuartos de kilo.",
  },
];

/** Las preguntas del alta. Un preset les pone peso para que le puntúen. */
export const SENALES: { codigo: string; texto: string }[] = [
  { codigo: "vende_por_peso", texto: "Vende por peso o fracción" },
  { codigo: "usa_codigo_barras", texto: "Usa código de barras" },
  { codigo: "cobra_en_mostrador", texto: "Cobra en mostrador" },
  { codigo: "acepta_pedidos_online", texto: "Recibe pedidos por internet" },
  { codigo: "controla_stock", texto: "Lleva cuenta de existencias" },
  { codigo: "tiene_mesas", texto: "Atiende en mesas" },
  { codigo: "productos_con_variantes", texto: "Tallas, colores o presentaciones" },
  { codigo: "catalogo_grande", texto: "Más de doscientas referencias" },
];

export interface ModuloComercial {
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: string;
}

export const negocio = {
  presets: () => api.get<Preset[]>("/platform/presets/"),
  crear: (datos: Partial<Preset>) => api.post<Preset>("/platform/presets/", datos),
  guardar: (slug: string, cambios: Partial<Preset>) =>
    api.patch<Preset>(`/platform/presets/${slug}/`, cambios),
  borrar: (slug: string) => api.delete<void>(`/platform/presets/${slug}/`),
  modulos: () => api.get<ModuloComercial[]>("/platform/products/"),
};
