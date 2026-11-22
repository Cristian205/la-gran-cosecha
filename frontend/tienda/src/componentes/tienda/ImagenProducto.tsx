"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Producto } from "@/lib/tipos";
import { colorCategoriaTematicoTinte, iconoCategoria } from "@/lib/utiles";
import { esOptimizable, srcSetImagen } from "@/lib/imagen";

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
  // Si el optimizador no puede con una foto, se vuelve a la original una vez.
  const [original, setOriginal] = useState(false);
  // Foto de estudio: el producto recortado sobre fondo blanco o transparente.
  const [recorte, setRecorte] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  function alCargar(img: HTMLImageElement) {
    setCargada(true);
    setRecorte(esRecorteSobreClaro(img));
  }

  // Si la imagen terminó de bajar ANTES de hidratar, `onLoad` ya no se
  // dispara y el esqueleto se quedaría encima para siempre.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) alCargar(imgRef.current);
  }, []);

  const Icono = iconoCategoria(producto.categoria_nombre);
  const conFoto = Boolean(producto.imagen_url) && !fallo;
  const estilo = {
    "--cat-tinte": colorCategoriaTematicoTinte(producto.categoria_nombre, producto.categoria),
  } as CSSProperties;

  return (
    <div
      className={`pimg ${conFoto ? (cargada ? "is-cargada" : "is-cargando") : "pimg--sin-foto"} ${
        conFoto && recorte ? "pimg--recorte" : ""
      } ${className}`}
      style={estilo}
    >
      {conFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={producto.imagen_url!}
          srcSet={original ? undefined : srcSetImagen(producto.imagen_url, [384, 640, 828])}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px"
          alt={producto.nombre_producto}
          width={600}
          height={600}
          loading={prioridad ? "eager" : "lazy"}
          fetchPriority={prioridad ? "high" : "auto"}
          decoding="async"
          onLoad={(e) => alCargar(e.currentTarget)}
          onError={() => (!original && esOptimizable(producto.imagen_url) ? setOriginal(true) : setFallo(true))}
        />
      ) : (
        <Icono size={tamanoIcono} aria-hidden="true" className="pimg-icono" />
      )}
    </div>
  );
}

const LADO = 12;
/**
 * ¿Es una foto de estudio —el producto recortado sobre blanco o sobre
 * transparencia—? Se mira la foto reducida a 12×12: si las cuatro esquinas
 * son casi blancas o transparentes, el producto está "suelto" en el centro y
 * se puede mostrar ENTERO (`contain`) sin que se note el marco. Una foto a
 * sangre (la caja de mangos) tiene esquinas de color y sigue en `cover`.
 *
 * Solo marca la clase `pimg--recorte`; qué hacer con ella lo decide el CSS
 * de cada sitio (hoy, la tarjeta en escritorio). Si la foto viene de otro
 * origen sin CORS el lienzo no se puede leer: se queda como estaba.
 */
function esRecorteSobreClaro(img: HTMLImageElement): boolean {
  try {
    const lienzo = document.createElement("canvas");
    lienzo.width = LADO;
    lienzo.height = LADO;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, LADO, LADO);
    const { data } = ctx.getImageData(0, 0, LADO, LADO);
    const claro = (x: number, y: number) => {
      const i = (y * LADO + x) * 4;
      return data[i + 3] < 24 || (data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232);
    };
    const fin = LADO - 1;
    return claro(0, 0) && claro(fin, 0) && claro(0, fin) && claro(fin, fin);
  } catch {
    return false;
  }
}
