/**
 * Los tipos y las operaciones de una composicion viven en `@constructor`, que es
 * el codigo que este panel comparte con el otro editor de tiendas. Estaban
 * declarados en los dos y ya habian empezado a separarse —el del negocio no
 * declaraba `activo` ni `id` en `TokenTema`, ni `icono` en `Bloque`, aunque el
 * servidor los manda—. Ninguna de las dos cosas daba error: cada panel era
 * correcto por su cuenta, que es lo que hace peligrosa esta duplicacion. No
 * falla, diverge.
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
  VersionPagina,
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

/**
 * El catálogo del motor de tiendas, visto desde el Control Center.
 *
 * Son los tipos que devuelve `apps/storefront`. El `esquema_props` de cada
 * bloque es lo que dibuja el panel de propiedades del editor: por eso se tipa
 * con cuidado aquí en vez de tratarlo como un JSON opaco — el editor se genera
 * de él, y un esquema mal entendido produce un formulario que guarda basura.
 */
// Reexportar NO deja el nombre en ambito local, y este archivo los usa en las
// firmas de `tienda`. Por eso ademas se importan.
import type { Bloque, Composicion, TokenTema } from "@constructor/index";

import { api } from "./cliente";


/** Un campo del esquema de propiedades de un bloque. */



/** Un bloque colocado en una composición. La forma que valida el servidor. */



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


/** Una perilla del aspecto de la tienda. */

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
