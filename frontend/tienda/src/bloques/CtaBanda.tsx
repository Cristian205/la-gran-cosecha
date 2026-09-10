import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { claseDeVariante } from "./Seccion";

/**
 * Las dos formas de rematar una pagina.
 *
 * `banda` es la de siempre: ocupa el ancho y separa dos secciones.
 * `tarjeta` la mete en una caja con su sombra y su radio, que es lo que pide
 * una tienda que ya usa tarjetas para todo y donde una franja a sangre corta
 * el ritmo en vez de rematarlo.
 */
const VARIANTES = ["banda", "tarjeta"] as const;

/**
 * La franja final con un botón.
 *
 * Era el último bloque de `HomePage.tsx`, con el destino `/tienda` escrito a
 * mano. Ahora el enlace es una propiedad: la misma banda sirve para llevar al
 * catálogo, a una campaña o a WhatsApp sin tocar código.
 */
interface Props {
  titulo?: string;
  texto?: string;
  boton_texto?: string;
  boton_href?: string;
  variante?: string;
}

export function CtaBanda({
  titulo = "",
  texto = "",
  boton_texto = "Ir a la tienda",
  boton_href = "/tienda",
  variante,
}: Props) {
  if (!titulo && !texto) return null;

  const externo = /^https?:\/\//.test(boton_href);

  return (
    <div className={`cta-banda ${claseDeVariante(variante, VARIANTES, "cta-banda", "banda")}`}>
      <div>
        {titulo && <h3>{titulo}</h3>}
        {texto && <p>{texto}</p>}
      </div>
      {externo ? (
        <a className="btn btn-ambar" href={boton_href} target="_blank" rel="noreferrer">
          <ShoppingBag size={18} />
          {boton_texto}
        </a>
      ) : (
        <Link href={boton_href} className="btn btn-ambar">
          <ShoppingBag size={18} />
          {boton_texto}
        </Link>
      )}
    </div>
  );
}
