import { Seccion, claseDeVariante } from "./Seccion";

/**
 * Un muro de imágenes.
 *
 * Es el bloque que faltaba para las tiendas donde el producto se vende
 * mirándolo: una floristería, una pastelería, un taller. Hasta ahora la única
 * forma de enseñar fotos era el carrusel de promociones, que es otra cosa —
 * lleva enlace, ocupa el ancho y va arriba del todo.
 *
 * No pide nada al servidor: las imágenes son propiedades del bloque. Es
 * deliberado y marca la frontera con `productos-destacados`, que sí consulta el
 * catálogo. Una galería no es un catálogo sin precios: es una pieza de
 * contenido, y quien la edita quiere elegir qué foto va y en qué orden, no
 * heredar lo que devuelva una consulta.
 */
const VARIANTES = ["mosaico", "tira"] as const;

export interface ImagenGaleria {
  url: string;
  /** El texto alternativo. Vacío es una imagen que un lector de pantalla no
   *  puede describir, así que el editor lo pide. */
  alt?: string;
  pie?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  centrado?: boolean;
  imagenes?: ImagenGaleria[];
  variante?: string;
}

export function Galeria({
  kicker,
  titulo,
  subtitulo,
  centrado = false,
  imagenes = [],
  variante,
}: Props) {
  // Sin imágenes no se pinta nada. Un encabezado sobre un hueco vacío parece
  // que la página falló al cargar; no pintarlo dice la verdad, que es que
  // todavía no hay fotos.
  if (imagenes.length === 0) return null;

  return (
    <Seccion
      kicker={kicker}
      titulo={titulo}
      subtitulo={subtitulo}
      centrado={centrado}
      className={claseDeVariante(variante, VARIANTES, "galeria", "mosaico")}
    >
      <div className="galeria-grid">
        {imagenes.map((imagen, i) => (
          <figure className="galeria-pieza" key={`${imagen.url}-${i}`}>
            {/* `<img>` y no `next/image`: las URL vienen de R2 o de un dominio
                que el negocio pega a mano, y `next/image` exige declarar cada
                origen en la configuración. Una galería que se rompe porque
                alguien uso otro alojamiento no es configurable. */}
            <img src={imagen.url} alt={imagen.alt || ""} loading="lazy" />
            {imagen.pie && <figcaption>{imagen.pie}</figcaption>}
          </figure>
        ))}
      </div>
    </Seccion>
  );
}
