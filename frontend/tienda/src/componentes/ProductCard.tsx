"use client";

import { Leaf } from "lucide-react";
import Link from "next/link";
import { memo, useState, type CSSProperties, type MouseEvent } from "react";
import { claseDeVariante } from "@/bloques/Seccion";
import { useTienda } from "@/estado/tienda";
import { useSeleccionProducto } from "@/hooks/useSeleccionProducto";
import type { Producto } from "@/lib/tipos";
import { altDeProducto, colorCategoriaTematicoTinte, normalizarTexto } from "@/lib/utiles";
import { BadgeCategoria } from "@/componentes/tienda/IdentidadCategoria";
import { ImagenProducto } from "@/componentes/tienda/ImagenProducto";
import { PrecioProducto } from "@/componentes/tienda/PrecioProducto";
import { QuickAdd } from "@/componentes/tienda/QuickAdd";
import { SelectorPresentacion, SelectorVariedad } from "@/componentes/tienda/SelectorPresentacion";

/**
 * `estandar` es la tarjeta del catálogo. `compacta` es una fila —imagen chica,
 * nombre, precio y el mismo "cantidad + agregar"— para donde una tarjeta
 * grande sobra: compra rápida, un carrusel denso, una lista larga. Mismos
 * datos y mismos componentes por dentro; solo cambia cómo se acomodan.
 */
const VARIANTES = ["estandar", "compacta"] as const;

/**
 * Las cintas comerciales que la tarjeta dibuja sobre la foto, con el mismo
 * vocabulario y colores que el banner de campañas (`FeaturedProducts`).
 *
 * Son sellos de DATO: cada uno necesita algo real que lo respalde. Hoy el
 * backend solo sabe uno —`por_ventas`, del ranking de ventas—; los demás
 * esperan su campo y hasta entonces solo aparecen si quien arma la rejilla
 * los pasa. Ninguno se adivina.
 */
const SELLOS = {
  "mas-vendido": "Más vendido",
  destacado: "Destacado",
  temporada: "Temporada",
  oferta: "Oferta",
  nuevo: "Nuevo",
} as const;

export type Sello = keyof typeof SELLOS;

interface Props {
  producto: Producto;
  variante?: string;
  /** Una cinta comercial ("Más pedido", "Favorito"). Opt-in: la pasa quien
   *  arma la rejilla, nunca el catálogo por su cuenta. */
  etiqueta?: string;
  /** Sellos flotantes sobre la foto. Sin ellos se usa el único que hay dato
   *  para afirmar: "Más vendido" si `por_ventas`. */
  sellos?: Sello[];
  /** Su posición dentro de la rejilla, solo para escalonar la entrada. */
  indice?: number;
  /** La unidad del filtro "Se vende por", para arrancar en ella. */
  unidadPreferida?: number | null;
  /** El distintivo de categoría sobre la foto. Quien arma una rejilla de
   *  una sola categoría (agrupada bajo su encabezado, o filtrada) lo apaga:
   *  repetir "FRUTAS" en cada tarjeta bajo el título "Frutas" es ruido. */
  mostrarCategoria?: boolean;
}

/**
 * La tarjeta de producto: imagen → qué es → cuánto cuesta → cuánto llevo.
 *
 * El orden de lectura es el mismo en todos los tamaños: foto → nombre →
 * [Variedad:] → cantidad + unidad ("(−) 5 (+) Kilogramos ⌄") → precio →
 * agregar. Son los mismos selectores de siempre sobre la misma
 * `useSeleccionProducto`: elegir una variedad recarga sus unidades y el
 * precio, elegir una unidad cambia la presentación y su precio.
 *
 * La variedad tiene su propia línea aunque sea una sola ("Variedad: Común",
 * fija, sin flecha): así todas las tarjetas de una fila tienen la misma
 * estructura y la de una sola variedad no queda con un hueco junto a la
 * vecina que tiene selector. El CSS solo cambia medidas por tamaño; el
 * teléfono deja el botón en su icono para que quepan dos columnas.
 *
 * Imagen y nombre abren la vista rápida (más grande, con las unidades y sus
 * precios a la vista) sin salir del catálogo; siguen siendo un enlace real a
 * /productos/<slug> —clic central, "abrir en pestaña nueva", rastreadores—.
 *
 * Una tarjeta cuyo producto ya está en el pedido lleva un borde de marca: en
 * un pedido de cuarenta líneas, ver de un vistazo qué ya se agregó importa.
 *
 * La foto sigue a la presentación elegida, igual que la galería de la ficha:
 * pasar de "Libra" a "Bulto" en el desplegable muestra el bulto, con el mismo
 * fundido. Lo que se ve y lo que se va a agregar nunca se contradicen.
 */
