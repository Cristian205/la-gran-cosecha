"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { obtenerCategorias } from "@/lib/datos";
import type { Categoria } from "@/lib/tipos";
import { colorCategoriaTematicoTinte, iconoCategoria } from "@/lib/utiles";
import { claseDeVariante } from "./Seccion";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";

/**
 * La navegación de categorías DENTRO del catálogo (CategoryNav) — distinta de
 * otras dos piezas que se le parecen y no hay que confundir:
 *
 *   `categorias-destacadas`  es un DESTINO: tarjetas grandes que llevan a
 *                            "/tienda?categoria=X". Vive en el Inicio.
 *   `barra-categorias`       son atajos EDITORIALES fijos a mano, del
 *                            armazón. No lee el catálogo real.
 *   `categorias-navegacion`  (este) es un FILTRO en vivo: lee las categorías
 *                            reales y, si hay un `CatalogoProvider` alrededor,
 *                            elegir una no navega a ningún sitio — cambia qué
 *                            pinta `grid-productos` en la misma pantalla.
 *
 * Cada categoría es una ficha visual —su render 3D sobre su propio color,
 * el nombre y cuántos productos tiene— en vez de un botón de texto: se
 * reconoce antes de leerla. En móvil es una fila con desplazamiento lateral;
 * la elegida se distingue por color, borde y `aria-pressed`, no solo por tono.
 *
 * Elegir una lleva la vista al catálogo: la rejilla está más abajo (después
 * de los favoritos) y filtrar algo que no se ve parece no haber hecho nada.
 *
 * Sin `CatalogoProvider` (puesto suelto, fuera de una página de catálogo)
 * cae a enlaces normales a "/tienda?categoria=X".
 */
const VARIANTES = ["pills"] as const;

interface Props {
  todos_texto?: string;
  /** Un título visible sobre la fila. Vacío = sin título (solo `aria-label`). */
  titulo?: string;
  variante?: string;
}

function irAlCatalogo() {
  const destino = document.getElementById("catalogo");
  if (!destino) return;
  // Solo si la rejilla está por debajo de la vista: si ya se está dentro del
  // catálogo, saltar arriba haría perder el sitio.
  if (destino.getBoundingClientRect().top > window.innerHeight * 0.5) {
    destino.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function CategoryNavigation({ todos_texto = "Todos", titulo = "", variante }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const catalogo = useCatalogoContexto();

  useEffect(() => {
    if (catalogo) return; // el contexto ya las trae
    obtenerCategorias().then(setCategorias).catch(() => undefined);
  }, [catalogo]);

  const lista = catalogo?.categorias.length ? catalogo.categorias : categorias;
  if (lista.length === 0) return null;

  const activa = catalogo?.categoriaActiva ?? null;
  const clase = claseDeVariante(variante, VARIANTES, "categorias-nav", "pills");
  const total = catalogo?.totalCatalogo ?? null;

  function elegir(id: number | null) {
    catalogo?.cambiarCategoria(id);
    irAlCatalogo();
  }

  return (
    <nav className={`catnav ${clase}`} aria-label="Categorías del catálogo">
      {titulo && <h2 className="catnav-titulo">{titulo}</h2>}
      <ul className="catnav-lista">
        <li>
          <Ficha
            activa={activa === null}
            onClick={() => elegir(null)}
            href="/tienda"
            enContexto={Boolean(catalogo)}
            icono={<LayoutGrid size={26} aria-hidden="true" className="catnav-icono-todos" />}
            nombre={todos_texto}
            cuenta={total}
          />
        </li>
        {lista.map((c) => {
          const Icono = iconoCategoria(c.nombre_categoria);
          return (
            <li key={c.id}>
              <Ficha
                activa={activa === c.id}
                onClick={() => elegir(c.id)}
                href={`/tienda?categoria=${c.id}`}
                enContexto={Boolean(catalogo)}
                tinte={colorCategoriaTematicoTinte(c.nombre_categoria, c.id)}
                icono={<Icono size={40} aria-hidden="true" />}
                nombre={c.nombre_categoria}
                cuenta={c.num_productos ?? null}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Ficha({
  activa,
  onClick,
  href,
  enContexto,
  tinte,
  icono,
  nombre,
  cuenta,
}: {
  activa: boolean;
  onClick: () => void;
  href: string;
  enContexto: boolean;
  tinte?: string;
  icono: ReactNode;
  nombre: string;
  cuenta: number | null;
}) {
  const clase = `catnav-ficha ${activa ? "is-activa" : ""}`;
  const estilo = tinte ? ({ "--cat-tinte": tinte } as CSSProperties) : undefined;
  const contenido = (
    <>
      <span className="catnav-media">{icono}</span>
      <span className="catnav-nombre">{nombre}</span>
      {cuenta !== null && cuenta > 0 && (
        <span className="catnav-cuenta">
          {cuenta} <span className="sr-only">productos</span>
        </span>
      )}
    </>
  );

  // Con contexto, un botón que filtra en el sitio; sin él, un enlace normal.
  if (enContexto) {
    return (
      <button type="button" className={clase} style={estilo} onClick={onClick} aria-pressed={activa}>
        {contenido}
      </button>
    );
  }
  return (
    <Link href={href} className={clase} style={estilo} aria-current={activa ? "page" : undefined}>
      {contenido}
    </Link>
  );
}
