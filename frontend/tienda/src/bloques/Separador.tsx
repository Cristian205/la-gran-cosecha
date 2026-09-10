import { claseDeVariante } from "./Seccion";

/**
 * Una línea entre dos secciones.
 *
 * Es el bloque más pequeño del catálogo y hace falta por una razón concreta:
 * hasta ahora, separar visualmente dos partes de una página obligaba a que
 * alguna de las dos trajera su propio borde, así que el corte era propiedad de
 * la sección y no de la página. Reordenar dejaba la línea en el sitio
 * equivocado.
 *
 * `aire` no dibuja nada y solo empuja: es el espaciador, y va aquí y no en un
 * bloque aparte porque son la misma decisión —cuánto respiro va entre estas dos
 * cosas— con o sin línea. Dos bloques distintos para eso obligarían a
 * cambiarlos el uno por el otro cada vez que alguien cambia de opinión.
 */
const VARIANTES = ["linea", "aire", "punto"] as const;

interface Props {
  /** Cuánto separa, en múltiplos de la escala de densidad. La tienda apretada
   *  de una ferretería y la espaciada de una boutique parten del mismo número
   *  y acaban distintas, que es justo lo que se quiere. */
  espacio?: number;
  variante?: string;
}

export function Separador({ espacio = 2, variante }: Props) {
  const clase = claseDeVariante(variante, VARIANTES, "separador", "linea");

  return (
    <div
      className={`separador ${clase}`}
      // `aria-hidden` y `role="presentation"`: es decoración. Un lector de
      // pantalla que anuncie «separador» tres veces en una página está leyendo
      // maquetación en voz alta.
      role="presentation"
      aria-hidden="true"
      style={{ "--separador-espacio": String(espacio) } as React.CSSProperties}
    />
  );
}
