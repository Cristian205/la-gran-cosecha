"use client";

import { useEffect, useRef } from "react";
import { ActiveFilters, FilterDrawer, SortControl } from "@/componentes/tienda/Filtros";
import { SearchBar } from "@/componentes/tienda/SearchBar";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { claseDeVariante } from "./Seccion";

/**
 * La barra del catálogo: qué se está viendo ("Frutas", "Resultados para
 * “papa”"), cuántos productos son, qué filtros están puestos, y ordenar.
 * Queda fija bajo la cabecera mientras se recorre la rejilla — es el "dónde
 * estoy" de un catálogo de 190 productos.
 *
 * El buscador ya no vive aquí sino en el encabezado (`catalogo-hero`), como
 * herramienta central; `mostrar_buscador` lo devuelve a la barra para una
 * tienda cuya composición no tenga ese encabezado.
 *
 * Filtrar por categoría y unidad vive en el panel lateral de `grid-productos`
 * (escritorio) y en el botón "Filtrar" de esta barra (móvil, abre una hoja).
 *
 * Depende de `CatalogoProvider`: sin él no hay qué contar ni qué ordenar, así
 * que no se dibuja nada — es un bloque de catálogo, no uno de contenido suelto.
 */
const VARIANTES = ["completa"] as const;

interface Props {
  variante?: string;
  /** El título del catálogo sin filtros. Con uno puesto, lo reemplaza lo que
   *  se está viendo: la categoría o la búsqueda. */
  titulo?: string;
  mostrar_buscador?: boolean;
}

export function CatalogToolbar({ variante, titulo = "", mostrar_buscador = false }: Props) {
  const catalogo = useCatalogoContexto();
  const barra = useRef<HTMLDivElement>(null);

  // La barra no tiene un alto fijo: crece con los chips de filtros, con el
  // buscador o al partirse en dos líneas. Su alto real queda en `--tbar-alto`
  // para que lo que se pega debajo (el panel de filtros, el destino de los
  // saltos del catálogo) empiece donde ella termina y no por debajo de ella.
  useEffect(() => {
    const el = barra.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const raiz = document.documentElement;
    const obs = new ResizeObserver(() => raiz.style.setProperty("--tbar-alto", `${el.offsetHeight}px`));
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--tbar-alto");
    };
  }, [catalogo !== null]);

  if (!catalogo) return null;

  const clase = claseDeVariante(variante, VARIANTES, "catalogo-toolbar", "completa");
  const categoria = catalogo.categorias.find((c) => c.id === catalogo.categoriaActiva);
  const q = catalogo.busqueda.trim();
  const encabezado = q ? `Resultados para “${q}”` : categoria ? categoria.nombre_categoria : titulo;

  let conteo: React.ReactNode = null;
  if (catalogo.cargando || catalogo.esperandoBusqueda) {
    conteo = <span className="tbar-cargando">Buscando productos…</span>;
  } else if (catalogo.total !== null) {
    conteo = (
      <>
        <b>{catalogo.total}</b> {catalogo.total === 1 ? "producto" : "productos"}
        {categoria && q ? <> en {categoria.nombre_categoria}</> : null}
      </>
    );
  }

  return (
    <div className={`tbar ${clase}`} ref={barra}>
      {mostrar_buscador && (
        <div className="tbar-buscador">
          <SearchBar />
        </div>
      )}
      <div className="tbar-fila">
        <div className="tbar-titulo">
          {encabezado && <h2>{encabezado}</h2>}
          <p className="tbar-conteo" aria-live="polite">
            {conteo}
          </p>
        </div>
        <div className="tbar-acciones">
          <FilterDrawer />
          <SortControl />
        </div>
      </div>
      <ActiveFilters />
    </div>
  );
}
