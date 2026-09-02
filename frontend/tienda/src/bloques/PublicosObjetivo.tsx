import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

/**
 * A quién sirve este negocio.
 *
 * Restaurantes, fruterías, cafeterías, hoteles. Es la sección que hace que
 * quien llega se reconozca —«esto es para mí»— antes de mirar un solo precio,
 * y por eso va alta en la página y con contraste propio.
 *
 * No usa `Seccion`: es una franja a sangre con fondo oscuro, y meterle el
 * encabezado estándar la convertiría en otra cosa. Es el mismo criterio que ya
 * aplica `TrustBadges`.
 *
 * Los públicos son una lista, no cuatro campos. Un mayorista tiene seis y una
 * panadería dos; con columnas fijas, el quinto público sería una migración.
 */
export interface Publico {
  icono?: string;
  titulo: string;
  texto?: string;
}

interface Props {
  titulo?: string;
  publicos?: Publico[];
  variante?: string;
}

/**
 * `franja` es la de siempre: fondo oscuro, a sangre, alta en la pagina.
 * `tarjetas` es la misma informacion en cuatro tarjetas claras con borde, para
 * tiendas donde una banda oscura partiria el tono en dos. Mismos datos exactos,
 * otro dibujo: eso es una variante y no un bloque nuevo.
 */
const VARIANTES = ["franja", "tarjetas"] as const;

export function PublicosObjetivo({ titulo = "", publicos = [], variante }: Props) {
  // Sin públicos no hay franja: un titular oscuro sobre nada parece un error
  // de carga, y ocupa pantalla sin decir nada.
  if (publicos.length === 0) return null;

  const clase = claseDeVariante(variante, VARIANTES, "publicos", "franja");

  return (
    <section className={`publicos ${clase}`}>
      <div className="contenedor">
        {titulo && <h2>{titulo}</h2>}
        <div className="publicos-grid">
          {publicos.map((p, i) => {
            const Icono = icono(p.icono);
            return (
              <article key={`${p.titulo}-${i}`}>
                <span className="icono" aria-hidden="true">
                  <Icono size={26} strokeWidth={1.6} />
                </span>
                <div>
                  <h3>{p.titulo}</h3>
                  {p.texto && <p>{p.texto}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
