"use client";

import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";
import { BottomSheet } from "@/componentes/BottomSheet";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { OPCIONES_ORDEN, type OrdenCatalogo } from "@/lib/datos";
import { SelectPersonalizado } from "./SelectPersonalizado";

/**
 * Los controles de filtrado del catálogo. Solo filtros que el backend aplica
 * sobre el catálogo COMPLETO (no sobre la tanda cargada):
 *
 *   Se vende por  — `?unidad=`: "lo que venga por bulto", "por caja".
 *
 * La categoría (`?categoria=`) no es un filtro de aquí: se elige en las
 * tarjetas de categorías de arriba del catálogo.
 *
 * Deliberadamente NO hay rango de precio: `precio_desde` mezcla unidades —la
 * libra y la caja del mismo producto— y un rango sobre eso no significaría
 * nada. Tampoco "disponibilidad": ningún producto de este catálogo lleva
 * inventario, así que el filtro no quitaría nada. Si eso cambia, este es el
 * sitio para añadirlos.
 */

const UNIDADES_VISIBLES = 6;

interface FiltroActivo {
  clave: string;
  texto: string;
  quitar: () => void;
}

/**
 * Los filtros aplicados ahora mismo, cada uno con cómo quitarlo. Lo usan la
 * barra del catálogo (chips) y el resumen del panel: un solo sitio que dice
 * qué cuenta como "filtro activo" y cómo se quita.
 */
function useFiltrosActivos(): FiltroActivo[] {
  const catalogo = useCatalogoContexto();
  if (!catalogo) return [];
  const categoria = catalogo.categorias.find((c) => c.id === catalogo.categoriaActiva);
  const unidad = catalogo.unidades.find((u) => u.id === catalogo.unidadActiva);
  const q = catalogo.busqueda.trim();
  return [
    q && { clave: "q", texto: `“${q}”`, quitar: () => catalogo.buscar("") },
    categoria && { clave: "c", texto: categoria.nombre_categoria, quitar: () => catalogo.cambiarCategoria(null) },
    unidad && { clave: "u", texto: `Por ${unidad.nombre_unidad}`, quitar: () => catalogo.cambiarUnidad(null) },
  ].filter(Boolean) as FiltroActivo[];
}

/**
 * El contenido de la hoja «Filtrar» (móvil y tablet): «Se vende por».
 *
 * Las categorías NO van aquí: las tarjetas de categorías de arriba son la
 * navegación por categoría, y repetirlas en un filtro era tener dos
 * controles para lo mismo. Aquí quedan los criterios adicionales; si el
 * backend gana otro filtro, este es su sitio.
 */
