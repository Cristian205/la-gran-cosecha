"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeleccionProducto } from "@/hooks/useSeleccionProducto";
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
  /** La presentación que representa; null = la foto general del producto. */
  presentacionId: number | null;
}

export function GaleriaProducto({ producto, seleccion }: { producto: Producto; seleccion: SeleccionProducto }) {
  const { presentacion, imagenUrl, elegirPresentacion } = seleccion;
  // Ver la foto general a propósito, aunque la presentación elegida tenga la suya.
  const [verGeneral, setVerGeneral] = useState(false);

  useEffect(() => setVerGeneral(false), [presentacion?.id]);

  const elementos = useMemo<Elemento[]>(() => {
    const lista: Elemento[] = [];
    const vistas = new Set<string>();
    if (producto.imagen_url) {
      lista.push({ clave: "general", url: producto.imagen_url, etiqueta: "Vista general", presentacionId: null });
      vistas.add(producto.imagen_url);
    }
    for (const p of producto.presentaciones) {
      if (!p.estado_presentacion || !p.imagen_url || vistas.has(p.imagen_url)) continue;
      vistas.add(p.imagen_url);
      lista.push({
        clave: `p-${p.id}`,
        url: p.imagen_url,
        etiqueta: `${p.nombre_presentacion} · ${p.unidad_venta_nombre}`,
        presentacionId: p.id,
      });
    }
    return lista;
  }, [producto]);

  const principal = verGeneral && producto.imagen_url ? producto.imagen_url : imagenUrl;
  const activa = elementos.find((e) => e.url === principal) ?? null;
  const conFotoPropia = Boolean(presentacion?.imagen_url) && !verGeneral;

  return (
    <div className={`galeria ${elementos.length > 1 ? "galeria--con-miniaturas" : ""}`}>
      <div className="galeria-principal" key={principal ?? "sin-foto"}>
        <ImagenProducto producto={{ ...producto, imagen_url: principal ?? null }} tamanoIcono={200} prioridad />
        {conFotoPropia && presentacion && (
          <span className="galeria-rotulo">
            {presentacion.nombre_presentacion} · {presentacion.unidad_venta_nombre}
          </span>
        )}
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
                  aria-label={e.presentacionId === null ? "Ver la foto general" : `Elegir ${e.etiqueta}`}
                  title={e.etiqueta}
                  onClick={() => {
                    if (e.presentacionId === null) setVerGeneral(true);
                    else {
                      setVerGeneral(false);
                      elegirPresentacion(e.presentacionId);
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.url} alt="" width={96} height={96} loading="lazy" decoding="async" />
                  <span className="galeria-mini-texto">{e.presentacionId === null ? "General" : e.etiqueta}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
