"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obtenerCategorias } from "@/lib/datos";
import type { Categoria } from "@/lib/tipos";
import { colorCategoria, iconoCategoria } from "@/lib/utiles";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

const VARIANTES = ["rejilla", "tiras"] as const;

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  /** Cuántas mostrar. Vacío las muestra todas. */
  limite?: number;
  variante?: string;
}

export function CategoriasDestacadas({
  kicker = "Catálogo",
  titulo = "Compra por categoría",
  subtitulo = "Encuentra justo lo que necesitas",
  limite,
  variante,
}: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  const visibles = limite ? categorias.slice(0, limite) : categorias;
  if (visibles.length === 0) return null;

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo}>
      <div
        className={`categorias-grid ${claseDeVariante(
          variante,
          VARIANTES,
          "categorias-grid",
          "rejilla"
        )}`}
      >
        {visibles.map((c) => {
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
    </Seccion>
  );
}
