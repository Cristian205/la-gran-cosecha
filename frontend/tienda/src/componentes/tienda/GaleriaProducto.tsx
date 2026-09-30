"use client";

import { useEffect, useMemo, useState } from "react";
import { imagenDeGrupo, type SeleccionProducto } from "@/hooks/useSeleccionProducto";
import type { Producto } from "@/lib/tipos";
import { ImagenProducto } from "./ImagenProducto";

/**
 * La galería de la ficha: una foto por presentación, conectada al selector.
 *
 * Elegir "Bulto" en el panel de compra cambia la foto grande a la del bulto;
 * tocar la miniatura del bulto lo elige en el panel. Así lo que se ve y lo
 * que se va a pedir nunca se contradicen. La foto principal del producto
 * también es una miniatura —la vista general—, y es la que se muestra cuando
 * la presentación elegida no tiene foto propia.
 *
 * Sin fotos de presentación no hay miniaturas: una galería de un solo
 * elemento es solo ruido.
 */
interface Elemento {
  clave: string;
  url: string;
  etiqueta: string;
  /** La variante (nombre de presentación) que representa; null = la foto general del producto. */
  variante: string | null;
}

/**
 * Las miniaturas van por variante, no por presentación: "Bulto" por kilo y
 * "Bulto" por arroba son el mismo bulto con otra unidad de cobro, así que es
 * una sola foto. La unidad se elige en el panel de compra.
 */
export function GaleriaProducto({ producto, seleccion }: { producto: Producto; seleccion: SeleccionProducto }) {
  const { grupos, grupo, presentacion, imagenUrl, elegirVariante } = seleccion;
  // Ver la foto general a propósito, aunque la presentación elegida tenga la suya.
  const [verGeneral, setVerGeneral] = useState(false);

  useEffect(() => setVerGeneral(false), [presentacion?.id]);

  const elementos = useMemo<Elemento[]>(() => {
    const lista: Elemento[] = [];
    const vistas = new Set<string>();
    if (producto.imagen_url) {
      lista.push({ clave: "general", url: producto.imagen_url, etiqueta: "Vista general", variante: null });
      vistas.add(producto.imagen_url);
    }
    for (const g of grupos) {
      const url = imagenDeGrupo(g.opciones);
      if (!url || vistas.has(url)) continue;
      vistas.add(url);
      lista.push({ clave: `v-${g.nombre}`, url, etiqueta: g.nombre, variante: g.nombre });
    }
    return lista;
  }, [producto.imagen_url, grupos]);

  const principal = verGeneral && producto.imagen_url ? producto.imagen_url : imagenUrl;
  const activa = verGeneral
    ? elementos.find((e) => e.variante === null) ?? null
    : elementos.find((e) => e.variante !== null && e.variante === grupo?.nombre) ??
      elementos.find((e) => e.url === principal) ??
      null;
  return (
    <div className={`galeria ${elementos.length > 1 ? "galeria--con-miniaturas" : ""}`}>
      <div className="galeria-principal" key={principal ?? "sin-foto"}>
        {/* Sin rótulo encima: qué se eligió ya lo dice el panel de compra. */}
        <ImagenProducto producto={{ ...producto, imagen_url: principal ?? null }} tamanoIcono={200} prioridad />
      </div>

      {elementos.length > 1 && (
        <ul className="galeria-miniaturas" aria-label="Fotos del producto">
          {elementos.map((e) => {
            const seleccionada = activa?.clave === e.clave;
            return (
              <li key={e.clave}>
                <button
                  type="button"
                  className={`galeria-mini ${seleccionada ? "activa" : ""}`}
                  aria-pressed={seleccionada}
                  aria-label={e.variante === null ? "Ver la foto general" : `Elegir ${e.etiqueta}`}
                  title={e.etiqueta}
                  onClick={() => {
                    if (e.variante === null) setVerGeneral(true);
                    else {
                      setVerGeneral(false);
                      // Si ya está en esa variante, se respeta la unidad elegida.
                      if (e.variante !== grupo?.nombre) elegirVariante(e.variante);
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.url} alt="" width={64} height={64} loading="lazy" decoding="async" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
