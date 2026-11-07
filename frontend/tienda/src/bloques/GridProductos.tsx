"use client";

import { Loader2, RotateCw } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { obtenerProductos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { ProductCard } from "@/componentes/ProductCard";
import { EncabezadoCategoria } from "@/componentes/tienda/IdentidadCategoria";
import { Seccion, claseDeVariante } from "./Seccion";
import { useCatalogoContexto, volverAlInicioDelCatalogo } from "@/contextos/CatalogoContexto";
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
          // Una vitrina de una sola categoría ya la nombra en su título.
          <ProductCard key={p.id} producto={p} variante={tarjetaVariante} indice={i} mostrarCategoria={!categoriaId} />
        ))}
      </div>
    </Seccion>
  );
}

// ------------------------------------------------------ modo catálogo interactivo

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
  const { hayMas, cargandoMas, error, cargarMas } = catalogo;

  // Un filtro nuevo es un catálogo nuevo: se empieza a leer por arriba (ver
  // `volverAlInicioDelCatalogo`). Va en un efecto para que el salto ocurra
  // con la lista nueva ya pintada; la primera pintura no cuenta, porque ahí
  // nadie cambió nada.
  const claveFiltro = `${catalogo.categoriaActiva}|${catalogo.unidadActiva}|${catalogo.orden}|${catalogo.busqueda}`;
  const primeraPintura = useRef(true);
  useEffect(() => {
    if (primeraPintura.current) {
      primeraPintura.current = false;
      return;
    }
    volverAlInicioDelCatalogo();
  }, [claveFiltro]);

  // Sin paginación: la siguiente tanda se pide sola ANTES de llegar al final
  // (800px de margen), hasta traer el catálogo entero, para que el cliente
  // casi nunca vea el esqueleto ni tenga que pulsar nada. Al terminar,
  // `CierreCatalogo` marca el final y el pie queda a la vista.
  useEffect(() => {
    const el = centinela.current;
    if (!el || !hayMas || cargandoMas || error) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) cargarMas();
      },
      { rootMargin: "800px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMas, cargandoMas, error, cargarMas]);

  // Sin panel lateral: repetía las categorías de las tarjetas de arriba. Los
  // filtros que no son categoría («Se vende por») y el orden viven en la
  // barra del catálogo. `mostrar_filtros` se conserva por compatibilidad.
  void mostrarFiltros;
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

    // En «Todos» con el orden recomendado los productos llegan agrupados por
    // categoría (ver `ORDEN_RECOMENDADOS`): cada vez que cambia, un separador
    // con su nombre, para saber en qué parte del catálogo se está. Con otro
    // orden (precio, A-Z…) las categorías se mezclan y el separador saldría
    // a cada tarjeta, así que no se pinta.
    const separar = catalogo.categoriaActiva === null && catalogo.orden === "recomendados";
    const categoriaPorId = new Map(catalogo.categorias.map((c) => [c.id, c]));
    // El distintivo de categoría en cada tarjeta sobra cuando todo lo que se
    // ve es de una categoría ya nombrada arriba: agrupado bajo su encabezado,
    // o con una categoría elegida. En mezclas (otro orden, búsqueda sin
    // categoría) se conserva: ahí es lo que dice de dónde es cada producto.
    const badgeEnTarjeta = !separar && catalogo.categoriaActiva === null;

    contenido = (
      <>
        <div className={claseGrid} aria-busy={cargandoMas}>
          {catalogo.productos.map((p, i) => {
            const nuevaCategoria = separar && (i === 0 || catalogo.productos[i - 1].categoria !== p.categoria);
            const cat = categoriaPorId.get(p.categoria);
            return (
              // La unidad en la clave: cambiar el filtro vuelve a elegir la
              // presentación inicial de cada tarjeta.
              <Fragment key={`${p.id}-${catalogo.unidadActiva ?? ""}`}>
                {nuevaCategoria && (
                  <EncabezadoCategoria
                    nombre={p.categoria_nombre}
                    subtitulo={cat?.subtitulo}
                    cantidad={cat?.num_productos ?? null}
                  />
                )}
                <ProductCard
                  producto={p}
                  variante={tarjetaVariante}
                  indice={i}
                  unidadPreferida={catalogo.unidadActiva}
                  mostrarCategoria={badgeEnTarjeta}
                />
              </Fragment>
            );
          })}
          {cargandoMas && <EsqueletosCatalogo cantidad={4} />}
        </div>

        <div ref={centinela} className="pgrid-centinela" aria-hidden="true" />

        {/* Solo si una tanda falló: sin esto la carga se quedaría quieta
            sin decir por qué. */}
        {error && (
          <div className="cargar-mas-v2">
            <p className="cargar-mas-error">No pudimos traer más productos.</p>
            <button type="button" className="btn btn-outline" onClick={catalogo.reintentar} disabled={cargandoMas}>
              {cargandoMas ? (
                <>
                  <Loader2 size={16} className="girando" aria-hidden="true" /> Cargando…
                </>
              ) : (
                <>
                  <RotateCw size={15} aria-hidden="true" /> Reintentar
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
    // Sin `id` propio, el ancla de siempre: la usan el CTA del hero y el buscador.
    <section id={id || "catalogo"} className="catalogo" aria-labelledby={titulo ? "catalogo-titulo" : undefined}>
      {(kicker || titulo || subtitulo) && (
        <header className="catalogo-cabecera">
          {kicker && <p className="catalogo-kicker">{kicker}</p>}
          {titulo && <h2 id="catalogo-titulo">{titulo}</h2>}
          {subtitulo && <p className="catalogo-subtitulo">{subtitulo}</p>}
        </header>
      )}
      <div className="catalogo-layout">
        <div className="catalogo-resultados">{contenido}</div>
      </div>
    </section>
  );
}
