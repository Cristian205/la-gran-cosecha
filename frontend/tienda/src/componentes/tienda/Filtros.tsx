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
 * El contenido del filtro, compartido entre el panel lateral y la hoja del
 * móvil. En la hoja (`enHoja`) no lleva cabecera propia: el título lo pone la
 * hoja y «Limpiar» va en su pie, junto a «Ver productos».
 */
export function FilterPanel({ enHoja = false }: { enHoja?: boolean }) {
  const catalogo = useCatalogoContexto();
  const activos = useFiltrosActivos();
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
    <div className={`fpanel ${enHoja ? "fpanel--hoja" : ""}`}>
      {!enHoja && (
        <header className="fpanel-cabecera">
          <h2 className="fpanel-titulo">
            <SlidersHorizontal size={16} aria-hidden="true" /> Filtros
            {activos.length > 0 && <span className="fpanel-titulo-cuenta">{activos.length}</span>}
          </h2>
          {catalogo.hayFiltros && (
            <button type="button" className="fpanel-limpiar" onClick={catalogo.limpiarFiltros}>
              Limpiar
            </button>
          )}
        </header>
      )}

      {/* Qué está aplicado y cómo quitar cada uno. En escritorio desde el primero
          (la barra de arriba ya no repite estos chips); en la hoja, desde dos. */}
      {activos.length > (enHoja ? 1 : 0) && (
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
      </div>
    </div>
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
