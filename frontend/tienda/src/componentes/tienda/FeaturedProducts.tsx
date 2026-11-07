"use client";

import { ArrowRight, Award, Crown, ShoppingCart, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { PanelPedidosAnteriores, type Beneficio } from "@/componentes/RepetirPedido";
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { idsElegidos, obtenerProductosMasVendidos, obtenerProductosPorIds } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { formatoPrecio } from "@/lib/utiles";
import { ImagenProducto } from "./ImagenProducto";

interface Props {
  /** Lo que el lienzo resolvió en el servidor (`RESUELVE_EN_SERVIDOR`). */
  datos?: Producto[];
  /** Productos elegidos a mano, en orden. Vacío: los más pedidos. */
  productos?: number[];
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  /** Sobre el protagonista, cuando de verdad sale del ranking de ventas. */
  kicker_principal?: string;
  /** Sobre el protagonista cuando el negocio aún no tiene historial. */
  kicker_sin_historial?: string;
  /** El tipo de campaña del banner. `auto`: "más pedido" si sale del
   *  ranking real de ventas; si no, la etiqueta sin historial. */
  campana?: Campana | "auto";
  /** Frase corta bajo el nombre. Vacía: la de su tipo de campaña. */
  texto_comercial?: string;
  /** Precio orientativo ("Desde $3.000 / Libra aprox."). */
  mostrar_precio?: boolean;
  texto_boton?: string;
  /** El panel "¿Ya nos has pedido antes?" junto al banner. */
  mostrar_pedidos_anteriores?: boolean;
  /** Beneficios bajo el panel (título, texto, icono). Vacío: ninguno. */
  beneficios?: Beneficio[];
}

/** Los del diseño acordado con el negocio; editables (o vaciables) en el panel. */
const BENEFICIOS_POR_DEFECTO: Beneficio[] = [
  { titulo: "Productos frescos", texto: "Seleccionados para tu negocio", icono: "hoja" },
  { titulo: "Variedad y disponibilidad", texto: "Frutas, verduras, tubérculos y más", icono: "caja" },
  { titulo: "Para hogares y negocios", texto: "Pedidos flexibles y a tu medida", icono: "tienda" },
];

/** El icono de cada campaña en su etiqueta. */
const ICONO_CAMPANA: Record<Campana, LucideIcon> = {
  "mas-vendido": Crown,
  temporada: Sun,
  recomendado: Award,
  novedad: Sparkles,
};

type Campana = "mas-vendido" | "temporada" | "recomendado" | "novedad";

/** El texto por defecto de antes para el protagonista con ventas; hoy es «Más vendido». */
const KICKER_ANTERIOR = "El más pedido";

/** Etiqueta y frase por defecto de cada campaña; ambas editables desde el panel. */
const CAMPANAS: Record<Campana, { etiqueta: string; texto: string }> = {
  "mas-vendido": {
    etiqueta: "Más vendido",
    texto: "El que más piden los negocios. Fresco y listo para tu próximo pedido.",
  },
  temporada: {
    etiqueta: "De temporada",
    texto: "En su mejor momento de cosecha: más sabor y mejor rendimiento.",
  },
  recomendado: {
    etiqueta: "Recomendado",
    texto: "Seleccionado por nuestro equipo por su calidad y frescura.",
  },
  novedad: {
    etiqueta: "Nuevo",
    texto: "Recién llegado al catálogo. Pruébalo en tu próximo pedido.",
  },
};

/**
 * Los favoritos de los negocios (FeaturedProducts): merchandising, no otra
 * fila de tarjetas.
 *
 * Nace del problema que describía el encargo: "Los más pedidos" pintaba los
 * productos con la MISMA tarjeta que la rejilla de abajo, así que el cliente
 * veía dos veces lo mismo con idéntico tratamiento. Aquí es UN banner a todo
 * el ancho —foto, campaña, nombre, frase y "Comprar ahora", que lleva a su
 * tarjeta en el catálogo—, sin lista de acompañantes.
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
  subtitulo = "Productos más pedidos, frescos y listos para tu negocio.",
  kicker_principal = "",
  kicker_sin_historial = "Destacado del catálogo",
  productos: elegidos,
  campana = "auto",
  texto_comercial = "",
  mostrar_precio = true,
  texto_boton = "Comprar ahora",
  mostrar_pedidos_anteriores = true,
  beneficios = BENEFICIOS_POR_DEFECTO,
}: Props) {
  const ids = idsElegidos(elegidos);
  const [productos, setProductos] = useState<Producto[]>(datos);
  const catalogo = useCatalogoContexto();

  useEffect(() => {
    if (datos.length > 0) return;
    (ids.length > 0 ? obtenerProductosPorIds(ids) : obtenerProductosMasVendidos())
      .then(setProductos)
      .catch(() => setProductos([]));
    // `ids` se compara por su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.length, ids.join(",")]);

  const conPrecio = productos.filter((p) => p.presentaciones.length > 0);
  // El banner es fotográfico: protagoniza el primero (en el orden elegido o
  // del ranking) que tenga foto real. Solo si ninguno tiene, el primero, con
  // el respaldo de su categoría.
  const principal = conPrecio.find((p) => fotoDe(p)) ?? conPrecio[0];
  if (!principal || catalogo?.hayFiltros) return null;

  const tipo: Campana =
    campana === "auto" || !(campana in CAMPANAS) ? (principal.por_ventas ? "mas-vendido" : "recomendado") : campana;
  // «Automática»: con ventas reales, «Más vendido» (o el texto propio que el
  // negocio haya puesto en lugar del de siempre); sin historial, su etiqueta.
  const etiqueta =
    campana === "auto" || !(campana in CAMPANAS)
      ? principal.por_ventas
        ? kicker_principal && kicker_principal !== KICKER_ANTERIOR
          ? kicker_principal
          : CAMPANAS["mas-vendido"].etiqueta
        : kicker_sin_historial
      : CAMPANAS[tipo].etiqueta;

  return (
    <section className="favs" aria-labelledby="favs-titulo">
      <header className="favs-cabecera">
        {kicker && <p className="favs-kicker">{kicker}</p>}
        <h2 id="favs-titulo">{titulo}</h2>
        {subtitulo && <p className="favs-subtitulo">{subtitulo}</p>}
      </header>

      {/* Una sección, dos públicos: el banner para quien llega (70%) y el
          panel de pedidos anteriores para quien vuelve (30%). */}
      <div className={`favs-cuerpo ${mostrar_pedidos_anteriores ? "favs-cuerpo--con-panel" : "favs-cuerpo--solo"}`}>
        <BannerProtagonista
          producto={principal}
          campana={tipo}
          etiqueta={etiqueta}
          texto={texto_comercial.trim() || CAMPANAS[tipo].texto}
          mostrarPrecio={mostrar_precio}
          textoBoton={texto_boton.trim() || "Comprar ahora"}
        />
        {mostrar_pedidos_anteriores && <PanelPedidosAnteriores beneficios={beneficios} />}
      </div>
    </section>
  );
}

