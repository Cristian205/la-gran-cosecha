"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { formatoCantidad } from "@/lib/utiles";

interface Props {
  cantidad: number;
  permiteFraccion: boolean;
  /** Bajar desde aquí saca la línea del pedido en vez de dejarla en un valor
   *  imposible: el botón "-" se convierte en "quitar". */
  enElMinimo: boolean;
  /** Un texto corto bajo el número, p. ej. "en tu pedido". Opcional: una fila
   *  de compra rápida no tiene ese espacio y no lo necesita. */
  leyenda?: string;
  nombreProducto: string;
  onDisminuir: () => void;
  onAumentar: () => void;
}

/**
 * El stepper +/- de cantidad, ya en el carrito.
 *
 * Antes vivía escrito a mano dentro de `ProductCard`. Se extrae tal cual —
 * mismas clases, mismo comportamiento— para que una ficha de producto o una
 * fila de compra rápida lo reutilicen sin copiar el marcado.
 */
export function QuantityControl({
  cantidad,
  permiteFraccion,
  enElMinimo,
  leyenda,
  nombreProducto,
  onDisminuir,
  onAumentar,
}: Props) {
  return (
    <div className="pc-stepper pc-stepper-carrito">
      <button
        type="button"
        onClick={onDisminuir}
        aria-label={enElMinimo ? `Quitar ${nombreProducto} del pedido` : "Disminuir cantidad"}
      >
        {enElMinimo ? <Trash2 size={15} /> : <Minus size={15} />}
      </button>
      <span className="pc-cantidad-valor" aria-live="polite">
        {formatoCantidad(cantidad, permiteFraccion)}
        {leyenda && <i>{leyenda}</i>}
      </span>
      <button type="button" aria-label="Aumentar cantidad" onClick={onAumentar}>
        <Plus size={15} />
      </button>
    </div>
  );
}
