"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import type { SeleccionProducto } from "@/hooks/useSeleccionProducto";
import { formatoPrecio } from "@/lib/utiles";

interface Props {
  seleccion: SeleccionProducto;
  productoNombre: string;
  /**
   * `compacto`: dos desplegables en una línea, para la tarjeta del catálogo.
   * `amplio`: las opciones a la vista, cada unidad con su precio, para la
   * vista rápida y la ficha — ahí sobra espacio y comparar "Libra $3.000 /
   * Caja $73.000" de un vistazo es justo la decisión que se está tomando.
   */
  modo?: "compacto" | "amplio";
}

/**
 * Qué se está comprando: la variante ("Tommy", "Común") y la unidad de venta
 * ("por Libra", "por Caja").
 *
 * Cada eje tiene su nombre visible —"Variedad", "Por"— en vez del "×" que
 * antes unía dos `<select>` sin etiqueta. Si un eje tiene una sola opción no
 * es un control, es un dato: se muestra como texto.
 */
export function SelectorPresentacion({ seleccion, productoNombre, modo = "compacto" }: Props) {
  const { grupos, grupo, presentacion, elegirVariante, elegirUnidad } = seleccion;
  const id = useId();
  if (!grupo || !presentacion) return null;

  const variasVariantes = grupos.length > 1;
  const variasUnidades = grupo.opciones.length > 1;

  if (modo === "amplio") {
    return (
      <div className="selpres selpres--amplio">
        {(variasVariantes || grupo.nombre) && (
          <fieldset className="selpres-eje">
            <legend>Variedad</legend>
            {variasVariantes ? (
              <div className="selpres-opciones" role="radiogroup" aria-label={`Variedad de ${productoNombre}`}>
                {grupos.map((g) => (
                  <button
                    key={g.nombre}
                    type="button"
                    role="radio"
                    aria-checked={g.nombre === grupo.nombre}
                    className="selpres-opcion"
                    onClick={() => elegirVariante(g.nombre)}
                  >
                    {g.nombre}
                  </button>
                ))}
              </div>
            ) : (
              <span className="selpres-fijo">{grupo.nombre}</span>
            )}
          </fieldset>
        )}

        <fieldset className="selpres-eje">
          <legend>Se vende por</legend>
          {variasUnidades ? (
            <div className="selpres-opciones" role="radiogroup" aria-label={`Unidad de ${productoNombre}`}>
              {grupo.opciones.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === presentacion.id}
                  className="selpres-opcion selpres-opcion--precio"
                  onClick={() => elegirUnidad(p.id)}
                >
                  <span>{p.unidad_venta_nombre}</span>
                  <small>{formatoPrecio(p.precio_unitario)}</small>
                </button>
              ))}
            </div>
          ) : (
            <span className="selpres-fijo">{presentacion.unidad_venta_nombre}</span>
          )}
        </fieldset>
      </div>
    );
  }

  return (
    <div className="selpres">
      {variasVariantes ? (
        <label className="selpres-campo" htmlFor={`${id}-v`}>
          <span className="sr-only">Variedad de {productoNombre}</span>
          <select id={`${id}-v`} value={grupo.nombre} onChange={(e) => elegirVariante(e.target.value)}>
            {grupos.map((g) => (
              <option key={g.nombre} value={g.nombre}>
                {g.nombre}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      ) : (
        <span className="selpres-fijo">{grupo.nombre}</span>
      )}

      {variasUnidades ? (
        <label className="selpres-campo" htmlFor={`${id}-u`}>
          <span className="selpres-prefijo" aria-hidden="true">
            Por
          </span>
          <span className="sr-only">Unidad de venta de {productoNombre}</span>
          <select
            id={`${id}-u`}
            value={presentacion.id}
            onChange={(e) => elegirUnidad(Number(e.target.value))}
          >
            {grupo.opciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.unidad_venta_nombre}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      ) : (
        <span className="selpres-fijo">Por {presentacion.unidad_venta_nombre}</span>
      )}
    </div>
  );
}
