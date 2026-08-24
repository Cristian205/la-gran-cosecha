import { useEffect, useState } from "react";
import { obtenerProductosMasVendidos } from "../api/catalog";
import type { Producto } from "../types";
import { ProductCard } from "./ProductCard";

export function MasVendidos() {
  const [productos, setProductos] = useState<Producto[]>([]);

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
