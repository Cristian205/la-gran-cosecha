import Link from "next/link";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

/**
 * La franja de accesos directos que va bajo la cabecera.
 *
 * Es un bloque aparte y no una propiedad de `cabecera`, y conviene decir por
 * qué: la cabecera es el menú del SITIO —inicio, nosotros, contacto— y esto es
 * el menú del CATÁLOGO. Un negocio con tres categorías no la pone y su
 * cabecera sigue igual; uno con doce la pone y no le crece el menú principal.
 * Metidos en el mismo bloque, quitar uno obligaría a tocar el otro.
 *
 * Tampoco lee las categorías del negocio, aunque podría: son ATAJOS elegidos, y
 * cuál merece estar arriba es una decisión comercial, no la lista completa
 * ordenada alfabéticamente. Quien quiera la lista entera tiene
 * `categorias-destacadas`, que sí las lee.
 *
 * `destacado` va aparte de los demás enlaces en vez de ser una bandera dentro
 * de la lista: es el único que cambia de forma —una píldora de color al final—
 * y tenerlo como campo propio evita que un negocio marque tres y se quede sin
 * jerarquía, que es justo lo que la píldora existe para dar.
 */
export interface AtajoCategoria {
  texto: string;
  href?: string;
  icono?: string;
}

interface Props {
  enlaces?: AtajoCategoria[];
  destacado?: AtajoCategoria;
  variante?: string;
}

const VARIANTES = ["franja", "centrada"] as const;

export function BarraCategorias({ enlaces = [], destacado, variante }: Props) {
  // Sin atajos no hay franja. Una barra vacía bajo la cabecera parece que algo
  // no cargó, y ocupa alto sin decir nada.
  if (enlaces.length === 0 && !destacado?.texto) return null;

  const clase = claseDeVariante(variante, VARIANTES, "barra-cat", "franja");
  const IconoDestacado = icono(destacado?.icono);

  return (
    <nav className={`barra-cat ${clase}`} aria-label="Categorías">
      <div className="barra-cat-cara">
        {enlaces.map((e, i) => {
          const Icono = icono(e.icono);
          return (
            <Link key={`${e.texto}-${i}`} href={e.href || "/tienda"}>
              <Icono size={17} strokeWidth={1.6} aria-hidden="true" />
              <span>{e.texto}</span>
            </Link>
          );
        })}

        {destacado?.texto && (
          <Link className="barra-cat-destacado" href={destacado.href || "/tienda"}>
            <IconoDestacado size={16} aria-hidden="true" />
            <span>{destacado.texto}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
