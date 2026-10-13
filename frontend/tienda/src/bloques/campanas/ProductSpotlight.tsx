"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Crown, Pause, Play, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { agruparPresentaciones } from "@/componentes/PresentationSelector";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import { idsElegidos, obtenerProductosMasVendidos, obtenerProductosPorIds } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { cantidadInicial, formatoPrecio, reglaCantidad } from "@/lib/utiles";
import { Boton, TipografiaEditorial, useParallax, useSinMovimiento } from "./comunes";
import { DecoracionBotanica } from "./DecoracionBotanica";

/**
 * Los más vendidos del mercado, como carrusel publicitario.
 *
 * Usa el mismo dato que "más vendidos" (`/orders/productos-mas-vendidos/`):
 * el ranking real por unidades vendidas en pedidos entregados. Cada producto
 * es una diapositiva a pantalla completa —foto enorme, nombre gigante detrás,
 * una acción—, y debajo van las cinco pestañas con su foto y su puesto.
 *
 * # Honestidad
 *
 * El endpoint completa con productos del catálogo cuando el negocio aún no
 * tiene historial, y marca cuáles salen del ranking (`por_ventas`). Solo esos
 * llevan "N.º X más vendido", y su puesto es el del ranking real aunque
 * alguno se omita (un "#1" que en realidad es el segundo sería mentira). Si
 * no hay ninguno con ventas, el carrusel muestra el catálogo sin llamarlo
 * "más vendido".
 *
 * # Movimiento
 *
 * Avanza solo cada `intervalo` segundos, con una barra que lo anuncia, y se
 * detiene al pasar el cursor, al enfocar con el teclado, al salir de la
 * pantalla o con el botón de pausa (contenido que se mueve solo necesita
 * poder pararse). Con `prefers-reduced-motion` no avanza solo y las
 * transiciones son un simple cambio.
 *
 * # Variantes
 *
 * Sin variante, el aspecto de siempre. «botanico» es el rediseño premium:
 * fondo blanco, ramas de trazo fino en las esquinas, curvas doradas,
 * flechas a los lados y pestañas tipo tarjeta. Es una variante y no un cambio
 * del aspecto base para que ninguna otra tienda cambie sin pedirlo. Sus
 * colores salen de tokens del bloque (`--ps-fondo`, `--ps-acento`,
 * `--ps-dorado`) y todos los textos, de sus propiedades.
 */
interface Props {
  datos?: Producto[];
  /** Slugs separados por coma que no deben salir en el carrusel. */
  omitir?: string;
  kicker?: string;
  texto?: string;
  cta_texto?: string;
  /** Cuántos productos del ranking muestra. */
  cantidad?: number;
  /** Segundos por diapositiva cuando avanza solo. */
  intervalo?: number;
  /** Productos elegidos a mano, en orden. Vacío: el ranking real de ventas. */
  productos?: number[];
  /** El final del texto en serif cursiva y color de acento («como el tuyo.»). */
  texto_resaltado?: string;
  /** Las ramas y curvas de la variante «botanico». */
  decoracion?: boolean;
  /** La etiqueta «N.º X» sobre la foto (solo existe si el puesto es real). */
  mostrar_puesto?: boolean;
  /** El marco de hojas y cinta dorada alrededor del bloque (variante «botanico»). */
  mostrar_marco?: boolean;
  /** Otra imagen de marco (PNG/WebP con fondo transparente). Vacía: la de la variante. */
  marco?: string;
  variante?: string;
}

type ConVentas = Producto & { por_ventas?: boolean };

interface Diapositiva {
  producto: Producto;
  /** Puesto REAL en el ranking de ventas, o null si es relleno del catálogo. */
  puesto: number | null;
}

const UMBRAL_DESLIZAR = 50;

/** El marco de hojas que trae la variante «botanico» (WebP con transparencia). */
const MARCO_BOTANICO = "/img/marco-botanico.webp";

