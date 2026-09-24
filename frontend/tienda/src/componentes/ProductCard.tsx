"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import { claseDeVariante } from "@/bloques/Seccion";
import { useTienda } from "@/estado/tienda";
import { useSeleccionProducto } from "@/hooks/useSeleccionProducto";
import type { Producto } from "@/lib/tipos";
import { colorCategoriaTematicoTinte } from "@/lib/utiles";
import { ImagenProducto } from "@/componentes/tienda/ImagenProducto";
import { PrecioProducto } from "@/componentes/tienda/PrecioProducto";
import { QuickAdd } from "@/componentes/tienda/QuickAdd";
import { SelectorPresentacion } from "@/componentes/tienda/SelectorPresentacion";

/**
 * `estandar` es la tarjeta del catálogo. `compacta` es una fila —imagen chica,
 * nombre, precio y el mismo "cantidad + agregar"— para donde una tarjeta
 * grande sobra: compra rápida, un carrusel denso, una lista larga. Mismos
 * datos y mismos componentes por dentro; solo cambia cómo se acomodan.
 */
const VARIANTES = ["estandar", "compacta"] as const;

interface Props {
  producto: Producto;
  variante?: string;
  /** Una cinta comercial ("Más pedido", "Favorito"). Opt-in: la pasa quien
   *  arma la rejilla, nunca el catálogo por su cuenta. */
  etiqueta?: string;
  /** Su posición dentro de la rejilla, solo para escalonar la entrada. */
  indice?: number;
  /** La unidad del filtro "Se vende por", para arrancar en ella. */
  unidadPreferida?: number | null;
}

/**
 * La tarjeta de producto: imagen → qué es → cuánto cuesta → cuánto llevo.
 *
 * El orden de lectura es el del encargo (PRODUCTO → INFORMACIÓN → SELECCIÓN →
 * CANTIDAD → AGREGAR) y cada fila tiene un solo trabajo, para que no parezca
 * un formulario: la categoría es una línea pequeña, el nombre manda, la
 * presentación son dos desplegables discretos con nombre ("Por Libra"), el
 * precio es la cifra grande con "aprox. / Libra" debajo, y abajo del todo,
 * alineado entre tarjetas vecinas, el control de compra.
 *
 * Imagen y nombre abren la vista rápida (más grande, con las unidades y sus
 * precios a la vista) sin salir del catálogo; siguen siendo un enlace real a
 * /productos/<slug> —clic central, "abrir en pestaña nueva", rastreadores—.
 *
 * Una tarjeta cuyo producto ya está en el pedido lleva un borde de marca: en
 * un pedido de cuarenta líneas, ver de un vistazo qué ya se agregó importa.
 */
export function ProductCard({ producto, variante, etiqueta, indice = 0, unidadPreferida = null }: Props) {
  const seleccion = useSeleccionProducto(producto, unidadPreferida);
  const abrirVistaRapida = useTienda((s) => s.abrirVistaRapida);

  const clase = claseDeVariante(variante, VARIANTES, "producto-card", "estandar");
  const esCompacta = clase.endsWith("compacta");
  const href = `/productos/${producto.slug}`;
  const { presentacion, sinPresentaciones, agotado, enCarrito, agregado } = seleccion;

  function abrir(e: MouseEvent<HTMLAnchorElement>) {
    // Solo el clic "normal": con Ctrl/⌘/Mayús o el botón central el cliente
    // pidió explícitamente una pestaña nueva, y se respeta.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    abrirVistaRapida(producto);
  }

  const estilo = {
    "--cat-tinte": colorCategoriaTematicoTinte(producto.categoria_nombre, producto.categoria),
    "--retraso": `${Math.min(indice % 24, 11) * 35}ms`,
  } as CSSProperties;

  const claseEstado = [
    "pcard",
    esCompacta ? "pcard--compacta" : "",
    enCarrito ? "pcard--en-pedido" : "",
    agregado ? "pcard--agregado" : "",
    agotado ? "pcard--agotado" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cinta = agotado ? (
    <span className="pcard-cinta pcard-cinta--agotado">Agotado</span>
  ) : etiqueta ? (
    <span className="pcard-cinta">{etiqueta}</span>
  ) : null;

  return (
    <article className={claseEstado} id={`producto-${producto.id}`} style={estilo}>
      <Link href={href} className="pcard-media" onClick={abrir} tabIndex={-1} aria-hidden="true">
        <ImagenProducto producto={producto} tamanoIcono={esCompacta ? 30 : 76} />
        {!esCompacta && cinta}
      </Link>

      <div className="pcard-cuerpo">
        {!esCompacta && <span className="pcard-cat">{producto.categoria_nombre}</span>}
        <h3 className="pcard-nombre">
          <Link href={href} onClick={abrir}>
            {producto.nombre_producto}
          </Link>
        </h3>

        {sinPresentaciones ? (
          <p className="pcard-vacio">Pronto disponible</p>
        ) : (
          <>
            <SelectorPresentacion seleccion={seleccion} productoNombre={producto.nombre_producto} />
            <div className="pcard-compra">
              <PrecioProducto
                valor={seleccion.precioUnitario}
                unidad={presentacion?.unidad_venta_nombre}
              />
              <QuickAdd
                seleccion={seleccion}
                productoNombre={producto.nombre_producto}
                permiteFraccion={producto.permite_fraccion}
              />
            </div>
          </>
        )}
      </div>
    </article>
  );
}
