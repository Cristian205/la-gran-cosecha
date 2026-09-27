"use client";

import type { ReactNode } from "react";
import { useSeleccionProducto } from "@/hooks/useSeleccionProducto";
import type { Producto } from "@/lib/tipos";
import { CompraProducto } from "./CompraProducto";
import { GaleriaProducto } from "./GaleriaProducto";

/**
 * El cuerpo de la ficha: galería a un lado, decisión al otro, con UNA sola
 * selección para los dos. La foto y el panel de compra eran hermanos sin
 * estado compartido, y la galería por presentación necesita saber qué eligió
 * el cliente (y poder elegir por él).
 *
 * Lo que no depende de la selección —categoría, nombre, datos, aviso de
 * precios— llega ya pintado desde el servidor como `cabecera` y `pie`.
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

  return (
    <div className="ficha-cuerpo">
      <div className="ficha-media">
        <GaleriaProducto producto={producto} seleccion={seleccion} />
      </div>
      <div className="ficha-info">
        {cabecera}
        <CompraProducto producto={producto} seleccion={seleccion} />
        {pie}
      </div>
    </div>
  );
}
