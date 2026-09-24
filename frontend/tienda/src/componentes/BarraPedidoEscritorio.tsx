"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/estado/carrito";
import { useRebote } from "@/hooks/useRebote";
import { formatoPrecio } from "@/lib/utiles";

/**
 * "Mi pedido", siempre a la vista en escritorio: el ícono con la insignia del
 * Navbar es fácil de perder de vista mientras se recorre un catálogo largo.
 * Es un componente aparte y no una fusión con `MobileCartBar` — el marcado y
 * el sitio en pantalla son otros (panel flotante en la esquina, no una barra
 * de ancho completo sobre la navegación inferior).
 *
 * Salta un instante cada vez que el pedido cambia —una línea nueva o una
 * cantidad distinta—: es la mitad visible del "agregado" que el cliente
 * acaba de pulsar.
 *
 * `.barra-pedido-escritorio` se oculta por CSS bajo los 900px, el mismo corte
 * donde `MobileCartBar` toma el relevo: nunca se ven las dos a la vez.
 */
interface Props {
  onAbrir: () => void;
}

export function BarraPedidoEscritorio({ onAbrir }: Props) {
  const totalLineas = useCart((s) => s.totalLineas());
  const totalPrecio = useCart((s) => s.totalPrecio());
  const rebote = useRebote(`${totalLineas}|${totalPrecio}`);

  if (totalLineas === 0) return null;

  const productos = `${totalLineas} ${totalLineas === 1 ? "producto" : "productos"}`;

  return (
    <button
      type="button"
      className={`barra-pedido-escritorio ${rebote ? "rebote" : ""}`}
      onClick={onAbrir}
      aria-label={`Ver tu pedido: ${productos}, ${formatoPrecio(totalPrecio)} aproximado`}
    >
      <span className="barra-pedido-escritorio-icono">
        <ShoppingBag size={18} />
        <span className="barra-pedido-escritorio-contador" key={totalLineas}>
          {totalLineas}
        </span>
      </span>
      <span className="barra-pedido-escritorio-texto">
        <strong>Mi pedido</strong>
        <span>
          {productos} · <b>{formatoPrecio(totalPrecio)}</b> aprox.
        </span>
      </span>
      <span className="barra-pedido-escritorio-cta">
        Ver pedido <ArrowRight size={15} />
      </span>
    </button>
  );
}