export function ProductSpotlight({
  datos = [],
  omitir = "",
  kicker = "Los más vendidos de nuestro mercado",
  texto = "Uno de los productos que más piden negocios como el tuyo.",
  cta_texto = "Quiero este producto",
  cantidad = 5,
  intervalo = 7,
  productos: elegidos,
  texto_resaltado = "",
  decoracion = true,
  mostrar_puesto = true,
  mostrar_marco = true,
  marco = "",
  variante,
}: Props) {
  const botanico = variante === "botanico";
  const conMarco = botanico && mostrar_marco;
  const ids = idsElegidos(elegidos);
  const aMano = ids.length > 0;
  const [productos, setProductos] = useState<ConVentas[]>(datos);
  const [actual, setActual] = useState(0);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  const [pausadoPorUsuario, setPausadoPorUsuario] = useState(false);
  const [enPausaTemporal, setEnPausaTemporal] = useState(false);
  const [aLaVista, setALaVista] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const inicioToque = useRef<number | null>(null);
  const movimiento = useParallax(ref, { desde: 1.1, hasta: 1.24, desplazamiento: 7 });
  const quieto = useSinMovimiento();
  const { agregar, agregado } = useAgregarAlCarrito();

  useEffect(() => {
    if (datos.length > 0) return;
    (aMano ? obtenerProductosPorIds(ids) : obtenerProductosMasVendidos())
      .then(setProductos)
      .catch(() => setProductos([]));
    // `ids` se compara por su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.length, ids.join(",")]);

  // Elegidos a mano: esos y en ese orden, sin puesto (no vienen del ranking y
  // decir "N.º 1 en ventas" sería inventarlo).
  const diapositivas = aMano
    ? productos.slice(0, Math.max(1, cantidad)).map((producto) => ({ producto, puesto: null }))
    : armarDiapositivas(productos, omitir, cantidad);
  const total = diapositivas.length;
  const conRanking = diapositivas.some((d) => d.puesto !== null);

  const ir = useCallback(
    (indice: number, dir?: 1 | -1) => {
      if (total === 0) return;
      const siguiente = ((indice % total) + total) % total;
      setDireccion(dir ?? (siguiente > actual ? 1 : -1));
      setActual(siguiente);
    },
    [total, actual]
  );

  // Solo avanza mientras está a la vista.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setALaVista(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const avanzando = total > 1 && !quieto && !pausadoPorUsuario && !enPausaTemporal && aLaVista;

  useEffect(() => {
    if (!avanzando) return;
    const t = window.setTimeout(() => ir(actual + 1, 1), intervalo * 1000);
    return () => window.clearTimeout(t);
  }, [avanzando, actual, intervalo, ir]);

  if (total === 0) return null;
  const { producto, puesto } = diapositivas[Math.min(actual, total - 1)];
  const presentacion = agruparPresentaciones(producto.presentaciones)[0]?.opciones[0] ?? null;

  function comprar() {
    if (!presentacion) return;
    const regla = reglaCantidad(presentacion, producto.permite_fraccion, producto.tipo_cantidad);
    agregar({
      productoId: producto.id,
      productoNombre: producto.nombre_producto,
      imagenUrl: producto.imagen_url,
      presentacionId: presentacion.id,
      presentacionNombre: `${presentacion.nombre_presentacion} · ${presentacion.unidad_venta_nombre}`,
      precioUnitario: parseFloat(presentacion.precio_unitario),
      // La primera cantidad válida de ESTA presentación ("Caja x 6" se pide
      // de 6 en 6: un 1 fijo lo rechazaría el pedido).
      cantidad: cantidadInicial(regla),
      permiteFraccion: producto.permite_fraccion,
      tipoCantidad: producto.tipo_cantidad,
      minimo: regla.minimo,
      paso: regla.paso,
      decimales: regla.decimales,
    });
  }

  function alSoltar(e: PointerEvent) {
    if (inicioToque.current === null) return;
    const dx = e.clientX - inicioToque.current;
    inicioToque.current = null;
    if (Math.abs(dx) < UMBRAL_DESLIZAR) return;
    ir(actual + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }

  const duracion = quieto ? 0 : 0.7;
  const idPanel = "ps-diapositiva";

  return (
    <section
      ref={ref}
      className={`ps ps--carrusel ${botanico ? "ps--botanico" : ""} ${conMarco ? "ps--con-marco" : ""}`}
      aria-roledescription="carrusel"
      aria-label={conRanking ? "Los más vendidos" : "Productos de nuestro mercado"}
      onMouseEnter={() => setEnPausaTemporal(true)}
      onMouseLeave={() => setEnPausaTemporal(false)}
      onFocus={() => setEnPausaTemporal(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setEnPausaTemporal(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") ir(actual + 1, 1);
        if (e.key === "ArrowLeft") ir(actual - 1, -1);
      }}
    >
      <TipografiaEditorial />
      {botanico && decoracion && <DecoracionBotanica />}
      {conMarco && (
        // Un fondo y no un <img>: es decoración, no contenido, y así no entra
        // en el árbol de accesibilidad ni compite por la carga con las fotos.
        <div
          className="ps-marco"
          aria-hidden="true"
          // Una variable y no `backgroundImage`: en escritorio el CSS la usa
          // de fondo y en el móvil como `border-image` (ver campanas.css).
          style={{ "--ps-marco": `url("${(marco || MARCO_BOTANICO).replace(/"/g, "%22")}")` } as CSSProperties}
        />
      )}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={`gigante-${producto.id}`}
          className="ps-gigante"
          aria-hidden="true"
          initial={{ opacity: 0, x: 60 * direccion }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 * direccion }}
          transition={{ duration: duracion, ease: [0.22, 1, 0.36, 1] }}
        >
          {producto.nombre_producto}
        </motion.span>
      </AnimatePresence>

      {botanico && total > 1 && (
        <>
          <button type="button" className="ps-lado ps-lado--anterior" onClick={() => ir(actual - 1, -1)} aria-label="Producto anterior">
            <ChevronLeft size={22} />
          </button>
          <button type="button" className="ps-lado ps-lado--siguiente" onClick={() => ir(actual + 1, 1)} aria-label="Producto siguiente">
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div className="cmp-inner">
        <div
          id={idPanel}
          className="ps-grid"
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${actual + 1} de ${total}: ${producto.nombre_producto}`}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") inicioToque.current = e.clientX;
          }}
          onPointerUp={alSoltar}
          onPointerCancel={() => (inicioToque.current = null)}
        >
          <div className="ps-foto">
            <AnimatePresence initial={false} custom={direccion}>
              <motion.div
                key={producto.id}
                className="ps-foto-recorte"
                custom={direccion}
                initial={{ clipPath: direccion > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }}
                animate={{ clipPath: "inset(0 0% 0 0%)" }}
                exit={{ opacity: 0.4 }}
                transition={{ duration: quieto ? 0 : 0.9, ease: [0.77, 0, 0.175, 1] }}
              >
                {producto.imagen_url ? (
                  <motion.div className="ps-foto-capa" style={movimiento}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={producto.imagen_url}
                      alt={producto.nombre_producto}
                      loading={actual === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </motion.div>
                ) : (
                  <span className="ps-foto-vacia" aria-hidden="true">
                    {producto.nombre_producto.charAt(0)}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
            {puesto !== null && mostrar_puesto && (
              <span className="ps-puesto" aria-hidden="true">
                {botanico && <Crown size={18} strokeWidth={2.2} className="ps-puesto-corona" />}
                <small>N.º</small>
                {puesto}
              </span>
            )}
          </div>

          <div className="ps-texto" aria-live={avanzando ? "off" : "polite"}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={producto.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: quieto ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="cmp-kicker">
                  {puesto !== null ? (
                    <>
                      {kicker} <span className="ps-kicker-puesto">· N.º {puesto} en ventas</span>
                    </>
                  ) : aMano ? (
                    kicker
                  ) : (
                    "De nuestro mercado"
                  )}
                </p>
                <h2>{producto.nombre_producto}</h2>
                <p className="ps-parrafo">
                  {puesto !== null || aMano ? (
                    <>
                      {texto}
                      {texto_resaltado && <> <em>{texto_resaltado}</em></>}
                    </>
                  ) : (
                    "Disponible en nuestro catálogo para tu próximo pedido."
                  )}
                </p>
                {producto.precio_desde && (
                  <p className="ps-precio">
                    <span>Desde</span> <strong>{formatoPrecio(producto.precio_desde)}</strong>
                    <em>precio aproximado</em>
                  </p>
                )}
                <div className="ps-acciones">
                  <Boton
                    onClick={comprar}
                    disabled={!presentacion}
                    flecha={!agregado}
                    icono={botanico && !agregado ? <ShoppingCart size={18} /> : undefined}
                  >
                    {agregado ? (
                      <>
                        Agregado <Check size={17} aria-hidden="true" />
                      </>
                    ) : (
                      cta_texto
                    )}
                  </Boton>
                  <Link className={`ps-enlace ${botanico ? "ps-enlace--boton" : ""}`} href={`/productos/${producto.slug}`}>
                    Ver detalle
                    {botanico && <ArrowRight size={17} aria-hidden="true" />}
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {total > 1 && (
          <div className="ps-controles">
            <div className="ps-pestanas" role="tablist" aria-label="Elegir producto">
              {diapositivas.map((d, i) => (
                <button
                  key={d.producto.id}
                  type="button"
                  role="tab"
                  aria-selected={i === actual}
                  aria-controls={idPanel}
                  className={`ps-pestana ${i === actual ? "activa" : ""}`}
                  onClick={() => ir(i)}
                  style={{ "--duracion": `${intervalo}s` } as CSSProperties}
                >
                  <span className="ps-pestana-foto" aria-hidden="true">
                    {d.producto.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.producto.imagen_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      d.producto.nombre_producto.charAt(0)
                    )}
                  </span>
                  <span className="ps-pestana-texto">
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    {d.producto.nombre_producto}
                  </span>
                  {/* La barra solo corre en la activa y mientras avanza solo. */}
                  {i === actual && avanzando && <span key={`barra-${actual}`} className="ps-pestana-barra" aria-hidden="true" />}
                </button>
              ))}
            </div>

            <div className="ps-flechas">
              {!quieto && (
                <button
                  type="button"
                  className="ps-flecha"
                  onClick={() => setPausadoPorUsuario((v) => !v)}
                  aria-label={pausadoPorUsuario ? "Reanudar el carrusel" : "Pausar el carrusel"}
                  aria-pressed={pausadoPorUsuario}
                >
                  {pausadoPorUsuario ? <Play size={16} /> : <Pause size={16} />}
                </button>
              )}
              <button type="button" className="ps-flecha ps-flecha--paso" onClick={() => ir(actual - 1, -1)} aria-label="Producto anterior">
                <ArrowLeft size={18} />
              </button>
              {botanico ? (
                // Indicadores, no controles: elegir ya se hace con las pestañas.
                <span className="ps-puntos" aria-hidden="true">
                  {diapositivas.map((d, i) => (
                    <i key={d.producto.id} className={i === actual ? "activo" : ""} />
                  ))}
                </span>
              ) : (
                <span className="ps-contador" aria-hidden="true">
                  <strong>{String(actual + 1).padStart(2, "0")}</strong> / {String(total).padStart(2, "0")}
                </span>
              )}
              <button type="button" className="ps-flecha ps-flecha--paso" onClick={() => ir(actual + 1, 1)} aria-label="Producto siguiente">
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Las diapositivas: los del ranking real, en su orden y con su puesto
 * verdadero; solo si no hay ninguno, el catálogo sin puesto. El top es
 * estricto: un producto sin foto no se salta por otro que sí tenga (se ve su
 * inicial), porque entonces el carrusel ya no sería "los más vendidos".
 */
function armarDiapositivas(productos: ConVentas[], omitir: string, cantidad: number): Diapositiva[] {
  const omitidos = omitir
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const vendidos = productos.filter((p) => p.por_ventas);
  const fuente = vendidos.length > 0 ? vendidos : productos;
  return fuente
    .map((producto, i) => ({ producto, puesto: vendidos.length > 0 ? i + 1 : null }))
    .filter(({ producto }) => !omitidos.includes(producto.slug))
    .slice(0, Math.max(1, cantidad));
}
