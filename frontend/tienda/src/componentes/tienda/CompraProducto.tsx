"use client";

import { ArrowRight } from "lucide-react";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { useSeleccionProducto } from "@/hooks/useSeleccionProducto";
import type { Producto } from "@/lib/tipos";
import { formatoCantidad, formatoPrecio } from "@/lib/utiles";
import { PrecioProducto } from "./PrecioProducto";
import { QuickAdd } from "./QuickAdd";
import { SelectorPresentacion } from "./SelectorPresentacion";

interface Props {
  producto: Producto;
}

/**
 * El panel de decisión de un producto: variedad, unidad (cada una con su
 * precio), cantidad, subtotal y agregar.
 *
 * Es lo que comparten la vista rápida y la ficha /productos/<slug>: "esto es
 * lo que estás comprando". El subtotal solo aparece cuando la cantidad pasa
 * de uno — con una unidad, repetir la misma cifra que el precio es ruido.
 */
export function CompraProducto({ producto }: Props) {
  const seleccion = useSeleccionProducto(producto);
  const { abrirCarrito } = useEnvoltorio();
  const { presentacion, precioUnitario, cantidad, enCarrito, sinPresentaciones } = seleccion;

  if (sinPresentaciones) {
    return <p className="compra-vacio">Este producto todavía no tiene presentaciones a la venta.</p>;
  }

  const subtotal = precioUnitario * cantidad;

  return (
    <div className="compra">
      <PrecioProducto valor={precioUnitario} unidad={presentacion?.unidad_venta_nombre} tamano="grande" />

      <SelectorPresentacion seleccion={seleccion} productoNombre={producto.nombre_producto} modo="amplio" />

      <div className="compra-accion">
        <QuickAdd
          seleccion={seleccion}
          productoNombre={producto.nombre_producto}
          permiteFraccion={producto.permite_fraccion}
          tamano="grande"
          textoLargo
        />
        {cantidad > seleccion.paso + 1e-6 && (
          <p className="compra-subtotal" aria-live="polite">
            {formatoCantidad(cantidad, producto.permite_fraccion)} × {presentacion?.unidad_venta_nombre} ≈{" "}
            <b>{formatoPrecio(subtotal)}</b>
          </p>
        )}
      </div>

      {enCarrito && (
        <button type="button" className="compra-ver-pedido" onClick={abrirCarrito}>
          Ver mi pedido <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
