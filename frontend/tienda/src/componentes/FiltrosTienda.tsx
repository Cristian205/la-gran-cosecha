"use client";

import { ArrowUpDown, Check } from "lucide-react";
import { useState } from "react";
import { OPCIONES_ORDEN, type OrdenCatalogo } from "@/lib/datos";
import type { Categoria } from "@/lib/tipos";
import { colorCategoria } from "@/lib/utiles";
import { BottomSheet } from "@/componentes/BottomSheet";

interface Props {
  categorias: Categoria[];
  categoriaActiva: number | null;
  onCategoria: (id: number | null) => void;
  orden: OrdenCatalogo;
  onOrden: (orden: OrdenCatalogo) => void;
}

/**
 * Barra sticky de la tienda: categorías + ordenamiento.
 *
 * Las categorías son un carrusel horizontal (no un panel de filtros): con este
 * catálogo, verlas y tocarlas directamente es menos fricción que abrir una
 * hoja para elegir una sola cosa. El ordenamiento sí abre una hoja en móvil,
 * donde un <select> nativo dentro de la barra se comía una línea entera.
 */
export function FiltrosTienda({
  categorias,
  categoriaActiva,
  onCategoria,
  orden,
  onOrden,
}: Props) {
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const opcionActiva = OPCIONES_ORDEN.find((o) => o.valor === orden);

  return (
    <div className="tienda-toolbar">
      <div className="chips" role="group" aria-label="Filtrar por categoría">
        <button
          type="button"
          className={`chip ${categoriaActiva === null ? "activo" : ""}`}
          aria-pressed={categoriaActiva === null}
          onClick={() => onCategoria(null)}
        >
          Todos
        </button>
        {categorias.map((c) => {
          const activa = categoriaActiva === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`chip ${activa ? "activo" : ""}`}
              aria-pressed={activa}
              style={activa ? { background: colorCategoria(c.id) } : undefined}
              onClick={() => onCategoria(activa ? null : c.id)}
            >
              {!activa && (
                <span
                  className="chip-punto"
                  style={{ background: colorCategoria(c.id) }}
                />
              )}
              {c.nombre_categoria}
            </button>
          );
        })}
      </div>

      {/* Escritorio: el <select> nativo es compacto y no necesita hoja. */}
      <label className="tienda-orden">
        <ArrowUpDown size={15} />
        <span className="tienda-orden-txt">Ordenar</span>
        <select
          value={orden}
          onChange={(e) => onOrden(e.target.value as OrdenCatalogo)}
          aria-label="Ordenar productos"
        >
          {OPCIONES_ORDEN.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {/* Móvil: un botón que abre la hoja, en la misma línea que los chips. */}
      <button
        type="button"
        className="tienda-orden-btn"
        onClick={() => setHojaAbierta(true)}
        aria-haspopup="dialog"
        aria-label={`Ordenar productos. Actual: ${opcionActiva?.etiqueta ?? "Recomendados"}`}
      >
        <ArrowUpDown size={15} />
        <span>{opcionActiva?.corta ?? "Ordenar"}</span>
      </button>

      {hojaAbierta && (
        <BottomSheet titulo="Ordenar productos" onCerrar={() => setHojaAbierta(false)}>
          <ul className="hoja-opciones">
            {OPCIONES_ORDEN.map((o) => {
              const activa = o.valor === orden;
              return (
                <li key={o.valor}>
                  <button
                    type="button"
                    className={`hoja-opcion ${activa ? "activo" : ""}`}
                    aria-pressed={activa}
                    onClick={() => {
                      onOrden(o.valor);
                      setHojaAbierta(false);
                    }}
                  >
                    <span>{o.etiqueta}</span>
                    {activa && <Check size={18} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}
