/**
 * Filtros del listado y selector de vista.
 *
 * Lo que más se usa queda a la vista (buscar, estado, plan); salud, uso y
 * módulos van en "Más filtros", que dice cuántos tiene puestos. Los filtros
 * viven en el listado, no en una vista: cambiar entre Tabla y Tarjetas no los
 * toca.
 */
import { LayoutGrid, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import type { EstadoNegocio, Plan } from "../../api/tipos";
import { ETIQUETA_ESTADO } from "../../datos/derivados";
import { numero } from "../../datos/formato";
import { Desplegable } from "../../ui/Desplegable";
import { filtrosExtraActivos, hayFiltros, FILTROS_VACIOS, type FiltrosEmpresas } from "./modelo";

export type ModoVista = "tabla" | "tarjetas";

const ESTADOS: EstadoNegocio[] = ["ACTIVO", "PRUEBA", "SUSPENDIDO", "ARCHIVADO"];

export function FiltrosEmpresasBarra({
  filtros,
  onCambiar,
  planes,
  visibles,
  total,
  vista,
  onVista,
}: {
  filtros: FiltrosEmpresas;
  onCambiar: (f: FiltrosEmpresas) => void;
  planes: Plan[];
  visibles: number;
  total: number;
  vista: ModoVista;
  onVista: (v: ModoVista) => void;
}) {
  const poner = <K extends keyof FiltrosEmpresas>(clave: K, valor: FiltrosEmpresas[K]) =>
    onCambiar({ ...filtros, [clave]: valor });
  const extra = filtrosExtraActivos(filtros);

  return (
    <div className="emp-filtros">
      <div className="filtros__buscar emp-filtros__buscar">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={filtros.texto}
          onChange={(e) => poner("texto", e.target.value)}
          placeholder="Buscar empresa, identificador o dominio…"
          aria-label="Buscar empresa"
        />
        {filtros.texto && (
          <button
            type="button"
            className="emp-filtros__borrar"
            onClick={() => poner("texto", "")}
            aria-label="Borrar búsqueda"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <select
        className={filtros.estado ? "esta-filtrando" : ""}
        value={filtros.estado}
        onChange={(e) => poner("estado", e.target.value as EstadoNegocio | "")}
        aria-label="Filtrar por estado"
      >
        <option value="">Estado: todos</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {ETIQUETA_ESTADO[e]}
          </option>
        ))}
      </select>

      <select
        className={filtros.plan ? "esta-filtrando" : ""}
        value={filtros.plan}
        onChange={(e) => poner("plan", e.target.value)}
        aria-label="Filtrar por plan"
      >
        <option value="">Plan: todos</option>
        {planes.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.nombre}
          </option>
        ))}
      </select>

      <Desplegable
        etiqueta="Más filtros"
        alineacion="izquierda"
        ancho={280}
        claseDisparador={`emp-filtros__mas ${extra ? "esta-filtrando" : ""}`}
        disparador={
          <>
            <SlidersHorizontal size={14} aria-hidden="true" />
            Más filtros
            {extra > 0 && <span className="emp-filtros__cuenta-extra">· {extra}</span>}
          </>
        }
      >
        {() => (
          <div className="emp-mas-filtros">
            <label>
              <span>Salud</span>
              <select value={filtros.salud} onChange={(e) => poner("salud", e.target.value as FiltrosEmpresas["salud"])}>
                <option value="">Todas</option>
                <option value="ok">Saludable</option>
                <option value="aviso">Advertencia</option>
                <option value="malo">Crítica</option>
              </select>
            </label>
            <label>
              <span>Uso</span>
              <select value={filtros.uso} onChange={(e) => poner("uso", e.target.value as FiltrosEmpresas["uso"])}>
                <option value="">Cualquiera</option>
                <option value="normal">Por debajo del 75%</option>
                <option value="alto">Alto (75% o más)</option>
                <option value="limite">En el límite (100%)</option>
                <option value="sin">Sin medición</option>
              </select>
            </label>
            <label>
              <span>Módulos</span>
              <select value={filtros.modulos} onChange={(e) => poner("modulos", e.target.value as FiltrosEmpresas["modulos"])}>
                <option value="">Todas</option>
                <option value="con">Con módulos</option>
                <option value="sin">Sin módulos</option>
              </select>
            </label>
            {extra > 0 && (
              <button
                type="button"
                className="emp-mas-filtros__limpiar"
                onClick={() => onCambiar({ ...filtros, salud: "", uso: "", modulos: "" })}
              >
                Quitar estos filtros
              </button>
            )}
          </div>
        )}
      </Desplegable>

      {hayFiltros(filtros) && (
        <button type="button" className="emp-filtros__limpiar" onClick={() => onCambiar(FILTROS_VACIOS)}>
          <X size={13} aria-hidden="true" /> Limpiar
        </button>
      )}

      <span className="emp-filtros__cuenta" aria-live="polite">
        {numero(visibles)} de {numero(total)}
      </span>

      <SelectorVista vista={vista} onVista={onVista} />
    </div>
  );
}

/** Tabla o tarjetas. La elección se recuerda en el navegador. */
export function SelectorVista({ vista, onVista }: { vista: ModoVista; onVista: (v: ModoVista) => void }) {
  return (
    <div className="emp-vista" role="radiogroup" aria-label="Vista">
      <button
        type="button"
        role="radio"
        aria-checked={vista === "tabla"}
        className={vista === "tabla" ? "esta-activa" : ""}
        onClick={() => onVista("tabla")}
        title="Ver como tabla"
        aria-label="Tabla"
      >
        <Rows3 size={14} aria-hidden="true" />
        <span>Tabla</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={vista === "tarjetas"}
        className={vista === "tarjetas" ? "esta-activa" : ""}
        onClick={() => onVista("tarjetas")}
        title="Ver como tarjetas"
        aria-label="Tarjetas"
      >
        <LayoutGrid size={14} aria-hidden="true" />
        <span>Tarjetas</span>
      </button>
    </div>
  );
}
