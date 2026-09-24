"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/componentes/animacion";
import { agruparPresentaciones } from "@/componentes/PresentationSelector";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import { obtenerProductosMasVendidos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { formatoPrecio } from "@/lib/utiles";
import { Boton, TipografiaEditorial, useParallax } from "./comunes";

/**
 * El producto estrella, contado como publicidad y no como tarjeta.
 *
 * Usa el mismo dato que "más vendidos" (`/orders/productos-mas-vendidos/`,
 * primer puesto CON foto: una pieza que vive de la imagen no puede abrir con un
 * icono de respaldo), pero lo dibuja aparte del catálogo: foto enorme con
 * movimiento lento, el nombre gigante detrás y una sola acción. Los siguientes
 * de la lista salen como texto —enlaces a su ficha—, nunca como más tarjetas.
 *
 * "Quiero este producto" agrega la presentación más barata, igual que hace la
 * tarjeta del catálogo, para que el clic del Home ya sea una compra empezada.
 */
interface Props {
  datos?: Producto[];
  /** Slugs separados por coma que NO deben protagonizar la pieza: el producto
   *  que ya abre el Home con su foto no se repite aquí a pantalla completa. */
  omitir?: string;
  kicker?: string;
  texto?: string;
  cta_texto?: string;
}

export function ProductSpotlight({
  datos = [],
  omitir = "",
  kicker = "El favorito de nuestros clientes",
  texto = "Uno de los productos que más piden negocios como el tuyo.",
  cta_texto = "Quiero este producto",
}: Props) {
  const [productos, setProductos] = useState<Producto[]>(datos);
  const ref = useRef<HTMLElement>(null);
  const movimiento = useParallax(ref, { desde: 1.1, hasta: 1.24, desplazamiento: 7 });
  const { agregar, agregado } = useAgregarAlCarrito();

  useEffect(() => {
    if (datos.length > 0) return;
    obtenerProductosMasVendidos()
      .then(setProductos)
      .catch(() => setProductos([]));
  }, [datos.length]);

  const omitidos = omitir
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  const candidatos = productos.filter((p) => !omitidos.includes(p.slug));
  const estrella = candidatos.find((p) => p.imagen_url) ?? candidatos[0] ?? productos[0];
  if (!estrella) return null;

  const otros = productos.filter((p) => p.id !== estrella.id).slice(0, 3);
  const presentacion = agruparPresentaciones(estrella.presentaciones)[0]?.opciones[0] ?? null;

  function comprar() {
    if (!presentacion || !estrella) return;
    agregar({
      productoId: estrella.id,
      productoNombre: estrella.nombre_producto,
      imagenUrl: estrella.imagen_url,
      presentacionId: presentacion.id,
      presentacionNombre: `${presentacion.nombre_presentacion} · ${presentacion.unidad_venta_nombre}`,
      precioUnitario: parseFloat(presentacion.precio_unitario),
      cantidad: 1,
      permiteFraccion: estrella.permite_fraccion,
      tipoCantidad: estrella.tipo_cantidad,
    });
  }

  return (
    <section ref={ref} className="ps">
      <TipografiaEditorial />
      <span className="ps-gigante" aria-hidden="true">
        {estrella.nombre_producto}
      </span>

      <div className="cmp-inner ps-grid">
        {/* El disparador vive en el marco (sin recorte) y el recorte en su hijo:
            un `IntersectionObserver` sobre un elemento con `clip-path` que lo
            oculta entero nunca lo ve entrar, y la foto no llegaría a aparecer. */}
        <motion.div
          className="ps-foto"
          initial="oculto"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ oculto: {}, visible: {} }}
        >
          <motion.div
            className="ps-foto-recorte"
            variants={{ oculto: { clipPath: "inset(100% 0 0 0)" }, visible: { clipPath: "inset(0% 0 0 0)" } }}
            transition={{ duration: 1.05, ease: [0.77, 0, 0.175, 1] }}
          >
            {estrella.imagen_url && (
              <motion.div className="ps-foto-capa" style={movimiento}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={estrella.imagen_url} alt={estrella.nombre_producto} loading="lazy" decoding="async" />
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        <div className="ps-texto">
          <Reveal>
            <p className="cmp-kicker">{kicker}</p>
          </Reveal>
          <Reveal retraso={0.08}>
            <h2>{estrella.nombre_producto}</h2>
          </Reveal>
          <Reveal retraso={0.16}>
            <p className="ps-parrafo">{texto}</p>
          </Reveal>
          {estrella.precio_desde && (
            <Reveal retraso={0.22}>
              <p className="ps-precio">
                <span>Desde</span> <strong>{formatoPrecio(estrella.precio_desde)}</strong>
                <em>precio aproximado</em>
              </p>
            </Reveal>
          )}
          <Reveal retraso={0.28} className="ps-acciones">
            <Boton onClick={comprar} disabled={!presentacion} flecha={!agregado}>
              {agregado ? (
                <>
                  Agregado <Check size={17} aria-hidden="true" />
                </>
              ) : (
                cta_texto
              )}
            </Boton>
            <Link className="ps-enlace" href={`/productos/${estrella.slug}`}>
              Ver detalle
            </Link>
          </Reveal>

          {otros.length > 0 && (
            <Reveal retraso={0.34} className="ps-tambien">
              <span>También piden</span>
              <ul>
                {otros.map((p) => (
                  <li key={p.id}>
                    <Link href={`/productos/${p.slug}`}>{p.nombre_producto}</Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
