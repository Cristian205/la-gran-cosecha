"use client";

import { Loader2, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { obtenerProductos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { ProductCard } from "@/componentes/ProductCard";
import { Seccion, claseDeVariante } from "./Seccion";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { FilterPanel } from "@/componentes/tienda/Filtros";
import {
  CierreCatalogo,
  EmptySearch,
  ErrorCatalogo,
  EsqueletosCatalogo,
} from "@/componentes/tienda/EstadosCatalogo";

/**
 * Una rejilla de productos, sin criterio propio.
 *
 * Es la diferencia con `productos-destacados` y `ofertas-semana`, y conviene
 * decirla porque desde fuera los tres se parecen: aquellos tienen un CRITERIO
 * escrito dentro —lo más vendido, lo que está en oferta— y por eso su consulta
 * es suya y no se elige. Este no tiene ninguno: muestra el catálogo, y qué
 * trozo del catálogo lo dicen sus propiedades.
 *
 * # Modo catálogo interactivo
 *
 * Con un `CatalogoProvider` alrededor (ver `contextos/CatalogoContexto.tsx`),
 * este bloque deja de decidir su propia categoría/orden/límite —los toma del
 * contexto, que es lo que `categorias-navegacion` y `catalogo-toolbar` están
 * cambiando en la misma pantalla— y gana el panel de filtros lateral, la
 * carga progresiva y el cierre hacia el pedido. Sin ese contexto
 * (puesto suelto, como ya se usa en el Inicio) se comporta EXACTAMENTE igual
 * que antes: una vitrina fija, con la categoría y el límite que traiga en sus
 * propiedades. Ninguna tienda que ya lo use nota el cambio.
 */
const VARIANTES = ["rejilla", "carrusel", "lista"] as const;

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  centrado?: boolean;
  /** Ancla para enlazar directo a esta rejilla (el CTA del hero del catálogo
   *  ya apunta a "#catalogo"). */
  id?: string;
  /** De qué categoría. Sin ella, del catálogo entero. Se ignora en modo
   *  catálogo interactivo: ahí la categoría la decide el contexto. */
  categoria_id?: number | null;
  limite?: number;
  /** Cómo se ordenan. Las mismas claves que el catálogo entiende, para que no
   *  haya dos vocabularios de ordenación en la misma tienda. */
  orden?: "recientes" | "precio_asc" | "precio_desc" | "nombre";
  variante?: string;
  /** El estilo de cada tarjeta — un eje distinto del de esta rejilla, ver
   *  `ProductCard`. `"compacta"` es lo que arma "Compra rápida". */
  tarjeta_variante?: string;
  /** Modo catálogo: el panel lateral de filtros (solo escritorio). */
  mostrar_filtros?: boolean;
}

export function GridProductos({
  kicker,
  titulo,
  subtitulo,
  centrado = false,
  id,
  categoria_id = null,
  limite = 8,
  orden = "recientes",
  variante,
  tarjeta_variante,
  mostrar_filtros = true,
}: Props) {
  const catalogo = useCatalogoContexto();

  if (catalogo) {
    return (
      <CatalogoInteractivo
        kicker={kicker}
        titulo={titulo}
        subtitulo={subtitulo}
        centrado={centrado}
        id={id}
        variante={variante}
        tarjetaVariante={tarjeta_variante}
        mostrarFiltros={mostrar_filtros}
      />
    );
  }

  return (
    <Vitrina
      kicker={kicker}
      titulo={titulo}
      subtitulo={subtitulo}
      centrado={centrado}
      id={id}
      categoriaId={categoria_id}
      limite={limite}
      orden={orden}
      variante={variante}
      tarjetaVariante={tarjeta_variante}
    />
  );
}

// ---------------------------------------------------------- modo vitrina fija

function Vitrina({
  kicker,
  titulo,
  subtitulo,
  centrado,
  id,
  categoriaId,
  limite,
  orden,
  variante,
  tarjetaVariante,
}: {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  centrado: boolean;
  id?: string;
  categoriaId: number | null;
  limite: number;
  orden: "recientes" | "precio_asc" | "precio_desc" | "nombre";
  variante?: string;
  tarjetaVariante?: string;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);

  useEffect(() => {
    let vigente = true;
    obtenerProductos({
      categoria: categoriaId ?? undefined,
      pageSize: limite,
      orden,
    })
      .then((pagina) => {
        // `vigente` evita pintar la respuesta de un filtro que ya cambió. En el
        // editor esto pasa de verdad: se toca la categoría dos veces seguidas y
        // la primera respuesta puede llegar la última.
        if (vigente) setProductos(pagina.results ?? []);
      })
      .catch(() => {
        if (vigente) setProductos([]);
      });
    return () => {
      vigente = false;
    };
  }, [categoriaId, limite, orden]);

  // Sin productos no se pinta el encabezado tampoco: un título sobre un hueco
  // vacío parece que la página falló al cargar.
  if (productos.length === 0) return null;

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo} centrado={centrado} id={id}>
      <div className={`grid ${claseDeVariante(variante, VARIANTES, "grid", "rejilla")}`}>
        {productos.map((p, i) => (
          <ProductCard key={p.id} producto={p} variante={tarjetaVariante} indice={i} />
        ))}
      </div>
    </Seccion>
  );
}

