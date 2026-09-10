import { Seccion, claseDeVariante } from "./Seccion";

/**
 * La tira de marcas con las que trabaja el negocio.
 *
 * Es prueba social de otro tipo que los testimonios: aquel dice «a otros les
 * fue bien», este dice «los que ya conoces confían aquí». Un distribuidor lo
 * necesita mucho más que una reseña, porque su cliente compra por catálogo y lo
 * primero que mira es qué marcas maneja.
 *
 * Los logotipos son propiedades y no una tabla, y esa es la decisión que
 * conviene defender: una tabla de marcas obligaría a un CRUD, una pantalla y
 * una migración para guardar una imagen y un enlace. Cuando alguna tienda
 * necesite ordenarlas, buscarlas o asociarlas a productos, entonces será una
 * tabla; hoy es una lista corta que se edita donde se ve.
 */
const VARIANTES = ["tira", "rejilla"] as const;

export interface Marca {
  logo_url: string;
  nombre?: string;
  href?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  centrado?: boolean;
  marcas?: Marca[];
  /** En gris hasta que el ratón pasa por encima. Es lo normal en una tira de
   *  logotipos: veinte marcas a todo color compiten con el producto. */
  atenuar?: boolean;
  variante?: string;
}

export function Marcas({
  kicker,
  titulo,
  subtitulo,
  centrado = false,
  marcas = [],
  atenuar = true,
  variante,
}: Props) {
  if (marcas.length === 0) return null;

  return (
    <Seccion
      kicker={kicker}
      titulo={titulo}
      subtitulo={subtitulo}
      centrado={centrado}
      className={claseDeVariante(variante, VARIANTES, "marcas", "tira")}
    >
      <div className={`marcas-fila ${atenuar ? "marcas-fila--atenuada" : ""}`.trim()}>
        {marcas.map((marca, i) => {
          const logo = (
            <img
              src={marca.logo_url}
              alt={marca.nombre || ""}
              loading="lazy"
              title={marca.nombre}
            />
          );
          return (
            <div className="marca-pieza" key={`${marca.logo_url}-${i}`}>
              {/* Enlace solo si lo hay. Un `<a>` sin destino es un elemento
                  que el teclado enfoca y que no lleva a ninguna parte. */}
              {marca.href ? (
                <a href={marca.href} target="_blank" rel="noreferrer noopener">
                  {logo}
                </a>
              ) : (
                logo
              )}
            </div>
          );
        })}
      </div>
    </Seccion>
  );
}
