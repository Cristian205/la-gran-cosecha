import Link from "next/link";
import { ShoppingBag } from "lucide-react";

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
}

export function CtaBanda({
  titulo = "",
  texto = "",
  boton_texto = "Ir a la tienda",
  boton_href = "/tienda",
}: Props) {
  if (!titulo && !texto) return null;

  const externo = /^https?:\/\//.test(boton_href);

  return (
    <div className="cta-banda">
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
