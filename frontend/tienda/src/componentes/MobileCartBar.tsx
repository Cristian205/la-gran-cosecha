"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/estado/carrito";
import { formatoPrecio } from "@/lib/utiles";

interface Props {
  onAbrir: () => void;
}

/**
 * Barra fija sobre la navegación inferior, solo en móvil: la mayoría de
 * clientes arma su pedido desde el celular y necesita ver, sin volver arriba,
 * cuánto lleva. Compacta a propósito — cada píxel que ocupa es un píxel menos
 * de catálogo.
 */
export function MobileCartBar({ onAbrir }: Props) {
  const totalLineas = useCart((s) => s.totalLineas());
  const totalPrecio = useCart((s) => s.totalPrecio());
  const [rebote, setRebote] = useState(false);

  useEffect(() => {
    if (totalLineas === 0) return;
    setRebote(true);
    const t = setTimeout(() => setRebote(false), 320);
    return () => clearTimeout(t);
  }, [totalLineas]);

  useEffect(() => {
    document.body.classList.toggle("con-barra-carrito", totalLineas > 0);
    return () => document.body.classList.remove("con-barra-carrito");
  }, [totalLineas]);

  if (totalLineas === 0) return null;

  const lineas = totalLineas;

  return (
    <button
      type="button"
      className={`barra-carrito-movil ${rebote ? "rebote" : ""}`}
      onClick={onAbrir}
      aria-label={`Ver tu pedido: ${lineas} ${
        lineas === 1 ? "producto" : "productos"
      }, ${formatoPrecio(totalPrecio)} estimado`}
    >
      <span className="barra-carrito-icono">
        <ShoppingBag size={17} />
        <span className="barra-carrito-contador">{lineas}</span>
      </span>
      <span className="barra-carrito-texto">
        {lineas} {lineas === 1 ? "producto" : "productos"}
      </span>
      <span className="barra-carrito-total">{formatoPrecio(totalPrecio)}</span>
      <span className="barra-carrito-cta">
        Ver <ArrowRight size={15} />
      </span>
    </button>
  );
}
