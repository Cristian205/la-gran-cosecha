"use client";

import type { SeleccionProducto } from "@/hooks/useSeleccionProducto";
import { pluralUnidad } from "@/lib/cantidadHumana";
import { formatoPrecio } from "@/lib/utiles";
import { SelectPersonalizado } from "./SelectPersonalizado";

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
 * La variedad de un producto ("Tommy", "Isabella Pulpa") como select propio
 * de la tienda. Un solo componente para todas las tarjetas: las opciones son
 * los grupos que arma `useSeleccionProducto` desde la API y elegir llama a su
 * `elegirVariante`, que recoloca unidad, precio, foto y cantidad igual que
 * antes. Aquí no se decide nada de eso.
 */
export function SelectorVariedad({
  seleccion,
  productoNombre,
  className = "",
}: {
  seleccion: SeleccionProducto;
  productoNombre: string;
  className?: string;
}) {
  const { grupos, grupo, elegirVariante } = seleccion;
  if (!grupo) return null;
  return (
    <SelectPersonalizado
      className={className}
      opciones={grupos.map((g) => ({ valor: g.nombre, etiqueta: g.nombre }))}
      valor={grupo.nombre}
      onCambiar={elegirVariante}
      etiqueta={`Variedad de ${productoNombre}`}
      tituloHoja={`Elige la variedad de ${productoNombre}`}
    />
  );
}

/**
 * La unidad de venta de la variedad elegida ("Libra", "Bulto") con el mismo
 * select propio. Las opciones son las presentaciones reales de ese grupo
 * (su `id` de la API) y cada una lleva su precio a la derecha, para comparar
 * "Libra $3.000 · Caja $73.000" sin elegir a ciegas. Elegir llama al
 * `elegirUnidad` de siempre: precio, foto y cantidad se recolocan igual.
 *
 * `pluralSegun`: la cantidad elegida, para leer "[− 5 +] Kilogramos ▾".
 */
export function SelectorUnidad({
  seleccion,
  productoNombre,
  className = "",
  prefijo,
  pluralSegun,
}: {
  seleccion: SeleccionProducto;
  productoNombre: string;
  className?: string;
  prefijo?: string;
  pluralSegun?: number;
}) {
  const { grupo, presentacion, elegirUnidad } = seleccion;
  if (!grupo || !presentacion) return null;
  const nombre = (u: string) => (pluralSegun === undefined ? u : pluralUnidad(u, pluralSegun));
  return (
    <SelectPersonalizado
      className={className}
      prefijo={prefijo}
      opciones={grupo.opciones.map((p) => ({
        valor: String(p.id),
        etiqueta: nombre(p.unidad_venta_nombre),
        detalle: formatoPrecio(p.precio_unitario),
      }))}
      valor={String(presentacion.id)}
      onCambiar={(v) => elegirUnidad(Number(v))}
      etiqueta={`Unidad de venta de ${productoNombre}`}
      tituloHoja={`¿Cómo quieres comprar ${productoNombre}?`}
    />
  );
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
  if (!grupo || !presentacion) return null;

  const variasVariantes = grupos.length > 1;
  const variasUnidades = grupo.opciones.length > 1;

  if (modo === "amplio") {
    // Un eje con una sola opción no se elige: es un dato, y va en línea
    // ("Variedad  Común") para no gastar una fila entera de botones.
    return (
      <div className="selpres selpres--amplio">
        {variasVariantes ? (
          <fieldset className="selpres-eje">
            <legend>Variedad</legend>
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
          </fieldset>
        ) : (
          grupo.nombre && (
            <p className="selpres-eje selpres-eje--fijo">
              <span className="selpres-rotulo">Variedad</span>
              <span className="selpres-fijo">{grupo.nombre}</span>
            </p>
          )
        )}

        {variasUnidades ? (
          <fieldset className="selpres-eje">
            <legend>Elige tu presentación</legend>
            <div className="selpres-opciones" role="radiogroup" aria-label={`Presentación de ${productoNombre}`}>
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
          </fieldset>
        ) : (
          <p className="selpres-eje selpres-eje--fijo">
            <span className="selpres-rotulo">Presentación</span>
            <span className="selpres-fijo">{presentacion.unidad_venta_nombre}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="selpres">
      {variasVariantes ? (
        <SelectorVariedad seleccion={seleccion} productoNombre={productoNombre} className="selp--fila" />
      ) : (
        <span className="selpres-fijo selpres-fijo--variedad">{grupo.nombre}</span>
      )}

      {variasUnidades ? (
        <SelectorUnidad seleccion={seleccion} productoNombre={productoNombre} className="selp--fila" prefijo="Por" />
      ) : (
        <span className="selpres-fijo">Por {presentacion.unidad_venta_nombre}</span>
      )}
    </div>
  );
}
