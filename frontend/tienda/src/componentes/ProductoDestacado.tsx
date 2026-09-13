"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import { obtenerProductosMasVendidos } from "@/lib/datos";
import type { Producto } from "@/lib/tipos";
import { formatoPrecio, iconoCategoria } from "@/lib/utiles";
import { agruparPresentaciones } from "@/componentes/PresentationSelector";
import { Reveal } from "@/componentes/animacion";

/**
 * El espacio de merchandising del catálogo: UN producto, tratado como
 * publicidad — no como otra fila de tarjetas.
 *
 * Nace de un problema concreto: "productos-destacados" (`MasVendidos`) pinta
 * los más vendidos con la MISMA `ProductCard` que el catálogo de abajo, así
 * que un producto podía aparecer dos veces con el mismo tratamiento visual —
 * "¿ya vi este producto antes?". Este bloque usa el MISMO dato (el top de
 * `/orders/productos-mas-vendidos/`, primer puesto) pero con un dibujo propio,
 * grande y editorial: si vuelve a aparecer en la rejilla de abajo, se siente
 * como el catálogo completo, no como una repetición.
 *
 * No es una variante de `ProductCard`: comparte el precio y el "agregar al
 * pedido" (mismo `useAgregarAlCarrito`, misma presentación más barata por
 * defecto), pero ni el layout ni el propósito son los de una tarjeta de
 * catálogo.
 */
interface Props {
  /** Lo que el lienzo resolvió en el servidor, si este bloque se declaró en
   *  `RESUELVE_EN_SERVIDOR`. Sin esto, se pide al hidratar como `MasVendidos`. */
  datos?: Producto[];
  kicker?: string;
  texto?: string;
  cta_texto?: string;
}

export function ProductoDestacado({
  datos = [],
  kicker = "Favorito de nuestros clientes",
  texto = "Uno de los productos con mayor demanda entre negocios como el tuyo.",
  cta_texto = "Agregar al pedido",
}: Props) {
  const [productos, setProductos] = useState<Producto[]>(datos);

  useEffect(() => {
    if (datos.length > 0) return;
    obtenerProductosMasVendidos()
      .then(setProductos)
      .catch(() => setProductos([]));
  }, [datos.length]);

  const producto = productos[0];
  const { agregar, agregado } = useAgregarAlCarrito();

  if (!producto) return null;

  const grupos = agruparPresentaciones(producto.presentaciones);
  const presentacion = grupos[0]?.opciones[0] ?? null;
  const IconoRespaldo = iconoCategoria(producto.categoria_nombre);

  function handleAgregar() {
    if (!presentacion) return;
    agregar({
      productoId: producto.id,
      productoNombre: producto.nombre_producto,
      imagenUrl: producto.imagen_url,
      presentacionId: presentacion.id,
      presentacionNombre: `${presentacion.nombre_presentacion} · ${presentacion.unidad_venta_nombre}`,
      precioUnitario: parseFloat(presentacion.precio_unitario),
      cantidad: 1,
      permiteFraccion: producto.permite_fraccion,
      tipoCantidad: producto.tipo_cantidad,
    });
  }

  return (
    <Reveal as="section" className="producto-destacado">
      <span className="pd-blob b1" aria-hidden="true" />
      <span className="pd-blob b2" aria-hidden="true" />

      <div className="pd-contenido">
        <span className="pd-kicker">
          <Flame size={14} aria-hidden="true" />
          {kicker}
        </span>
        <h2>{producto.nombre_producto}</h2>
        <p className="pd-texto">{texto}</p>

        {producto.precio_desde && (
          <p className="pd-precio">
            Desde <b>{formatoPrecio(producto.precio_desde)}</b>
          </p>
        )}

        <div className="pd-acciones">
          <button
            type="button"
            className="btn btn-ambar"
            onClick={handleAgregar}
            disabled={!presentacion}
          >
            {agregado ? (
              <>
                Agregado <Check size={16} />
              </>
            ) : (
              <>
                {cta_texto} <ArrowRight size={16} />
              </>
            )}
          </button>
          <Link href={`/productos/${producto.slug}`} className="pd-enlace">
            Ver detalle
          </Link>
        </div>
      </div>

      <div className="pd-media">
        {producto.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen_url} alt={producto.nombre_producto} decoding="async" />
        ) : (
          <IconoRespaldo size={64} strokeWidth={1.3} />
        )}
      </div>
    </Reveal>
  );
}
