/**
 * La forma del centro legal.
 *
 * Dos capas, y las dos son datos:
 *
 * - `DatosLegales`: los HECHOS del negocio —razón social, NIT, cobertura,
 *   plazos, medios de pago—. Se guardan en `StoreSettings.legal` y se editan
 *   desde el panel (ver `backend/apps/content/legal.py`, que es la referencia
 *   de esta forma).
 * - `Politica`: el TEXTO de cada página, en secciones y bloques. Hay uno por
 *   defecto (`politicas.ts`) y el negocio puede reescribir cualquiera.
 *
 * Los textos citan los hechos con marcadores `{{envios.costos}}`. Así el
 * texto se escribe una vez y los datos se cambian en un formulario; y lo que
 * todavía no se ha diligenciado se ve como «por completar» en vez de
 * desaparecer o de inventarse.
 *
 * Todo es serializable —nada de JSX— para que el backend lo pueda guardar.
 */

export interface MetodoPago {
  id: string;
  nombre: string;
  descripcion: string;
  /** `null`: el negocio todavía no ha dicho si lo ofrece. */
  activo: boolean | null;
}

export interface EntradaHistorial {
  fecha: string;
  cambio: string;
}

export interface DatosLegales {
  empresa: {
    nombre_comercial?: string;
    razon_social?: string;
    nit?: string;
    direccion?: string;
    ciudad?: string;
    departamento?: string;
    representante_legal?: string;
    matricula_mercantil?: string;
  };
  contacto: {
    correo_atencion?: string;
    correo_datos_personales?: string;
    telefono?: string;
    whatsapp?: string;
    horario_atencion?: string;
    direccion_notificaciones?: string;
    sitio_web?: string;
  };
  envios: {
    cobertura?: string[];
    horarios?: string;
    tiempos?: string;
    costos?: string;
    pedido_minimo?: string;
    condiciones?: string;
    perecederos?: string;
    retrasos?: string;
    confirmacion?: string;
    requisitos?: string;
  };
  devoluciones: {
    plazo_cambios?: string;
    plazo_reporte?: string;
    condiciones?: string;
    excepciones?: string;
    reembolso?: string;
    costos_devolucion?: string;
    tiempo_respuesta?: string;
  };
  pagos: {
    metodos?: MetodoPago[];
    confirmacion?: string;
    seguridad?: string;
  };
  pedidos: {
    ajuste_precio?: string;
    cancelacion?: string;
  };
}

/** Lo que guarda el backend: los datos más lo que el negocio reescribió. */
export interface LegalGuardado extends Partial<DatosLegales> {
  politicas?: Record<string, Partial<PoliticaEditable>>;
}

/* ------------------------------------------------------------------ */
/* Contenido                                                           */
/* ------------------------------------------------------------------ */

/**
 * Piezas que se pintan con DATOS, no con texto: la tabla de cookies sale del
 * catálogo de cookies, los medios de pago de `pagos.metodos`… Se nombran en
 * el contenido para que una política reescrita pueda decidir dónde van.
 */
export type ComponenteLegal =
  | "identificacion"
  | "canales"
  | "cobertura"
  | "cookies"
  | "metodos-pago"
  | "estados-pedido"
  | "tipos-pqrs"
  | "derechos-titular"
  | "casos-devolucion";

export type BloqueLegal =
  | { tipo: "p"; texto: string }
  | { tipo: "lista"; items: string[]; ordenada?: boolean }
  | { tipo: "aviso"; tono?: "info" | "importante"; titulo?: string; texto: string }
  | { tipo: "datos"; filas: { etiqueta: string; valor: string }[] }
  | { tipo: "componente"; nombre: ComponenteLegal };

export interface SeccionLegal {
  /** Ancla de la sección: `#datos-que-recopilamos`. */
  id: string;
  titulo: string;
  bloques: BloqueLegal[];
}

/** Lo que el negocio puede reescribir de una política. */
export interface PoliticaEditable {
  titulo: string;
  resumen: string;
  secciones: SeccionLegal[];
  actualizado: string;
  historial: EntradaHistorial[];
}

export interface Politica extends PoliticaEditable {
  slug: string;
  /** Para el menú lateral y el pie, donde no cabe el título entero. */
  tituloCorto: string;
  /** Para agrupar en el menú: compra, datos, atención. */
  grupo: "compra" | "datos" | "atencion";
}
