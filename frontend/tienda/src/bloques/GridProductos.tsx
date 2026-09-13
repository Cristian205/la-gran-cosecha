"use client";

import { Loader2, PackageSearch, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerProductos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { ProductCard } from "@/componentes/ProductCard";
import { Seccion, claseDeVariante } from "./Seccion";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";

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
 * cambiando en la misma pantalla— y gana "cargar más". Sin ese contexto
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

function CatalogoInteractivo({
  kicker,
  titulo,
  subtitulo,
  centrado,
  id,
  variante,
  tarjetaVariante,
}: {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  centrado: boolean;
  id?: string;
  variante?: string;
  tarjetaVariante?: string;
}) {
  const catalogo = useCatalogoContexto()!; // ya se comprobó en el padre

  if (catalogo.error && catalogo.productos.length === 0) {
    return (
      <div className="vacio-rico">
        <PackageSearch size={40} strokeWidth={1.5} />
        <p>No pudimos cargar el catálogo</p>
        <span>Revisa tu conexión e inténtalo de nuevo.</span>
        <button type="button" className="btn btn-verde btn-sm" onClick={catalogo.reintentar}>
          <RotateCw size={15} /> Reintentar
        </button>
      </div>
    );
  }

  if (catalogo.cargando) {
    return (
      <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo} centrado={centrado} id={id}>
        <div className="grid">
          {Array.from({ length: 8 }).map((_, i) => (
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
      </Seccion>
    );
  }

  if (catalogo.productos.length === 0) {
    return (
      <div className="vacio-rico">
        <PackageSearch size={40} strokeWidth={1.5} />
        <p>No encontramos productos</p>
        <span>
          {catalogo.categoriaActiva && !catalogo.busqueda.trim()
            ? "Esta categoría todavía no tiene productos disponibles."
            : "Prueba buscando otra palabra o cambia de categoría."}
        </span>
        {catalogo.hayFiltros && (
          <button type="button" className="btn btn-verde btn-sm" onClick={catalogo.limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo} centrado={centrado} id={id}>
      <div className={`grid ${claseDeVariante(variante, VARIANTES, "grid", "rejilla")}`}>
        {catalogo.productos.map((p, i) => (
          <ProductCard key={p.id} producto={p} variante={tarjetaVariante} indice={i} />
        ))}
      </div>

      {(catalogo.hayMas || catalogo.error) && (
        <div className="cargar-mas">
          {catalogo.error && (
            <span className="cargar-mas-error">No pudimos traer más productos.</span>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={catalogo.error ? catalogo.reintentar : catalogo.cargarMas}
            disabled={catalogo.cargandoMas}
          >
            {catalogo.cargandoMas ? (
              <>
                <Loader2 size={16} className="girando" /> Cargando…
              </>
            ) : catalogo.error ? (
              <>
                <RotateCw size={15} /> Reintentar
              </>
            ) : (
              `Cargar más productos${
                catalogo.total !== null
                  ? ` (${catalogo.total - catalogo.productos.length} restantes)`
                  : ""
              }`
            )}
          </button>
        </div>
      )}
    </Seccion>
  );
}
