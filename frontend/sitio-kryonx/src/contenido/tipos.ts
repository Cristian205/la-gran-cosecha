/**
 * La forma del contenido del sitio comercial.
 *
 * La página no lleva un solo texto escrito en los componentes: cada sección
 * recibe sus datos de aquí, igual que los bloques de la tienda reciben los
 * suyos de la composición. El día que esto se administre desde el panel de la
 * plataforma, el backend devuelve un `ContenidoSitio` con esta forma y no hay
 * que tocar ni una sección — solo `usarContenido`.
 *
 * Por eso todo es serializable: nada de JSX, nada de funciones. Los iconos van
 * por nombre (`NombreIcono`) y los colores como texto CSS.
 */

export interface Enlace {
  etiqueta: string;
  href: string;
}

/* ------------------------------------------------------------------ */
/* Tiendas de ejemplo                                                  */
/* ------------------------------------------------------------------ */

export type FuenteTitulos = "sans" | "serif" | "editorial" | "grotesca" | "display";
export type FormaProducto = "circulo" | "capsula" | "botella" | "arco" | "cubo" | "gota";

export interface ProductoMaqueta {
  nombre: string;
  precio: string;
  /** Dos colores CSS: el degradado que hace de foto del producto. */
  color: [string, string];
  forma: FormaProducto;
}

/**
 * Una identidad de tienda completa. Es lo que demuestra que el mismo motor
 * no produce la misma tienda dos veces: cambia esto y cambia todo.
 */
export interface TemaTienda {
  id: string;
  rubro: string;
  nombre: string;
  /** Tres rasgos de su identidad, para el pie de la vitrina. */
  rasgos: string[];
  fondo: string;
  superficie: string;
  texto: string;
  tenue: string;
  acento: string;
  /** Color del texto encima del acento. */
  sobreAcento: string;
  fuente: FuenteTitulos;
  /** Radio de las piezas, en em de la maqueta. */
  radio: number;
  /** Titulares en mayúsculas: media identidad de una marca de moda o retail. */
  mayusculas?: boolean;
  anuncio: string;
  hero: {
    antetitulo: string;
    titulo: string;
    cta: string;
    /** El objeto protagonista del hero. */
    objeto: [string, string];
    forma: FormaProducto;
  };
  categorias: string[];
  productos: ProductoMaqueta[];
  promo: { titulo: string; texto: string };
}

/* ------------------------------------------------------------------ */
/* Campañas                                                            */
/* ------------------------------------------------------------------ */

export type FormatoCampana =
  | "hero"
  | "temporada"
  | "flash"
  | "producto"
  | "destacada"
  | "seccion";

export interface Campana {
  id: string;
  formato: FormatoCampana;
  /** Cómo se llama el formato en el calendario. */
  nombre: string;
  /** Cuándo corre, tal como se lee en el calendario. */
  fecha: string;
  antetitulo: string;
  titulo: string;
  texto: string;
  cta: string;
  /** Fondo y acento de la pieza publicitaria. */
  colores: [string, string];
  /** Barra de anuncio que acompaña a la campaña encima de la navegación. */
  anuncio: string;
}

/* ------------------------------------------------------------------ */
/* Secciones                                                           */
/* ------------------------------------------------------------------ */

export type NombreIcono =
  | "pincel"
  | "rayo"
  | "dispositivos"
  | "bloques"
  | "contenido"
  | "megafono"
  | "escala"
  | "huella";

/** Las zonas de una tienda que el constructor deja tocar. */
export type ZonaTienda =
  | "home"
  | "navbar"
  | "banners"
  | "carrusel"
  | "productos"
  | "categorias"
  | "promo"
  | "footer"
  | "estilo"
  | "componentes"
  | "contenido";

export interface EncabezadoSeccion {
  etiqueta: string;
  titulo: string;
  /** La parte del título que va en cursiva: lo que la sección quiere que se recuerde. */
  destacado: string;
  descripcion?: string;
}

export interface DatosNavegacion {
  enlaces: Enlace[];
  cta: Enlace;
}

export interface DatosHero {
  insignia: string;
  titulo: string;
  destacado: string;
  subtitulo: string;
  ctaPrincipal: Enlace;
  ctaSecundario: Enlace;
  /** Ids de `temas` que el hero va alternando. */
  temas: string[];
  /** Lo que se lee en la barra de direcciones del editor. */
  dominio: string;
}

export interface DatosConstructor extends EncabezadoSeccion {
  zonas: { id: ZonaTienda; nombre: string; detalle: string }[];
  /** Tema sobre el que se demuestra. */
  tema: string;
}

export interface DatosCampanas extends EncabezadoSeccion {
  campanas: Campana[];
  tema: string;
}

/**
 * Una tienda de verdad, hecha con Kryon X. Las maquetas de `tiendas` enseñan lo
 * que el motor PODRÍA hacer; esto enseña lo que ya hizo, con capturas de la
 * tienda publicada. Las imágenes son URL para que mañana puedan venir del
 * backend igual que el resto del contenido.
 */
export interface CasoDemostracion {
  id: string;
  nombre: string;
  rubro: string;
  /** La plantilla de Kryon X sobre la que está montada. */
  plantilla: string;
  descripcion: string;
  rasgos: string[];
  /** Lo que se lee en la barra de direcciones del marco. */
  dominio: string;
  /** Captura de la página completa en escritorio; el marco la recorre. */
  escritorio: string;
  /** Captura de la página completa en el móvil; el teléfono la recorre. */
  movil: string;
  /** Segundos que tardan las capturas en recorrerse de arriba abajo. */
  recorrido: number;
  /** Enlace a la tienda publicada, cuando la hay. */
  enlace?: Enlace;
}

export interface DatosDemostraciones extends EncabezadoSeccion {
  casos: CasoDemostracion[];
}

export interface DatosTiendas extends EncabezadoSeccion {
  temas: string[];
}

export interface DatosBeneficios extends EncabezadoSeccion {
  beneficios: { icono: NombreIcono; titulo: string; texto: string }[];
  /** Tema que la demostración responsive usa. */
  tema: string;
}

export interface DatosConversion {
  titulo: string;
  destacado: string;
  texto: string;
  ctaPrincipal: Enlace;
  ctaSecundario: Enlace;
}

export interface DatosPie {
  lema: string;
  enlaces: Enlace[];
  legal: string;
}

/**
 * Una sección de la página. `id` es el ancla (`#constructor`), `visible`
 * permite apagarla sin borrarla, y el orden del arreglo es el orden en
 * pantalla — exactamente lo que necesita un editor para reordenarlas.
 */
type Seccion<T extends string, D> = { tipo: T; id: string; visible: boolean; datos: D };

export type SeccionSitio =
  | Seccion<"hero", DatosHero>
  | Seccion<"demostraciones", DatosDemostraciones>
  | Seccion<"constructor", DatosConstructor>
  | Seccion<"campanas", DatosCampanas>
  | Seccion<"tiendas", DatosTiendas>
  | Seccion<"beneficios", DatosBeneficios>
  | Seccion<"conversion", DatosConversion>;

export type TipoSeccion = SeccionSitio["tipo"];

export interface ContenidoSitio {
  navegacion: DatosNavegacion;
  secciones: SeccionSitio[];
  pie: DatosPie;
  /** El catálogo de identidades que las secciones citan por id. */
  temas: TemaTienda[];
}
