"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/estado/carrito";
import { formatoPrecio } from "@/lib/utiles";

/**
 * El equivalente de `MobileCartBar` para escritorio: ahí el ícono con la
 * insignia del Navbar es fácil de perder de vista mientras se recorre un
 * catálogo largo. Es un componente aparte y no una fusión con
 * `MobileCartBar` — el marcado y el sitio en pantalla son otros (panel
 * flotante en la esquina, no una barra de ancho completo sobre la
 * navegación inferior) y forzarlos al mismo componente solo complicaría los
 * `display` de cada media query.
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

  if (totalLineas === 0) return null;

  return (
    <button
      type="button"
      className="barra-pedido-escritorio"
      onClick={onAbrir}
      aria-label={`Ver tu pedido: ${totalLineas} ${
        totalLineas === 1 ? "producto" : "productos"
      }, ${formatoPrecio(totalPrecio)} estimado`}
    >
      <span className="barra-pedido-escritorio-icono">
        <ShoppingBag size={18} />
      </span>
      <span className="barra-pedido-escritorio-texto">
        <strong>Mi pedido</strong>
        <span>
          {totalLineas} {totalLineas === 1 ? "producto" : "productos"} ·{" "}
          {formatoPrecio(totalPrecio)}
        </span>
      </span>
      <span className="barra-pedido-escritorio-cta">
        Ver pedido <ArrowRight size={15} />
      </span>
    </button>
  );
}