// ------------------------------------------------------ modo catálogo interactivo

/** Cuántas tandas se cargan solas al acercarse al final. Después, un botón:
 *  el pie de página tiene que poder alcanzarse, y una rejilla que crece sin
 *  fin lo empuja para siempre. */
const TANDAS_AUTOMATICAS = 2;

function CatalogoInteractivo({
  kicker,
  titulo,
  subtitulo,
  id,
  variante,
  tarjetaVariante,
  mostrarFiltros,
}: {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  centrado: boolean;
  id?: string;
  variante?: string;
  tarjetaVariante?: string;
  mostrarFiltros: boolean;
}) {
  const catalogo = useCatalogoContexto()!; // ya se comprobó en el padre
  const centinela = useRef<HTMLDivElement>(null);
  const [automaticas, setAutomaticas] = useState(0);
  const { hayMas, cargandoMas, error, cargarMas } = catalogo;

  // Un filtro nuevo es un catálogo nuevo: vuelve a tener sus cargas solas.
  const claveFiltro = `${catalogo.categoriaActiva}|${catalogo.unidadActiva}|${catalogo.orden}|${catalogo.busqueda}`;
  useEffect(() => setAutomaticas(0), [claveFiltro]);

  // Carga progresiva: la siguiente tanda se pide ANTES de llegar al final
  // (800px de margen), para que el cliente casi nunca vea el esqueleto.
  useEffect(() => {
    const el = centinela.current;
    if (!el || !hayMas || cargandoMas || error || automaticas >= TANDAS_AUTOMATICAS) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setAutomaticas((n) => n + 1);
          cargarMas();
        }
      },
      { rootMargin: "800px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMas, cargandoMas, error, automaticas, cargarMas]);

  const conPanel = mostrarFiltros;
  const claseGrid = `pgrid ${claseDeVariante(variante, VARIANTES, "grid", "rejilla")}`;

  let contenido: React.ReactNode;
  if (catalogo.error && catalogo.productos.length === 0) {
    contenido = <ErrorCatalogo />;
  } else if (catalogo.cargando) {
    contenido = (
      <div className={claseGrid} aria-busy="true" aria-label="Cargando productos">
        <EsqueletosCatalogo cantidad={8} />
      </div>
    );
  } else if (catalogo.productos.length === 0) {
    contenido = <EmptySearch />;
  } else {
    const restantes = catalogo.total !== null ? catalogo.total - catalogo.productos.length : null;
    const progreso =
      catalogo.total && catalogo.total > 0 ? (catalogo.productos.length / catalogo.total) * 100 : 100;

    contenido = (
      <>
        <div className={claseGrid} aria-busy={cargandoMas}>
          {catalogo.productos.map((p, i) => (
            <ProductCard
              // La unidad en la clave: cambiar el filtro vuelve a elegir la
              // presentación inicial de cada tarjeta.
              key={`${p.id}-${catalogo.unidadActiva ?? ""}`}
              producto={p}
              variante={tarjetaVariante}
              indice={i}
              unidadPreferida={catalogo.unidadActiva}
            />
          ))}
          {cargandoMas && <EsqueletosCatalogo cantidad={4} />}
        </div>

        <div ref={centinela} className="pgrid-centinela" aria-hidden="true" />

        {(hayMas || error) && (
          <div className="cargar-mas-v2">
            {catalogo.total !== null && (
              <div className="cargar-mas-progreso">
                <span>
                  Viste <b>{catalogo.productos.length}</b> de <b>{catalogo.total}</b> productos
                </span>
                <span className="cargar-mas-barra" aria-hidden="true">
                  <i style={{ width: `${progreso}%` }} />
                </span>
              </div>
            )}
            {error && <p className="cargar-mas-error">No pudimos traer más productos.</p>}
            <button
              type="button"
              className="btn btn-outline"
              onClick={error ? catalogo.reintentar : cargarMas}
              disabled={cargandoMas}
            >
              {cargandoMas ? (
                <>
                  <Loader2 size={16} className="girando" aria-hidden="true" /> Cargando…
                </>
              ) : error ? (
                <>
                  <RotateCw size={15} aria-hidden="true" /> Reintentar
                </>
              ) : (
                <>
                  Cargar más{restantes !== null && restantes > 0 ? ` · ${restantes} restantes` : ""}
                </>
              )}
            </button>
          </div>
        )}

        {!hayMas && !error && <CierreCatalogo />}
      </>
    );
  }

  return (
    <section id={id} className="catalogo" aria-labelledby={titulo ? "catalogo-titulo" : undefined}>
      {(kicker || titulo || subtitulo) && (
        <header className="catalogo-cabecera">
          {kicker && <p className="catalogo-kicker">{kicker}</p>}
          {titulo && <h2 id="catalogo-titulo">{titulo}</h2>}
          {subtitulo && <p className="catalogo-subtitulo">{subtitulo}</p>}
        </header>
      )}
      <div className={`catalogo-layout ${conPanel ? "catalogo-layout--con-panel" : ""}`}>
        {conPanel && (
          <aside className="catalogo-panel" aria-label="Filtros">
            <FilterPanel />
          </aside>
        )}
        <div className="catalogo-resultados">{contenido}</div>
      </div>
    </section>
  );
}
