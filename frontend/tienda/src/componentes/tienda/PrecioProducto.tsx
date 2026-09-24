import { TEXTO_PRECIOS_ESTIMADOS } from "@/componentes/AvisoPrecios";
import { formatoPrecio } from "@/lib/utiles";

interface Props {
  valor: number;
  /** La unidad de venta elegida: "Libra", "Bulto"… */
  unidad?: string | null;
  /** "Desde": cuando el precio es el más bajo entre varias presentaciones y
   *  todavía no se eligió ninguna (la sección de favoritos). */
  desde?: boolean;
  tamano?: "normal" | "grande";
}

/**
 * El precio con su jerarquía: la cifra manda, y debajo, pequeño, "aprox. /
 * Libra". Antes era una sola línea ("$ 3.000 aprox./ Unidad") donde la
 * palabra "aprox." pesaba casi lo mismo que la cifra.
 *
 * "aprox." no se quita: los precios dependen del mercado del día y se
 * confirman antes de despachar. El `title` lleva la explicación completa, la
 * misma frase que el carrito y el checkout (`TEXTO_PRECIOS_ESTIMADOS`).
 *
 * El `key` sobre la cifra reinicia su animación de entrada cuando cambia la
 * unidad: el cliente VE que el precio respondió a su elección.
 */
export function PrecioProducto({ valor, unidad, desde = false, tamano = "normal" }: Props) {
  const texto = formatoPrecio(valor);
  return (
    <p className={`precio precio--${tamano}`}>
      {desde && <span className="precio-desde">Desde</span>}
      <span className="precio-valor" key={`${texto}-${unidad ?? ""}`}>
        {texto}
      </span>
      <span className="precio-meta" title={TEXTO_PRECIOS_ESTIMADOS}>
        aprox.{unidad ? ` / ${unidad}` : ""}
      </span>
    </p>
  );
}
