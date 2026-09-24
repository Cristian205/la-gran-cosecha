"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { ProductCard } from "@/componentes/ProductCard";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { useTienda } from "@/estado/tienda";
import { useSeleccionProducto } from "@/hooks/useSeleccionProducto";
import { obtenerProductosMasVendidos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { ImagenProducto } from "./ImagenProducto";
import { PrecioProducto } from "./PrecioProducto";
import { QuickAdd } from "./QuickAdd";
import { SelectorPresentacion } from "./SelectorPresentacion";

interface Props {
  /** Lo que el lienzo resolvió en el servidor (`RESUELVE_EN_SERVIDOR`). */
  datos?: Producto[];
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  /** Sobre el protagonista, cuando de verdad sale del ranking de ventas. */
  kicker_principal?: string;
  /** Sobre el protagonista cuando el negocio aún no tiene historial. */
  kicker_sin_historial?: string;
  titulo_secundarios?: string;
  /** Cuántos acompañan al protagonista. */
  secundarios?: number;
}

/**
 * Los favoritos de los negocios (FeaturedProducts): merchandising, no otra
 * fila de tarjetas.
 *
 * Nace del problema que describía el encargo: "Los más pedidos" pintaba los
 * productos con la MISMA tarjeta que la rejilla de abajo, así que el cliente
 * veía dos veces lo mismo con idéntico tratamiento. Aquí la composición es
 * otra: UN protagonista grande —foto, nombre, precio y compra directa— y a su
 * lado "También puedes pedir…", una lista corta en formato fila. Si esos
 * productos vuelven a aparecer abajo, se leen como el catálogo completo, no
 * como una repetición.
 *
 * # Honestidad del dato
 *
 * `/orders/productos-mas-vendidos/` rellena con productos del catálogo cuando
 * el negocio aún no tiene historial. `por_ventas` dice cuáles salen del
 * ranking de verdad: solo esos pueden llamarse "Más pedido". Si el
 * protagonista es relleno, su antetítulo cambia a uno que no promete nada.
 *
 * # Cuándo se retira
 *
 * Con un filtro o una búsqueda activa, esta sección se oculta: quien escribió
 * "papa" quiere ver papas, y un bloque de favoritos entre el buscador y los
 * resultados solo los empuja hacia abajo.
 */
export function FeaturedProducts({
  datos = [],
  // Sin "de la semana": el ranking no es semanal, y el antetítulo no puede
  // prometer una frecuencia que el dato no tiene.
  kicker = "Para empezar tu pedido",
  titulo = "Los favoritos de los negocios",
  subtitulo = "",
  kicker_principal = "El más pedido",
  kicker_sin_historial = "Destacado del catálogo",
  titulo_secundarios = "También puedes pedir…",
  secundarios = 4,
}: Props) {
  const [productos, setProductos] = useState<Producto[]>(datos);
  const catalogo = useCatalogoContexto();

  useEffect(() => {
    if (datos.length > 0) return;
    obtenerProductosMasVendidos()
      .then(setProductos)
      .catch(() => setProductos([]));
  }, [datos.length]);

  const conPrecio = productos.filter((p) => p.presentaciones.length > 0);
  const [principal, ...resto] = conPrecio;
  if (!principal || catalogo?.hayFiltros) return null;

  const acompanantes = resto.slice(0, Math.max(0, secundarios));

  return (
    <section className="favs" aria-labelledby="favs-titulo">
      <header className="favs-cabecera">
        {kicker && <p className="favs-kicker">{kicker}</p>}
        <h2 id="favs-titulo">{titulo}</h2>
        {subtitulo && <p className="favs-subtitulo">{subtitulo}</p>}
      </header>

      <div className={`favs-cuerpo ${acompanantes.length === 0 ? "favs-cuerpo--solo" : ""}`}>
        <Protagonista
          producto={principal}
          kicker={principal.por_ventas ? kicker_principal : kicker_sin_historial}
        />

        {acompanantes.length > 0 && (
          <div className="favs-lado">
            <h3 className="favs-lado-titulo">{titulo_secundarios}</h3>
            <div className="favs-lista">
              {acompanantes.map((p) => (
                <ProductCard key={p.id} producto={p} variante="compacta" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Protagonista({ producto, kicker }: { producto: Producto; kicker: string }) {
  const seleccion = useSeleccionProducto(producto);
  const abrirVistaRapida = useTienda((s) => s.abrirVistaRapida);
  const href = `/productos/${producto.slug}`;

  function abrir(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    abrirVistaRapida(producto);
  }

  return (
    <article className={`favs-principal ${seleccion.enCarrito ? "pcard--en-pedido" : ""}`}>
      <Link href={href} className="favs-principal-media" onClick={abrir} tabIndex={-1} aria-hidden="true">
        <ImagenProducto producto={producto} tamanoIcono={140} />
      </Link>

      <div className="favs-principal-info">
        <p className="favs-principal-kicker">{kicker}</p>
        <h3 className="favs-principal-nombre">
          <Link href={href} onClick={abrir}>
            {producto.nombre_producto}
          </Link>
        </h3>
        <p className="favs-principal-cat">{producto.categoria_nombre}</p>

        <PrecioProducto
          valor={seleccion.precioUnitario}
          unidad={seleccion.presentacion?.unidad_venta_nombre}
          tamano="grande"
        />
        <SelectorPresentacion seleccion={seleccion} productoNombre={producto.nombre_producto} />
        <QuickAdd
          seleccion={seleccion}
          productoNombre={producto.nombre_producto}
          permiteFraccion={producto.permite_fraccion}
          tamano="grande"
          textoLargo
        />
      </div>
    </article>
  );
}
