"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obtenerCategorias } from "@/lib/datos";
import type { Categoria } from "@/lib/tipos";
import { colorCategoria } from "@/lib/utiles";
import { claseDeVariante } from "./Seccion";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";

/**
 * La navegación de categorías DENTRO del catálogo — distinta de otras dos
 * piezas que se le parecen y no hay que confundir:
 *
 *   `categorias-destacadas`  es un DESTINO: tarjetas grandes que llevan a
 *                            "/tienda?categoria=X". Vive en el Inicio.
 *   `barra-categorias`       son atajos EDITORIALES fijos a mano, del
 *                            armazón. No lee el catálogo real.
 *   `categorias-navegacion`  (este) es un FILTRO en vivo: lee las categorías
 *                            reales (igual que `categorias-destacadas`) pero,
 *                            si hay un `CatalogoProvider` alrededor, elegir
 *                            una no navega a ningún sitio — cambia qué pinta
 *                            `grid-productos` en la misma pantalla.
 *
 * Sin `CatalogoProvider` (puesto suelto, fuera de una página de catálogo)
 * cae a enlaces normales a "/tienda?categoria=X": sigue siendo útil, solo
 * dejó de tener con quién coordinarse en vivo.
 */
const VARIANTES = ["pills"] as const;

interface Props {
  todos_texto?: string;
  variante?: string;
}

export function CategoryNavigation({ todos_texto = "Todos", variante }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const catalogo = useCatalogoContexto();

  useEffect(() => {
    // Si el catálogo ya las trae (SSR/contexto), no hace falta pedirlas de
    // nuevo: es la misma promesa cacheada por `obtenerCategorias()`.
    obtenerCategorias().then(setCategorias).catch(() => undefined);
  }, []);

  const lista = catalogo?.categorias.length ? catalogo.categorias : categorias;
  if (lista.length === 0) return null;

  const activa = catalogo?.categoriaActiva ?? null;
  const clase = claseDeVariante(variante, VARIANTES, "categorias-nav", "pills");

  function elegir(id: number | null) {
    catalogo?.cambiarCategoria(id);
  }

  return (
    <nav className={`categorias-nav ${clase}`} aria-label="Categorías">
      <div className="chips">
        <Pill activa={activa === null} onClick={() => elegir(null)} href="/tienda" enContexto={Boolean(catalogo)}>
          {todos_texto}
        </Pill>
        {lista.map((c) => (
          <Pill
            key={c.id}
            activa={activa === c.id}
            onClick={() => elegir(c.id)}
            href={`/tienda?categoria=${c.id}`}
            color={colorCategoria(c.id)}
            enContexto={Boolean(catalogo)}
          >
            {c.nombre_categoria}
          </Pill>
        ))}
      </div>
    </nav>
  );
}

function Pill({
  activa,
  onClick,
  href,
  color,
  enContexto,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  href: string;
  color?: string;
  enContexto: boolean;
  children: React.ReactNode;
}) {
  const clase = `chip ${activa ? "activo" : ""}`;
  const punto = !activa && color ? <span className="chip-punto" style={{ background: color }} /> : null;

  // Con contexto, un botón que filtra en el sitio; sin él, un enlace normal.
  if (enContexto) {
    return (
      <button
        type="button"
        className={clase}
        onClick={onClick}
        aria-pressed={activa}
        style={activa && color ? { background: color } : undefined}
      >
        {punto}
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={clase} style={activa && color ? { background: color } : undefined}>
      {punto}
      {children}
    </Link>
  );
}
