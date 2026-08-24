import { ArrowRight, Loader2, PackageSearch, RotateCw, ShoppingBag, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  obtenerCategorias,
  obtenerProductos,
  PRODUCTOS_POR_TANDA,
  type OrdenCatalogo,
} from "../api/catalog";
import chipFrutas from "../assets/chips/frutas.webp";
import chipGranos from "../assets/chips/granos.webp";
import chipTuberculos from "../assets/chips/tuberculo.webp";
import chipVerduras from "../assets/chips/verduras.webp";
import heroTienda from "../assets/hero-tienda.webp";
import { AvisoPrecios } from "../components/AvisoPrecios";
import { CustomProductForm } from "../components/CustomProductForm";
import { FiltrosTienda } from "../components/FiltrosTienda";
import { ProductCard } from "../components/ProductCard";
import { useSiteConfig } from "../context/SiteConfigContext";
import { useCatalogo } from "../hooks/useCatalogo";
import { useResaltarAlLlegar } from "../hooks/useResaltarAlLlegar";
import type { Categoria } from "../types";
import { normalizarTexto } from "../utils";

/**
 * Los chips del hero traen el nombre de la categoría incrustado en la imagen,
 * así que solo se muestran las categorías que tienen chip propio: no se puede
 * reutilizar el de Frutas para otra. La clave va sin tildes ni mayúsculas
 * (normalizarTexto) para que "Tuberculos" case con "Tubérculos".
 */
const CHIPS_CATEGORIA: Record<string, string> = {
  frutas: chipFrutas,
  verduras: chipVerduras,
  tuberculos: chipTuberculos,
  granos: chipGranos,
};

const MAX_CHIPS_HERO = 4;

interface Props {
  busqueda: string;
  onBuscar: (valor: string) => void;
}