/** La foto real del producto: la suya o, si no tiene, la de una de sus presentaciones. */
function fotoDe(p: Producto): string | null {
  return p.imagen_url || p.presentaciones.find((x) => x.estado_presentacion && x.imagen_url)?.imagen_url || null;
}

/** El precio más bajo entre sus presentaciones, con su unidad: "Desde $3.000 / Libra". */
function precioDesde(p: Producto): { valor: number; unidad: string } | null {
  let mejor: { valor: number; unidad: string } | null = null;
  for (const x of p.presentaciones) {
    const valor = parseFloat(x.precio_unitario);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    if (!mejor || valor < mejor.valor) mejor = { valor, unidad: x.unidad_venta_nombre };
  }
  return mejor;
}

/**
 * El banner del protagonista: un escaparate, no una ficha de compra.
 *
 * No se compra aquí. Todo el banner (y su botón) lleva a la tarjeta del
 * producto en el catálogo —`irAProducto` del contexto—, donde se elige
 * variedad, unidad y cantidad con el control de siempre. Sin catálogo en la
 * página (el banner puesto en el Inicio) es un enlace normal a la tienda con
 * `?producto=`, que hace lo mismo al llegar.
 *
 * Un solo enlace real —el botón— que se estira sobre todo el banner con un
 * pseudo-elemento: todo es clicable sin anidar enlaces, y el lector de
 * pantalla oye un enlace, no tres.
 */
function BannerProtagonista({
  producto,
  campana,
  etiqueta,
  texto,
  mostrarPrecio,
  textoBoton,
}: {
  producto: Producto;
  campana: Campana;
  etiqueta: string;
  texto: string;
  mostrarPrecio: boolean;
  textoBoton: string;
}) {
  const catalogo = useCatalogoContexto();
  const href = `/tienda?categoria=${producto.categoria}&producto=${producto.id}`;
  const foto = fotoDe(producto);
  const IconoCampana = ICONO_CAMPANA[campana];
  const desde = mostrarPrecio ? precioDesde(producto) : null;

  function ir(e: MouseEvent<HTMLAnchorElement>) {
    if (!catalogo) return; // sin catálogo aquí: navegación normal a la tienda
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    catalogo.irAProducto(producto);
  }

  return (
    <article className="favs-banner" data-campana={campana}>
      <div className="favs-banner-media">
        <ImagenProducto producto={{ ...producto, imagen_url: foto }} tamanoIcono={120} prioridad />
      </div>
      {/* Dos grupos: qué es (campaña, nombre, frase) y cómo se compra
          (precio de referencia con su unidad, y el botón). */}
      <div className="favs-banner-info">
        <div className="favs-banner-cabeza">
          <span className="favs-banner-etiqueta">
            <IconoCampana size={14} strokeWidth={2.2} aria-hidden="true" />
            {etiqueta}
          </span>
          <h3 className="favs-banner-nombre">{producto.nombre_producto}</h3>
          {texto && <p className="favs-banner-texto">{texto}</p>}
        </div>
        <div className="favs-banner-compra">
          {desde && (
            <p className="favs-banner-precio">
              <span className="favs-banner-precio-rotulo">Precio de referencia</span>
              <span className="favs-banner-precio-valor">
                <b>{formatoPrecio(desde.valor)}</b> <span>/ {desde.unidad}</span>
              </span>
            </p>
          )}
          <Link
            href={href}
            className="favs-banner-cta"
            onClick={ir}
            aria-label={`${textoBoton}: ${producto.nombre_producto}`}
          >
            <ShoppingCart size={17} aria-hidden="true" />
            {textoBoton}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
