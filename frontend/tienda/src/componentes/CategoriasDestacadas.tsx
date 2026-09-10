"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerCategorias } from "@/lib/datos";
import type { Categoria } from "@/lib/tipos";
import { colorCategoria, iconoCategoria } from "@/lib/utiles";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

/**
 * `tarjetas` es la variante con llamada a la accion propia («Ver productos
 * →»): mismo dato de siempre (nombre + foto o icono de respaldo), un pie mas
 * comercial. No se anade cantidad de productos porque el catalogo no la trae
 * — inventarla mentiria sobre el catalogo real.
 */
const VARIANTES = ["rejilla", "tiras", "tarjetas"] as const;

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

  const clase = claseDeVariante(variante, VARIANTES, "categorias-grid", "rejilla");
  const conAccion = clase.endsWith("tarjetas");

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo}>
      <div className={`categorias-grid ${clase}`}>
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
              {conAccion && (
                <em className="categoria-tile-accion">
                  Ver productos
                  <ArrowRight size={14} aria-hidden="true" />
                </em>
              )}
            </Link>
          );
        })}
      </div>
    </Seccion>
  );
}
