"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Producto } from "@/lib/tipos";
import { colorCategoriaTematicoTinte, iconoCategoria } from "@/lib/utiles";

interface Props {
  producto: Pick<Producto, "nombre_producto" | "imagen_url" | "categoria" | "categoria_nombre">;
  /** Tamaño del ícono de respaldo, en px. La foto siempre llena el marco. */
  tamanoIcono?: number;
  /** Solo para lo que está sobre el pliegue (la vista rápida, la ficha): la
   *  imagen se pide ya y no cuando el navegador decida. */
  prioridad?: boolean;
  className?: string;
}

/**
 * El marco de la imagen de un producto: proporción fija, esqueleto mientras
 * carga y un respaldo digno cuando no hay foto.
 *
 * El respaldo no es un caso raro: hoy la mayoría del catálogo no tiene
 * fotografía. Por eso no es un ícono gris sobre gris sino el render 3D de la
 * categoría sobre un velo de su propio color — la rejilla sigue leyéndose
 * como "frutas", "tubérculos", "granos" aunque falten fotos, y en cuanto el
 * negocio sube una, este mismo marco la muestra sin tocar nada más. No se
 * inventa ninguna foto.
 *
 * `<img>` y no `next/image`, con el mismo criterio que el resto de la tienda:
 * la foto la sube cada negocio a su bucket y el dominio no se conoce al
 * compilar. `loading="lazy"` + `decoding="async"` y ancho/alto declarados
 * para que el navegador reserve el hueco y no salte el diseño.
 */
export function ImagenProducto({ producto, tamanoIcono = 72, prioridad = false, className = "" }: Props) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Si la imagen terminó de bajar ANTES de hidratar, `onLoad` ya no se
  // dispara y el esqueleto se quedaría encima para siempre.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setCargada(true);
  }, []);

  const Icono = iconoCategoria(producto.categoria_nombre);
  const conFoto = Boolean(producto.imagen_url) && !fallo;
  const estilo = {
    "--cat-tinte": colorCategoriaTematicoTinte(producto.categoria_nombre, producto.categoria),
  } as CSSProperties;

  return (
    <div
      className={`pimg ${conFoto ? (cargada ? "is-cargada" : "is-cargando") : "pimg--sin-foto"} ${className}`}
      style={estilo}
    >
      {conFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={producto.imagen_url!}
          alt={producto.nombre_producto}
          width={600}
          height={600}
          loading={prioridad ? "eager" : "lazy"}
          fetchPriority={prioridad ? "high" : "auto"}
          decoding="async"
          onLoad={() => setCargada(true)}
          onError={() => setFallo(true)}
        />
      ) : (
        <Icono size={tamanoIcono} aria-hidden="true" className="pimg-icono" />
      )}
    </div>
  );
}
