import { PackageSearch, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { obtenerCategorias, obtenerProductos } from "../api/catalog";
import { CustomProductForm } from "../components/CustomProductForm";
import { ProductCard } from "../components/ProductCard";
import { useResaltarAlLlegar } from "../hooks/useResaltarAlLlegar";
import type { Categoria, Producto } from "../types";
import { colorCategoria } from "../utils";

interface Props {
  busqueda: string;
}

export function StorePage({ busqueda }: Props) {
  const [searchParams] = useSearchParams();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  // Permite llegar ya filtrados desde un enlace (p.ej. las categorías de Inicio).
  const [catActiva, setCatActiva] = useState<number | null>(() => {
    const inicial = searchParams.get("categoria");
    return inicial ? Number(inicial) : null;
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCatalogo, setTotalCatalogo] = useState<number | null>(null);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  // Tamaño real del catálogo (sin filtros) para el dato de escala en el encabezado.
  useEffect(() => {
    obtenerProductos()
      .then((data) => setTotalCatalogo(data.count))
      .catch(() => setTotalCatalogo(null));
  }, []);

  // Si llegamos desde la búsqueda global a resaltar algo, mostramos todo el
  // catálogo sin filtro de categoría para garantizar que el objetivo sea visible.
  const resaltarObjetivo = searchParams.get("resaltar");
  useEffect(() => {
    if (resaltarObjetivo) setCatActiva(null);
  }, [resaltarObjetivo]);

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerProductos({
      search: busqueda || undefined,
      categoria: catActiva ?? undefined,
    })
      .then((data) => setProductos(data.results))
      .catch(() => setError("No pudimos cargar el catálogo. Intenta de nuevo."))
      .finally(() => setCargando(false));
  }, [busqueda, catActiva]);

  useResaltarAlLlegar(productos);

  // Agrupar productos por categoría para el render (conserva el id para el color)
  const grupos = useMemo(() => {
    const mapa = new Map<number, { nombre: string; items: Producto[] }>();
    for (const p of productos) {
      if (!mapa.has(p.categoria)) {
        mapa.set(p.categoria, { nombre: p.categoria_nombre || "Otros", items: [] });
      }
      mapa.get(p.categoria)!.items.push(p);
    }
    return Array.from(mapa.entries());
  }, [productos]);

  const categoriaActivaNombre = categorias.find((c) => c.id === catActiva)?.nombre_categoria;

  return (
    <div>
      <section className="tienda-hero">
        <div className="contenedor tienda-hero-inner">
          <nav className="migas" aria-label="Ruta de navegación">
            <Link to="/">Inicio</Link>
            <span>/</span>
            <span aria-current="page">Tienda</span>
          </nav>

          <span className="etiqueta glass-dark">
            <ShoppingBag size={16} /> Catálogo completo
          </span>
          <h1>Nuestra tienda</h1>
          <p>
            Arma tu pedido eligiendo presentación, unidad y cantidad — incluso
            fraccionada en los productos que lo permiten.
          </p>
          {totalCatalogo !== null && (
            <p className="tienda-hero-stat">
              {totalCatalogo} {totalCatalogo === 1 ? "producto" : "productos"} en{" "}
              {categorias.length} {categorias.length === 1 ? "categoría" : "categorías"}
            </p>
          )}
        </div>
      </section>

      <div className="contenedor">
        <div className="chips-sticky">
          <div className="chips">
            <button
              className={`chip ${catActiva === null ? "activo" : ""}`}
              onClick={() => setCatActiva(null)}
            >
              Todo
            </button>
            {categorias.map((c) => {
              const activa = catActiva === c.id;
              return (
                <button
                  key={c.id}
                  className={`chip ${activa ? "activo" : ""}`}
                  style={activa ? { background: colorCategoria(c.id) } : undefined}
                  onClick={() => setCatActiva(c.id)}
                >
                  {!activa && (
                    <span className="chip-punto" style={{ background: colorCategoria(c.id) }} />
                  )}
                  {c.nombre_categoria}
                </button>
              );
            })}
          </div>
        </div>

        {!cargando && !error && (
          <p className="resultado-conteo">
            {productos.length} {productos.length === 1 ? "producto" : "productos"}
            {categoriaActivaNombre ? ` en ${categoriaActivaNombre}` : ""}
          </p>
        )}

        {error && <div className="error-box">{error}</div>}

        {cargando ? (
          <div className="grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="card-skeleton" key={i}>
                <div className="card-skeleton-media" />
                <div className="card-skeleton-body">
                  <div className="card-skeleton-line" style={{ width: "70%" }} />
                  <div className="card-skeleton-line" style={{ width: "40%" }} />
                  <div className="card-skeleton-line" style={{ width: "90%", height: "2.1rem", marginTop: "auto" }} />
                </div>
              </div>
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="vacio-rico">
            <PackageSearch size={40} strokeWidth={1.5} />
            <p>No encontramos productos para tu búsqueda.</p>
            <span>Prueba con otra categoría o revisa la ortografía.</span>
          </div>
        ) : (
          grupos.map(([categoriaId, { nombre, items }]) => (
            <section key={categoriaId} id={`categoria-${categoriaId}`} className="aparece">
              <h2
                className="categoria-titulo"
                style={{ "--cat-color": colorCategoria(categoriaId) } as CSSProperties}
              >
                {nombre}
              </h2>
              <div className="grid">
                {items.map((p) => (
                  <ProductCard key={p.id} producto={p} />
                ))}
              </div>
              <CustomProductForm categoriaId={categoriaId} categoriaNombre={nombre} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
