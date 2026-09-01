import type { ReactNode } from "react";

/**
 * El encabezado que comparten todas las secciones de la tienda.
 *
 * Los doce bloques repetían este mismo bloque de marcado con su antetítulo,
 * su `h2` y su línea a la derecha, cada uno con el texto escrito a mano. Eso
 * era lo que hacía imposible que un negocio cambiara "Compra por categoría"
 * sin tocar código.
 *
 * Ahora el texto entra por propiedades y cada bloque aporta el suyo por
 * defecto: una tienda recién creada se ve igual que antes, y la que quiera
 * cambiarlo lo hace desde el constructor.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  /** Clases extra de la propia sección, para las variantes de cada bloque. */
  className?: string;
  children: ReactNode;
}

export function Seccion({ kicker, titulo, subtitulo, className = "", children }: Props) {
  // Sin título ni antetítulo no se dibuja el encabezado: dejar el hueco de un
  // `h2` vacío desplaza la sección y parece que algo falló al cargar.
  const conEncabezado = Boolean(kicker || titulo || subtitulo);

  return (
    <section className={`seccion ${className}`.trim()}>
      {conEncabezado && (
        <div className="seccion-titulo">
          <div>
            {kicker && <span className="seccion-kicker">{kicker}</span>}
            {titulo && <h2>{titulo}</h2>}
          </div>
          {subtitulo && <span className="linea">{subtitulo}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Traduce la variante elegida a una clase, con la de por defecto de respaldo.
 *
 * Está aquí y no en cada bloque porque la regla es la misma en los doce: una
 * variante que este despliegue no conoce —porque el catálogo del backend va
 * por delante— no puede dejar la sección sin maquetar.
 */
export function claseDeVariante(
  variante: string | undefined,
  conocidas: readonly string[],
  prefijo: string,
  porDefecto: string
): string {
  const elegida = variante && conocidas.includes(variante) ? variante : porDefecto;
  return `${prefijo}--${elegida}`;
}
