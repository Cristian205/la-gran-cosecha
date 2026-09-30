"use client";

import type { ReactNode } from "react";
import { useSeleccionProducto } from "@/hooks/useSeleccionProducto";
import type { Producto } from "@/lib/tipos";
import { formatoCantidad, formatoPrecio } from "@/lib/utiles";
import { GaleriaProducto } from "./GaleriaProducto";
import { PrecioProducto } from "./PrecioProducto";
import { QuickAdd } from "./QuickAdd";
import { SelectorPresentacion } from "./SelectorPresentacion";

/**
 * El cuerpo de la ficha: galería a un lado, decisión al otro, con UNA sola
 * selección para los dos. La foto y el panel de compra eran hermanos sin
 * estado compartido, y la galería por presentación necesita saber qué eligió
 * el cliente (y poder elegir por él).
 *
 * Lo que no depende de la selección —categoría, nombre, datos, aviso de
 * precios— llega ya pintado desde el servidor como `cabecera` y `pie`.
 *
 * # Compacta a propósito
 *
 * En escritorio la foto, el nombre, el precio, los selectores y el botón
 * caben en una pantalla. El panel va en el orden en que se decide —producto,
 * precio, variedad, presentación, cantidad, agregar— y cada dato sale una
 * sola vez: no hay "Ver mi pedido" aparte porque el propio botón, ya en el
 * pedido, lo abre.
 */
export function FichaCompra({
  producto,
  cabecera,
  pie,
}: {
  producto: Producto;
  cabecera: ReactNode;
  pie: ReactNode;
}) {
  const seleccion = useSeleccionProducto(producto);
  const { presentacion, precioUnitario, cantidad, paso, sinPresentaciones } = seleccion;

  return (
    <div className="ficha-cuerpo">
      <div className="ficha-media">
        <GaleriaProducto producto={producto} seleccion={seleccion} />
      </div>
      <div className="ficha-info">
        <div className="ficha-cabeza">
          {cabecera}
          {!sinPresentaciones && (
            <PrecioProducto valor={precioUnitario} unidad={presentacion?.unidad_venta_nombre} tamano="grande" />
          )}
        </div>

        {sinPresentaciones ? (
          <p className="compra-vacio">Este producto todavía no tiene presentaciones a la venta.</p>
        ) : (
          <>
            <SelectorPresentacion seleccion={seleccion} productoNombre={producto.nombre_producto} modo="amplio" />

            <div className="ficha-compra">
              <QuickAdd
                seleccion={seleccion}
                productoNombre={producto.nombre_producto}
                permiteFraccion={producto.permite_fraccion}
                tamano="grande"
                textoLargo
              />
              {cantidad > paso + 1e-6 && (
                <p className="compra-subtotal" aria-live="polite">
                  {formatoCantidad(cantidad, producto.permite_fraccion)} × {presentacion?.unidad_venta_nombre} ≈{" "}
                  <b>{formatoPrecio(precioUnitario * cantidad)}</b>
                </p>
              )}
            </div>
          </>
        )}

        {pie}
      </div>
    </div>
  );
}
