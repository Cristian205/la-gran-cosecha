"use client";

import { useEffect, useState } from "react";
import { obtenerProductosMasVendidos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { ProductCard } from "@/componentes/ProductCard";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

const VARIANTES = ["rejilla", "carrusel"] as const;

interface Props {
  /** Lo que el lienzo resolvio en el servidor. Se usa como estado inicial para
   *  que el inicio no parpadee ni vuelva a pedirlo al hidratar. */
  datos?: Producto[];
  /** Cuantos mostrar. Lo fija el bloque desde el constructor. */
  limite?: number;
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  /** El encabezado centrado. Lo pide el escaparate de una boutique; el
   *  catalogo de una distribuidora lo quiere a la izquierda. */
  centrado?: boolean;
  variante?: string;
}

export function MasVendidos({
  datos = [],
  limite,
  kicker = "Los preferidos",
  titulo = "Lo que más piden los negocios como el tuyo",
  subtitulo = "Disponibilidad confirmada",
  centrado = false,
  variante,
}: Props) {
  const [productos, setProductos] = useState<Producto[]>(datos);

  useEffect(() => {
    // Solo se vuelve a pedir si el servidor no los trajo: con el motor, la
    // home los resuelve antes de pintar y repetir la peticion al hidratar
    // seria trabajo tirado.
    if (datos.length > 0) return;
    obtenerProductosMasVendidos()
      .then(setProductos)
      .catch(() => setProductos([]));
  }, [datos.length]);

  const visibles = limite ? productos.slice(0, limite) : productos;
  if (visibles.length === 0) return null;

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo} centrado={centrado}>
      <div className={`grid ${claseDeVariante(variante, VARIANTES, "grid", "rejilla")}`}>
        {visibles.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </Seccion>
  );
}
