import type { CSSProperties } from "react";
import type { FormaProducto } from "../contenido/tipos";

/**
 * La "foto" de un producto dentro de una maqueta.
 *
 * No hay imágenes a propósito: una tienda de ejemplo con fotos de banco se ve
 * como una tienda de ejemplo, y pesa. Un volumen con luz y sombra se lee como
 * producto en cualquier tamaño, cambia de color con el tema sin recargar nada
 * y no cuesta un byte de red.
 */
export function Objeto({
  forma,
  color,
  className = "",
}: {
  forma: FormaProducto;
  color: [string, string];
  className?: string;
}) {
  const estilo = { "--o1": color[0], "--o2": color[1] } as CSSProperties;
  return (
    <span className={`objeto ${className}`} style={estilo} aria-hidden="true">
      <span className={`objeto__cuerpo objeto__cuerpo--${forma}`} />
      <span className="objeto__sombra" />
    </span>
  );
}
