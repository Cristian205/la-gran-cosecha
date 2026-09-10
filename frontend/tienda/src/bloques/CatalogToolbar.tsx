"use client";

import { ArrowUpDown, Check, X } from "lucide-react";
import { useState } from "react";
import { OPCIONES_ORDEN, type OrdenCatalogo } from "@/lib/datos";
import { BottomSheet } from "@/componentes/BottomSheet";
import { BusquedaGlobal } from "@/componentes/BusquedaGlobal";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { claseDeVariante } from "./Seccion";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";

/**
 * La barra del catálogo: cuántos productos hay, buscarlos y ordenarlos.
 *
 * Filtrar por categoría vive en `categorias-navegacion`, no aquí — son dos
 * bloques porque son dos preguntas distintas de la composición ("qué
 * categorías muestro" es una decisión de maqueta; "qué controles trae la
 * barra" es otra), aunque casi siempre vayan juntos.
 *
 * No hay filtro de precio ni de disponibilidad porque el catálogo del backend
 * todavía no los admite (`apps.catalog.filters.ProductoFilter` solo conoce
 * categoría y estado) — añadir esa UI aquí prometería algo que no filtra nada.
 *
 * Depende de `CatalogoProvider`: sin él no hay qué contar ni qué ordenar, así
 * que no se dibuja nada — es un bloque de catálogo, no uno de contenido suelto.
 */
const VARIANTES = ["completa"] as const;

interface Props {
  variante?: string;
}

export function CatalogToolbar({ variante }: Props) {
  const catalogo = useCatalogoContexto();
  const { buscar } = useEnvoltorio();
  const [hojaAbierta, setHojaAbierta] = useState(false);

  if (!catalogo) return null;

  const clase = claseDeVariante(variante, VARIANTES, "catalogo-toolbar", "completa");
  const opcionActiva = OPCIONES_ORDEN.find((o) => o.valor === catalogo.orden);
  const categoriaActiva = catalogo.categorias.find((c) => c.id === catalogo.categoriaActiva) ?? null;

  return (
    <div className={`catalogo-toolbar ${clase}`}>
      <div className="catalogo-toolbar-fila">
        <BusquedaGlobal busqueda={catalogo.busqueda} onBuscar={buscar} />

        <label className="tienda-orden">
          <ArrowUpDown size={15} />
          <span className="tienda-orden-txt">Ordenar</span>
          <select
            value={catalogo.orden}
            onChange={(e) => catalogo.cambiarOrden(e.target.value as OrdenCatalogo)}
            aria-label="Ordenar productos"
          >
            {OPCIONES_ORDEN.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>

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
      </div>

      <div className="tienda-resumen">
        <p className="resultado-conteo">
          {catalogo.cargando ? (
            "Cargando productos…"
          ) : catalogo.total === null ? (
            ""
          ) : (
            <>
              Mostrando <b>{catalogo.productos.length}</b> de <b>{catalogo.total}</b>{" "}
              {catalogo.total === 1 ? "producto" : "productos"}
              {categoriaActiva ? ` en ${categoriaActiva.nombre_categoria}` : ""}
              {catalogo.busqueda.trim() ? ` para "${catalogo.busqueda.trim()}"` : ""}
            </>
          )}
        </p>
        {catalogo.hayFiltros && (
          <button type="button" className="btn-limpiar" onClick={catalogo.limpiarFiltros}>
            <X size={14} /> Limpiar filtros
          </button>
        )}
      </div>

      {hojaAbierta && (
        <BottomSheet titulo="Ordenar productos" onCerrar={() => setHojaAbierta(false)}>
          <ul className="hoja-opciones">
            {OPCIONES_ORDEN.map((o) => {
              const activa = o.valor === catalogo.orden;
              return (
                <li key={o.valor}>
                  <button
                    type="button"
                    className={`hoja-opcion ${activa ? "activo" : ""}`}
                    aria-pressed={activa}
                    onClick={() => {
                      catalogo.cambiarOrden(o.valor);
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
