"use client";

import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";
import { BottomSheet } from "@/componentes/BottomSheet";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { OPCIONES_ORDEN, type OrdenCatalogo } from "@/lib/datos";

/**
 * Los controles de filtrado del catálogo. Solo filtros que el backend aplica
 * sobre el catálogo COMPLETO (no sobre la tanda cargada):
 *
 *   Categoría     — `?categoria=`
 *   Se vende por  — `?unidad=`: "lo que venga por bulto", "por caja".
 *
 * Deliberadamente NO hay rango de precio: `precio_desde` mezcla unidades —la
 * libra y la caja del mismo producto— y un rango sobre eso no significaría
 * nada. Tampoco "disponibilidad": ningún producto de este catálogo lleva
 * inventario, así que el filtro no quitaría nada. Si eso cambia, este es el
 * sitio para añadirlos.
 */

const UNIDADES_VISIBLES = 6;

/** El contenido del filtro, compartido entre el panel lateral y el drawer. */
export function FilterPanel() {
  const catalogo = useCatalogoContexto();
  const [todasUnidades, setTodasUnidades] = useState(false);
  const id = useId();
  if (!catalogo) return null;

  const { categorias, categoriaActiva, unidades, unidadActiva } = catalogo;
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
    <div className="fpanel">
      <fieldset className="fpanel-grupo">
        <legend>Categoría</legend>
        <Opcion
          nombre={`${id}-cat`}
          activa={categoriaActiva === null}
          onElegir={() => catalogo.cambiarCategoria(null)}
          etiqueta="Todas"
          cuenta={catalogo.totalCatalogo}
        />
        {categorias.map((c) => (
          <Opcion
            key={c.id}
            nombre={`${id}-cat`}
            activa={categoriaActiva === c.id}
            onElegir={() => catalogo.cambiarCategoria(c.id)}
            etiqueta={c.nombre_categoria}
            cuenta={c.num_productos ?? null}
          />
        ))}
      </fieldset>

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

      {catalogo.hayFiltros && (
        <button type="button" className="fpanel-limpiar" onClick={catalogo.limpiarFiltros}>
          <X size={14} aria-hidden="true" /> Limpiar filtros
        </button>
      )}
    </div>
  );
}

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
  return (
    <label className={`fpanel-opcion ${activa ? "is-activa" : ""}`}>
      <input type="radio" name={nombre} checked={activa} onChange={onElegir} />
      <span className="fpanel-marca" aria-hidden="true" />
      <span className="fpanel-texto">{etiqueta}</span>
      {cuenta !== null && cuenta > 0 && <span className="fpanel-cuenta">{cuenta}</span>}
    </label>
  );
}

/** Móvil: [Filtrar] abre una hoja inferior con el mismo panel. */
export function FilterDrawer() {
  const catalogo = useCatalogoContexto();
  const [abierta, setAbierta] = useState(false);
  if (!catalogo) return null;

  const activos = (catalogo.categoriaActiva !== null ? 1 : 0) + (catalogo.unidadActiva !== null ? 1 : 0);

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
        <BottomSheet titulo="Filtrar productos" onCerrar={() => setAbierta(false)}>
          <FilterPanel />
          <div className="fdrawer-pie">
            <button type="button" className="btn btn-verde btn-block" onClick={() => setAbierta(false)}>
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

/** Ordenar: un `<select>` en escritorio, una hoja con opciones en móvil. */
export function SortControl() {
  const catalogo = useCatalogoContexto();
  const [hoja, setHoja] = useState(false);
  if (!catalogo) return null;

  const actual = OPCIONES_ORDEN.find((o) => o.valor === catalogo.orden) ?? OPCIONES_ORDEN[0];

  return (
    <>
      <label className="tbar-orden">
        <span className="tbar-orden-txt">Ordenar por</span>
        <select
          value={catalogo.orden}
          onChange={(e) => catalogo.cambiarOrden(e.target.value as OrdenCatalogo)}
        >
          {OPCIONES_ORDEN.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </label>

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
  if (!catalogo || !catalogo.hayFiltros) return null;

  const categoria = catalogo.categorias.find((c) => c.id === catalogo.categoriaActiva);
  const unidad = catalogo.unidades.find((u) => u.id === catalogo.unidadActiva);
  const q = catalogo.busqueda.trim();

  const chips = [
    q && { clave: "q", texto: `“${q}”`, quitar: () => catalogo.buscar("") },
    categoria && {
      clave: "c",
      texto: categoria.nombre_categoria,
      quitar: () => catalogo.cambiarCategoria(null),
    },
    unidad && { clave: "u", texto: `Por ${unidad.nombre_unidad}`, quitar: () => catalogo.cambiarUnidad(null) },
  ].filter(Boolean) as { clave: string; texto: string; quitar: () => void }[];

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