export function StorePage({ busqueda, onBuscar }: Props) {
  const { config } = useSiteConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [orden, setOrden] = useState<OrdenCatalogo>("recomendados");
  // Tamaño real del catálogo sin filtros, para el dato de escala del hero.
  const [totalCatalogo, setTotalCatalogo] = useState<number | null>(null);

  // Permite llegar ya filtrados desde un enlace (p.ej. las categorías de Inicio).
  const catActiva = searchParams.get("categoria")
    ? Number(searchParams.get("categoria"))
    : null;

  function cambiarCategoria(id: number | null) {
    setSearchParams(
      (prev) => {
        const siguiente = new URLSearchParams(prev);
        if (id === null) siguiente.delete("categoria");
        else siguiente.set("categoria", String(id));
        return siguiente;
      },
      { replace: true }
    );
  }

  useEffect(() => {
    const controlador = new AbortController();
    obtenerCategorias().then(setCategorias).catch(() => undefined);
    // Solo interesa `count`: pedimos una fila, no cien productos completos.
    obtenerProductos({ pageSize: 1, signal: controlador.signal })
      .then((data) => setTotalCatalogo(data.count))
      .catch(() => undefined);
    return () => controlador.abort();
  }, []);

  const {
    productos,
    total,
    cargando,
    cargandoMas,
    error,
    hayMas,
    cargarMas,
    reintentar,
  } = useCatalogo({ busqueda, categoria: catActiva, orden });

  useResaltarAlLlegar(productos);

  const chipsHero = categorias
    .map((categoria) => ({
      categoria,
      chip: CHIPS_CATEGORIA[normalizarTexto(categoria.nombre_categoria)],
    }))
    .filter((x): x is { categoria: Categoria; chip: string } => Boolean(x.chip))
    .slice(0, MAX_CHIPS_HERO);

  const categoriaActiva = categorias.find((c) => c.id === catActiva) ?? null;
  const hayFiltros = Boolean(busqueda.trim()) || catActiva !== null;

  function limpiarFiltros() {
    onBuscar("");
    cambiarCategoria(null);
  }

  return (
    <div>
      <section className="tienda-hero">
        {/* Fondo fotográfico + velo verde: el velo es lo que sostiene el
            contraste del texto, así que va en el CSS, no en la imagen. */}
        <img
          className="tienda-hero-fondo"
          src={heroTienda}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
        {config.logo_url && (
          <img
            className="tienda-hero-logo"
            src={config.logo_url}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        )}

        <div className="tienda-hero-cuerpo">
          <div className="tienda-hero-inner">
            <nav className="migas" aria-label="Ruta de navegación">
              <Link to="/">Inicio</Link>
              <span>/</span>
              <span aria-current="page">Tienda</span>
            </nav>

            <span className="etiqueta glass-dark">
              <ShoppingBag size={15} /> Catálogo completo
            </span>
            <h1>
              Todo lo que necesitas <em>para tu negocio</em>
            </h1>
            <p>
              Productos frescos, distintas presentaciones y pedidos fáciles desde
              un solo lugar.
            </p>

            <div className="tienda-hero-acciones">
              <a href="#catalogo" className="btn btn-ambar">
                Explorar productos <ArrowRight size={17} />
              </a>
            </div>

            {totalCatalogo !== null && (
              <p className="tienda-hero-stat">
                <span>
                  <b>{totalCatalogo}</b>{" "}
                  {totalCatalogo === 1 ? "producto" : "productos"}
                </span>
                <i aria-hidden="true">·</i>
                <span>
                  <b>{categorias.length}</b>{" "}
                  {categorias.length === 1 ? "categoría" : "categorías"}
                </span>
              </p>
            )}
          </div>

          {/* Rellena el costado derecho con atajos reales al catálogo, en el
              orden que devuelve la API: si mañana cambia el orden o se desactiva
              una categoría, el hero se ajusta solo. */}
          {chipsHero.length > 0 && (
            <div className="tienda-hero-visual">
              {chipsHero.map(({ categoria, chip }, i) => (
                <Link
                  key={categoria.id}
                  to={`/tienda?categoria=${categoria.id}`}
                  className="hero-chip"
                  style={{ "--i": i } as CSSProperties}
                >
                  <img src={chip} alt={categoria.nombre_categoria} decoding="async" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="contenedor">
        <span id="catalogo" className="ancla-catalogo" aria-hidden="true" />
        <FiltrosTienda
          categorias={categorias}
          categoriaActiva={catActiva}
          onCategoria={cambiarCategoria}
          orden={orden}
          onOrden={setOrden}
        />

        <div className="tienda-resumen">
          <p className="resultado-conteo">
            {cargando ? (
              "Cargando productos…"
            ) : total === null ? (
              ""
            ) : (
              <>
                Mostrando <b>{productos.length}</b> de <b>{total}</b>{" "}
                {total === 1 ? "producto" : "productos"}
                {categoriaActiva ? ` en ${categoriaActiva.nombre_categoria}` : ""}
                {busqueda.trim() ? ` para “${busqueda.trim()}”` : ""}
              </>
            )}
          </p>
          {hayFiltros && (
            <button type="button" className="btn-limpiar" onClick={limpiarFiltros}>
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>

        <AvisoPrecios />

        {error && productos.length === 0 ? (
          <div className="vacio-rico">
            <PackageSearch size={40} strokeWidth={1.5} />
            <p>No pudimos cargar el catálogo</p>
            <span>Revisa tu conexión e inténtalo de nuevo.</span>
            <button type="button" className="btn btn-verde btn-sm" onClick={reintentar}>
              <RotateCw size={15} /> Reintentar
            </button>
          </div>
        ) : cargando ? (
          <div className="grid">
            {Array.from({ length: PRODUCTOS_POR_TANDA }).map((_, i) => (
              <div className="card-skeleton" key={i}>
                <div className="card-skeleton-media" />
                <div className="card-skeleton-body">
                  <div className="card-skeleton-line" style={{ width: "75%" }} />
                  <div className="card-skeleton-line" style={{ width: "40%" }} />
                  <div
                    className="card-skeleton-line"
                    style={{ width: "100%", height: "2.1rem", marginTop: "auto" }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="vacio-rico">
            <PackageSearch size={40} strokeWidth={1.5} />
            <p>No encontramos productos</p>
            <span>
              {categoriaActiva && !busqueda.trim()
                ? "Esta categoría todavía no tiene productos disponibles."
                : "Prueba buscando otra palabra o cambia de categoría."}
            </span>
            {hayFiltros && (
              <button
                type="button"
                className="btn btn-verde btn-sm"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid">
              {productos.map((p) => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>

            {(hayMas || error) && (
              <div className="cargar-mas">
                {error && (
                  <span className="cargar-mas-error">
                    No pudimos traer más productos.
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={error ? reintentar : cargarMas}
                  disabled={cargandoMas}
                >
                  {cargandoMas ? (
                    <>
                      <Loader2 size={16} className="girando" /> Cargando…
                    </>
                  ) : error ? (
                    <>
                      <RotateCw size={15} /> Reintentar
                    </>
                  ) : (
                    `Cargar más productos${
                      total !== null ? ` (${total - productos.length} restantes)` : ""
                    }`
                  )}
                </button>
              </div>
            )}
          </>
        )}

        <CustomProductForm categorias={categorias} categoriaFija={categoriaActiva} />
      </div>
    </div>
  );
}
