/**
 * La forma del contenido del sitio comercial de Crafteech.
 *
 * La página no lleva un solo texto escrito en los componentes: cada escena
 * recibe sus datos de aquí, igual que los bloques de la tienda reciben los
 * suyos de la composición. El día que esto se administre desde el panel de la
 * plataforma, el backend devuelve un `ContenidoSitio` con esta forma y no hay
 * que tocar ni una escena — solo `usarContenido`.
 *
 * Por eso todo es serializable: nada de JSX, nada de funciones. Los iconos van
 * por nombre y los colores como texto CSS.
 */

/** Las tres modalidades de Crafteech. */
export type Solucion = "commerce" | "custom" | "growth";

export interface Enlace {
  etiqueta: string;
  href: string;
  /**
   * Si el botón expresa interés en una modalidad, cuál. Al pulsarlo, el
   * formulario del cierre queda con esa modalidad elegida y el mensaje de
   * WhatsApp sale contextualizado.
   */
  solucion?: Solucion;
  /** De dónde sale el clic, para la analítica («hero», «planes-custom»…). */
  origen?: string;
}

/* ------------------------------------------------------------------ */
/* Tiendas de ejemplo (maquetas)                                       */
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
/* Campañas (las que dibuja la maqueta)                                */
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
  nombre: string;
  fecha: string;
  antetitulo: string;
  titulo: string;
  texto: string;
  cta: string;
  /** Fondo y acento de la pieza publicitaria. */
  colores: [string, string];
  anuncio: string;
}

/** Las zonas de una tienda que la maqueta sabe señalar. */
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

/* ------------------------------------------------------------------ */
/* Escenas                                                             */
/* ------------------------------------------------------------------ */

export interface EncabezadoEscena {
  /** La etiqueta pequeña que identifica la escena («02 · Dos caminos»). */
  etiqueta: string;
  titulo: string;
  /** La parte del título que va resaltada: lo que la escena quiere que se recuerde. */
  destacado: string;
  descripcion?: string;
}

export interface DatosNavegacion {
  enlaces: Enlace[];
  /** El menú «Soluciones» se despliega con una entrada por modalidad. */
  soluciones: { solucion: Solucion; nombre: string; detalle: string; href: string }[];
  cta: Enlace;
}

/** 01 · Hero. */
export interface DatosHero {
  /** El concepto de marca, en pequeño sobre el titular. */
  lema: string;
  titulo: string;
  destacado: string;
  subtitulo: string;
  ctaPrincipal: Enlace;
  ctaSecundario: Enlace;
  /** Ids de `temas` que el hero va alternando. */
  temas: string[];
  /** Lo que se lee en la barra de direcciones de la ventana. */
  dominio: string;
}

/** Una de las dos modalidades que presenta «Dos caminos». */
export interface Modalidad {
  solucion: Solucion;
  nombre: string;
  frase: string;
  descripcion: string;
  beneficios: string[];
  funciones: string[];
  cta: Enlace;
  /** Una línea que deja clara la diferencia con la otra modalidad. */
  diferencia: string;
}

/** 02 · Dos caminos, una marca. */
export interface DatosCaminos extends EncabezadoEscena {
  commerce: Modalidad;
  custom: Modalidad;
}

export interface Industria {
  id: string;
  /** Cómo se nombra la experiencia («Fashion & Lifestyle»). */
  nombre: string;
  /** Id del tema de `temas` que la ilustra. */
  tema: string;
  descripcion: string;
}

/** 03 · Experiencias por industria. */
export interface DatosExperiencias extends EncabezadoEscena {
  industrias: Industria[];
}

/** 04 · Personalización real. */
export interface DatosPersonalizacion extends EncabezadoEscena {
  /** Tema sobre el que se demuestra. */
  tema: string;
  paletas: { nombre: string; acento: string }[];
  fuentes: FuenteTitulos[];
  /** Mensajes de la barra de anuncio entre los que se puede elegir. */
  anuncios: string[];
  /** Aviso de que es una demostración y no una tienda real. */
  aviso: string;
}

/**
 * Un proyecto. `tipo` distingue lo REALMENTE publicado de lo conceptual: un
 * concepto se rotula como tal y nunca se presenta como trabajo realizado.
 */
export interface CasoProyecto {
  id: string;
  tipo: "real" | "concepto";
  nombre: string;
  rubro: string;
  reto: string;
  solucion: string;
  funcionalidades: string[];
  /** Lo que se lee en la barra de direcciones del marco. */
  dominio: string;
  /** Captura de la página completa en escritorio; el marco la recorre. */
  escritorio: string;
  /** Captura de la página completa en el móvil; el teléfono la recorre. */
  movil: string;
  /** Segundos que tardan las capturas en recorrerse de arriba abajo. */
  recorrido: number;
  /** Enlace a la tienda publicada. Solo los proyectos reales lo tienen. */
  enlace?: Enlace;
}

/** 05 · Proyectos destacados. */
export interface DatosProyectos extends EncabezadoEscena {
  casos: CasoProyecto[];
}

/** 06 · Proceso de trabajo. */
export interface DatosProceso extends EncabezadoEscena {
  etapas: { numero: string; titulo: string; texto: string }[];
}

export interface Plan {
  solucion: Solucion;
  nombre: string;
  /** Cómo se contrata: la diferencia que esta escena tiene que dejar clara. */
  modelo: string;
  descripcion: string;
  incluye: string[];
  cta: Enlace;
  destacado?: boolean;
}

/** 07 · Soluciones y planes. Sin precios: todas llevan a cotización. */
export interface DatosSoluciones extends EncabezadoEscena {
  planes: Plan[];
  nota: string;
}

/** 08 · Cierre y contacto. */
export interface DatosContacto {
  titulo: string;
  destacado: string;
  texto: string;
  /** Las opciones del selector de tipo de solución del formulario. */
  opciones: { valor: Solucion | "por_definir"; etiqueta: string }[];
  whatsapp: string;
  correoDeRespaldo?: string;
}

export interface DatosPie {
  lema: string;
  enlaces: Enlace[];
  legal: string;
}

/**
 * Una escena de la página. `id` es el ancla (`#soluciones`), `visible`
 * permite apagarla sin borrarla, y el orden del arreglo es el orden en
 * pantalla — exactamente lo que necesita un editor para reordenarlas.
 */
type Escena<T extends string, D> = { tipo: T; id: string; visible: boolean; datos: D };

export type SeccionSitio =
  | Escena<"hero", DatosHero>
  | Escena<"caminos", DatosCaminos>
  | Escena<"experiencias", DatosExperiencias>
  | Escena<"personalizacion", DatosPersonalizacion>
  | Escena<"proyectos", DatosProyectos>
  | Escena<"proceso", DatosProceso>
  | Escena<"soluciones", DatosSoluciones>
  | Escena<"contacto", DatosContacto>;

export type TipoSeccion = SeccionSitio["tipo"];

export interface ContenidoSitio {
  navegacion: DatosNavegacion;
  secciones: SeccionSitio[];
  pie: DatosPie;
  /** El catálogo de identidades que las escenas citan por id. */
  temas: TemaTienda[];
}