function TarjetaProducto({
  producto,
  variante,
  etiqueta,
  sellos = [],
  indice = 0,
  unidadPreferida = null,
  mostrarCategoria = true,
}: Props) {
  const seleccion = useSeleccionProducto(producto, unidadPreferida);
  const abrirVistaRapida = useTienda((s) => s.abrirVistaRapida);

  const clase = claseDeVariante(variante, VARIANTES, "producto-card", "estandar");
  const esCompacta = clase.endsWith("compacta");
  const href = `/productos/${producto.slug}`;
  const { presentacion, sinPresentaciones, agotado, enCarrito, agregado, imagenUrl } = seleccion;
  // El fundido solo cuando la foto cambia por una elección, no al montar la
  // rejilla: ahí ya está la entrada escalonada de la tarjeta.
  const [fotoInicial] = useState(imagenUrl);
  const fotoCambiada = imagenUrl !== fotoInicial;
  // La variedad solo cuenta si dice algo: si repite el nombre del producto
  // ("Papa" / "Papa") o viene vacía, el producto no tiene variedad que
  // mostrar y no se reserva su campo.
  const variasVariantes = seleccion.grupos.length > 1;
  const nombreVariedad = seleccion.grupo?.nombre?.trim() ?? "";
  const variedad =
    nombreVariedad && normalizarTexto(nombreVariedad) !== normalizarTexto(producto.nombre_producto)
      ? nombreVariedad
      : "";

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

  // Agotado no lleva sello: "Más vendido" sobre algo que no se puede pedir
  // es una promesa que la tienda no cumple.
  const sellosVisibles: Sello[] = sellos.length > 0 ? sellos : producto.por_ventas ? ["mas-vendido"] : [];

  return (
    <article className={claseEstado} id={`producto-${producto.id}`} style={estilo}>
      <Link href={href} className="pcard-media" onClick={abrir} tabIndex={-1} aria-hidden="true">
        <ImagenProducto
          key={imagenUrl ?? "sin-foto"}
          producto={{ ...producto, imagen_url: imagenUrl ?? null }}
          alt={altDeProducto(producto, seleccion.grupo?.nombre)}
          tamanoIcono={esCompacta ? 30 : 76}
          className={fotoCambiada ? "pimg--cambio" : ""}
        />
        {!esCompacta && mostrarCategoria && producto.categoria_nombre && (
          <BadgeCategoria nombre={producto.categoria_nombre} />
        )}
        {!esCompacta && cinta}
        {!esCompacta && !agotado && sellosVisibles.length > 0 && (
          <span className="pcard-sellos">
            {sellosVisibles.map((s) => (
              <span key={s} className="pcard-sello" data-sello={s}>
                {SELLOS[s]}
              </span>
            ))}
          </span>
        )}
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
            {/* La variedad, en su línea y con su rótulo. Elegir aquí recoloca
                unidades, precio, foto y cantidad por el mismo camino de
                siempre. Sin variedad no se dibuja nada: ni campo ni hueco. */}
            {!esCompacta && (variasVariantes || variedad) && (
              <div className="pcard-campos">
                {variasVariantes && seleccion.grupo ? (
                  <SelectorVariedad
                    seleccion={seleccion}
                    productoNombre={producto.nombre_producto}
                    className="pcard-campo"
                    prefijo="Variedad:"
                    icono={<Leaf size={11} strokeWidth={2.5} />}
                  />
                ) : (
                  // Una sola variedad no es una elección, es un dato: misma
                  // forma de campo, sin flecha.
                  <span className="pcard-campo pcard-campo--fijo pcard-campo--variedad">
                    <span className="selp-icono" aria-hidden="true">
                      <Leaf size={11} strokeWidth={2.5} />
                    </span>
                    <span className="selp-prefijo">Variedad:</span>
                    <span className="selp-valor">{variedad}</span>
                  </span>
                )}
              </div>
            )}

            {/* La fila sin rótulos solo la usa la tarjeta compacta. */}
            {esCompacta && (
              <SelectorPresentacion seleccion={seleccion} productoNombre={producto.nombre_producto} />
            )}
            <div className="pcard-compra">
              <PrecioProducto
                valor={seleccion.precioUnitario}
                unidad={presentacion?.unidad_venta_nombre}
                metaLarga={!esCompacta}
              />
              {/* "Agregar al pedido" con texto; el teléfono lo deja en su
                  icono por CSS (el `aria-label` del botón no cambia).
                  `conUnidad`: la unidad de venta va junto a la cantidad y en
                  plural ("(−) 5 (+) Kilogramos ⌄"). Son las presentaciones
                  reales de la variedad elegida, no la unidad base. */}
              <QuickAdd
                seleccion={seleccion}
                productoNombre={producto.nombre_producto}
                permiteFraccion={producto.permite_fraccion}
                textoLargo={!esCompacta}
                conUnidad={!esCompacta}
              />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

/**
 * Memorizada: el catálogo acumula tandas en una sola lista y cada cambio de
 * su estado (`cargandoMas`, la tanda nueva, el total) vuelve a pintar la
 * rejilla entera. Sin `memo`, con 190 productos cargados se repintaban las
 * 190 tarjetas por cada tanda —y cada una más cara que la anterior—, que es
 * lo que hacía que el scroll infinito se volviera más lento cuanto más se
 * bajaba. Las props que pasa la rejilla son primitivas o el mismo objeto
 * `producto` de siempre (las tandas se concatenan sin copiarlo), así que una
 * tarjeta ya pintada se salta el render.
 */
export const ProductCard = memo(TarjetaProducto);
