"use client";

import { ShoppingBasket } from "lucide-react";
import { formatoPrecio } from "@/lib/utiles";

interface Props {
  disabled: boolean;
  agotado: boolean;
  nombreProducto: string;
  precioUnitario: number;
  onClick: () => void;
  /** Fila de compra rápida: el mismo botón, sin el texto "Agregar" a su lado. */
  compacto?: boolean;
}

/**
 * El botón "Agregar" que suma un producto al pedido.
 *
 * Extraído de `ProductCard` tal cual, para que una ficha de producto o una
 * fila de compra rápida lo reutilicen sin copiar el `aria-label` ni la
 * distinción "agotado" — que es la parte fácil de olvidar al duplicar.
 */
export function AddToCartButton({
  disabled,
  agotado,
  nombreProducto,
  precioUnitario,
  onClick,
  compacto = false,
}: Props) {
  return (
    <button
      className={`pc-btn-add ${compacto ? "pc-btn-add--compacto" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={
        agotado
          ? `${nombreProducto} está agotado`
          : `Agregar ${nombreProducto} al pedido · ${formatoPrecio(precioUnitario)}`
      }
    >
      <ShoppingBasket size={16} />
      {!compacto && <span>{agotado ? "Agotado" : "Agregar"}</span>}
    </button>
  );
}
