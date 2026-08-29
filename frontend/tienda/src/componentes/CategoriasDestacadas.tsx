"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obtenerCategorias } from "@/lib/datos";
import type { Categoria } from "@/lib/tipos";
import { colorCategoria, iconoCategoria } from "@/lib/utiles";

export function CategoriasDestacadas() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  if (categorias.length === 0) return null;

  return (
    <section className="seccion">
      <div className="seccion-titulo">
        <div>
          <span className="seccion-kicker">Catálogo</span>
          <h2>Compra por categoría</h2>
        </div>
        <span className="linea">Encuentra justo lo que necesitas</span>
      </div>
      <div className="categorias-grid">
        {categorias.map((c) => {
          const Icono = iconoCategoria(c.nombre_categoria);
          return (
            <Link
              key={c.id}
              href={`/tienda?categoria=${c.id}`}
              className={`categoria-tile ${c.imagen_url ? "con-foto" : ""}`}
              style={!c.imagen_url ? { background: colorCategoria(c.id) } : undefined}
            >
              {c.imagen_url ? (
                <img src={c.imagen_url} alt="" className="categoria-tile-img" loading="lazy" />
              ) : (
                <Icono size={24} strokeWidth={1.6} />
              )}
              <span>{c.nombre_categoria}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