export function FilterPanel({ enHoja = false }: { enHoja?: boolean }) {
  const catalogo = useCatalogoContexto();
  const activos = useFiltrosActivos();
  const [todasUnidades, setTodasUnidades] = useState(false);
  const id = useId();
  if (!catalogo) return null;

  const { unidades, unidadActiva } = catalogo;
  const unidadesVisibles = todasUnidades ? unidades : unidades.slice(0, UNIDADES_VISIBLES);
  // Si la unidad elegida quedó escondida bajo "Ver más", se muestra igual.
  const elegidaOculta =
    !todasUnidades &&
    unidadActiva !== null &&
    !unidadesVisibles.some((u) => u.id === unidadActiva);
  const listaUnidades = elegidaOculta
    ? [...unidadesVisibles, ...unidades.filter((u) => u.id === unidadActiva)]
    : unidadesVisibles;

  return (
    <div className={`fpanel ${enHoja ? "fpanel--hoja" : ""}`}>
      {/* Qué está aplicado (también la categoría, elegida arriba) y cómo
          quitar cada uno, desde dos. */}
      {activos.length > 1 && (
        <ul className="fpanel-resumen" aria-label="Filtros aplicados">
          {activos.map((f) => (
            <li key={f.clave}>
              <button type="button" className="fpanel-chip" onClick={f.quitar} aria-label={`Quitar filtro ${f.texto}`}>
                <span>{f.texto}</span> <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fpanel-cuerpo">
        {unidades.length > 0 && (
          <fieldset className="fpanel-grupo">
            <legend>Se vende por</legend>
            <Opcion
              nombre={`${id}-uni`}
              activa={unidadActiva === null}
              onElegir={() => catalogo.cambiarUnidad(null)}
              etiqueta="Cualquier unidad"
              cuenta={null}
            />
            {listaUnidades.map((u) => (
              <Opcion
                key={u.id}
                nombre={`${id}-uni`}
                activa={unidadActiva === u.id}
                onElegir={() => catalogo.cambiarUnidad(u.id)}
                etiqueta={u.nombre_unidad}
                cuenta={u.num_productos ?? null}
              />
            ))}
            {unidades.length > UNIDADES_VISIBLES && (
              <button
                type="button"
                className="fpanel-mas"
                onClick={() => setTodasUnidades((v) => !v)}
                aria-expanded={todasUnidades}
              >
                {todasUnidades ? "Ver menos" : `Ver ${unidades.length - UNIDADES_VISIBLES} más`}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}

/**
 * Escritorio: «Se vende por» como un desplegable en la barra del catálogo,
 * junto a «Ordenar por» — sin panel lateral. El mismo select propio de las
 * tarjetas (`SelectPersonalizado`).
 */
export function UnidadControl() {
  const catalogo = useCatalogoContexto();
  if (!catalogo || catalogo.unidades.length === 0) return null;
  return (
    <SelectPersonalizado
      className="tbar-select tbar-select--unidad"
      prefijo="Se vende por"
      opciones={[
        { valor: "", etiqueta: "Cualquier unidad" },
        ...catalogo.unidades.map((u) => ({
          valor: String(u.id),
          etiqueta: u.nombre_unidad,
          detalle: u.num_productos ? String(u.num_productos) : undefined,
        })),
      ]}
      valor={catalogo.unidadActiva === null ? "" : String(catalogo.unidadActiva)}
      onCambiar={(v) => catalogo.cambiarUnidad(v ? Number(v) : null)}
      etiqueta="Filtrar por unidad de venta"
    />
  );
}

/**
 * Una fila del filtro. Sigue siendo un radio nativo (teclado con flechas,
 * lector de pantalla, un solo valor por grupo), solo que invisible: lo que se
 * ve es la fila entera, con una barra de acento y un ✓ cuando está elegida.
 * Una opción sin productos (cuenta 0) se muestra pero no se puede elegir,
 * salvo que ya esté elegida: así siempre se puede volver a ver y quitar.
 */
function Opcion({
  nombre,
  activa,
  onElegir,
  etiqueta,
  cuenta,
}: {
  nombre: string;
  activa: boolean;
  onElegir: () => void;
  etiqueta: string;
  cuenta: number | null;
}) {
  const vacia = cuenta === 0 && !activa;
  return (
    <label className={`fpanel-opcion ${activa ? "is-activa" : ""} ${vacia ? "is-vacia" : ""}`}>
      <input type="radio" name={nombre} checked={activa} onChange={onElegir} disabled={vacia} />
      <span className="fpanel-texto">{etiqueta}</span>
      {cuenta !== null && <span className="fpanel-cuenta">{cuenta}</span>}
      <span className="fpanel-marca" aria-hidden="true">
        <Check size={13} strokeWidth={3} />
      </span>
    </label>
  );
}

/** Móvil y tablet: [Filtrar] abre una hoja inferior con «Se vende por». */
export function FilterDrawer() {
  const catalogo = useCatalogoContexto();
  const [abierta, setAbierta] = useState(false);
  if (!catalogo || catalogo.unidades.length === 0) return null;

  // Solo lo que filtra esta hoja: la categoría se elige (y se ve) arriba.
  const activos = catalogo.unidadActiva !== null ? 1 : 0;

  return (
    <>
      <button
        type="button"
        className="tbar-btn tbar-btn--filtrar"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filtrar
        {activos > 0 && (
          <span className="tbar-btn-cuenta">
            {activos} <span className="sr-only">activos</span>
          </span>
        )}
      </button>

      {abierta && (
        <BottomSheet
          titulo={activos > 0 ? `Filtros · ${activos} ${activos === 1 ? "activo" : "activos"}` : "Filtros"}
          onCerrar={() => setAbierta(false)}
        >
          <FilterPanel enHoja />
          <div className="fdrawer-pie">
            <button
              type="button"
              className="btn btn-outline"
              onClick={catalogo.limpiarFiltros}
              disabled={!catalogo.hayFiltros}
            >
              Limpiar
            </button>
            <button type="button" className="btn btn-verde" onClick={() => setAbierta(false)}>
              {catalogo.cargando
                ? "Cargando…"
                : catalogo.total === null
                  ? "Ver productos"
                  : `Ver ${catalogo.total} ${catalogo.total === 1 ? "producto" : "productos"}`}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

/** Ordenar: un desplegable en escritorio, una hoja con opciones en móvil. */
export function SortControl() {
  const catalogo = useCatalogoContexto();
  const [hoja, setHoja] = useState(false);
  if (!catalogo) return null;

  const actual = OPCIONES_ORDEN.find((o) => o.valor === catalogo.orden) ?? OPCIONES_ORDEN[0];

  return (
    <>
      <SelectPersonalizado
        className="tbar-select tbar-orden"
        prefijo="Ordenar por"
        opciones={OPCIONES_ORDEN.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
        valor={catalogo.orden}
        onCambiar={(v) => catalogo.cambiarOrden(v as OrdenCatalogo)}
        etiqueta="Ordenar productos"
      />

      <button
        type="button"
        className="tbar-btn tbar-btn--ordenar"
        onClick={() => setHoja(true)}
        aria-haspopup="dialog"
        aria-label={`Ordenar productos. Actual: ${actual.etiqueta}`}
      >
        <ArrowUpDown size={16} aria-hidden="true" />
        <span>{actual.valor === "recomendados" ? "Ordenar" : actual.corta}</span>
      </button>

      {hoja && (
        <BottomSheet titulo="Ordenar productos" onCerrar={() => setHoja(false)}>
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
                      setHoja(false);
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
    </>
  );
}

/** Los filtros aplicados, cada uno con su ✕: se ven y se quitan de a uno. */
export function ActiveFilters() {
  const catalogo = useCatalogoContexto();
  const chips = useFiltrosActivos();
  if (!catalogo || !catalogo.hayFiltros) return null;

  return (
    <ul className="tbar-chips" aria-label="Filtros aplicados">
      {chips.map((c) => (
        <li key={c.clave}>
          <button type="button" className="tbar-chip" onClick={c.quitar} aria-label={`Quitar filtro ${c.texto}`}>
            {c.texto} <X size={13} aria-hidden="true" />
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button type="button" className="tbar-limpiar" onClick={catalogo.limpiarFiltros}>
            Limpiar todo
          </button>
        </li>
      )}
    </ul>
  );
}
