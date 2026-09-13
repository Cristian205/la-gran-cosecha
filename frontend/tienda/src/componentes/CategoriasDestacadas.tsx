"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { desempaquetar, obtenerCategorias } from "@/lib/datos";
import type { Categoria, Paginated } from "@/lib/tipos";
import {
  colorCategoria,
  colorCategoriaTematico,
  colorCategoriaTinte,
  iconoCategoria,
} from "@/lib/utiles";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

/**
 * `tarjetas` es la variante con llamada a la accion propia («Ver productos
 * →»): mismo dato de siempre (nombre + foto o icono de respaldo), un pie mas
 * comercial. No se anade cantidad de productos porque el catalogo no la trae
 * — inventarla mentiria sobre el catalogo real.
 *
 * `vidriera` es la mas publicitaria: icono o foto en una caja aparte, y el
 * `subtitulo`/`cta_texto` propios de la categoria si el negocio los cargo.
 * Sin ellos cae al mismo «Ver productos» de `tarjetas` — ningun negocio ve
 * una tarjeta con un hueco en blanco por no haber escrito copy.
 */
const VARIANTES = ["rejilla", "tiras", "tarjetas", "vidriera"] as const;

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  /** Cuántas mostrar. Vacío las muestra todas. */
  limite?: number;
  /** Ancla para enlazar directo a esta sección desde el menú. */
  id?: string;
  variante?: string;
  /** Lo que el lienzo ya resolvió en el servidor (ver `RESUELVE_EN_SERVIDOR`
   *  en `lib/pagina.ts`). Sin esto, la sección se pintaba vacía en el HTML del
   *  servidor y solo aparecía al hidratar — lo que dejaba sin destino real
   *  cualquier enlace del menú a `#categorias`, porque ese ancla todavía no
   *  existía cuando el navegador intentaba saltar a ella. */
  datos?: Paginated<Categoria> | Categoria[];
}

export function CategoriasDestacadas({
  kicker = "Catálogo",
  titulo = "Compra por categoría",
  subtitulo = "Encuentra justo lo que necesitas",
  limite,
  id,
  variante,
  datos,
}: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>(() => (datos ? desempaquetar(datos) : []));

  useEffect(() => {
    // Ya vinieron resueltas del servidor: pedirlas de nuevo sería trabajo
    // tirado, el mismo criterio que ya aplican `MasVendidos`/`GridProductos`.
    if (categorias.length > 0) return;
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, [categorias.length]);

  const visibles = limite ? categorias.slice(0, limite) : categorias;
  if (visibles.length === 0) return null;

  const clase = claseDeVariante(variante, VARIANTES, "categorias-grid", "rejilla");
  const conAccion = clase.endsWith("tarjetas");
  const esVidriera = clase.endsWith("vidriera");

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo} id={id}>
      <div className={`categorias-grid ${clase}`}>
        {visibles.map((c) => {
          const Icono = iconoCategoria(c.nombre_categoria);

          if (esVidriera) {
            return (
              <Link
                key={c.id}
                href={`/tienda?categoria=${c.id}`}
                className="categoria-vidriera"
                style={{ background: colorCategoriaTematico(c.nombre_categoria, c.id) }}
              >
                <span className="categoria-vidriera-icono">
                  {c.imagen_url ? (
                    <img src={c.imagen_url} alt="" loading="lazy" />
                  ) : (
                    <Icono size={34} strokeWidth={1.6} />
                  )}
                </span>
                <span className="categoria-vidriera-texto">
                  <strong className="categoria-vidriera-nombre">{c.nombre_categoria}</strong>
                  {c.subtitulo && <span className="categoria-vidriera-sub">{c.subtitulo}</span>}
                  <span className="categoria-vidriera-cta">
                    {c.cta_texto || "Ver productos"}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={c.id}
              href={`/tienda?categoria=${c.id}`}
              className={`categoria-tile ${c.imagen_url ? "con-foto" : ""}`}
              style={
                c.imagen_url
                  ? ({ "--cat-tinte": colorCategoriaTinte(c.id) } as CSSProperties)
                  : { background: colorCategoria(c.id) }
              }
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
