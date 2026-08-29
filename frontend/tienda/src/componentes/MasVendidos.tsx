"use client";

import { useEffect, useState } from "react";
import { obtenerProductosMasVendidos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { ProductCard } from "@/componentes/ProductCard";

interface Props {
  /** Los que ya vienen renderizados del servidor. Se usan como estado inicial
   *  para que el inicio no parpadee ni vuelva a pedirlos al hidratar. */
  iniciales?: Producto[];
}

export function MasVendidos({ iniciales = [] }: Props) {
  const [productos, setProductos] = useState<Producto[]>(iniciales);

  useEffect(() => {
    obtenerProductosMasVendidos()
      .then(setProductos)
      .catch(() => setProductos([]));
  }, []);

  if (productos.length === 0) return null;

  return (
    <section className="seccion">
      <div className="seccion-titulo">
        <div>
          <span className="seccion-kicker">Los preferidos</span>
          <h2>Lo que más piden los negocios como el tuyo</h2>
        </div>
        <span className="linea">Disponibilidad confirmada</span>
      </div>
      <div className="grid">
        {productos.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </section>
  );
}
