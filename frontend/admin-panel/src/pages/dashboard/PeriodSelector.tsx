import { CalendarRange, ChevronDown, GitCompareArrows } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFiltros } from "./filtros";
import { diasDe, fechaLocal, MAX_DIAS, OPCIONES_PRESET, rangoDesdePreset, rangoLegible, type Preset } from "./periodo";

/**
 * El filtro global: período (siete opciones), rango personalizado y el
 * interruptor de comparación. Es el ÚNICO selector de fechas del dashboard.
 *
 * En escritorio los atajos van en una barra segmentada; en pantallas estrechas,
 * en un desplegable nativo (siete botones no caben en un teléfono).
 */
export function PeriodSelector() {
  const { preset, rango, comparar, cambiarPeriodo, setComparar } = useFiltros();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(rango);
  const caja = useRef<HTMLDivElement>(null);
  const hoy = fechaLocal(new Date());

  useEffect(() => {
    if (!abierto) return;
    setBorrador(rango);
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
    // Solo al abrir: el borrador parte del rango vigente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const dias = borrador.desde && borrador.hasta ? diasDe(borrador) : 0;
  const invalido = !borrador.desde || !borrador.hasta || dias < 1 || dias > MAX_DIAS;

  function elegir(valor: Preset) {
    if (valor === "personalizado") {
      setAbierto((v) => !v);
      return;
    }
    setAbierto(false);
    cambiarPeriodo(valor, rangoDesdePreset(valor));
  }

  return (
    <div className="db-filtros" ref={caja}>
      <div className="db-segmentado db-periodo-barra" role="group" aria-label="Período">
        {OPCIONES_PRESET.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={preset === o.valor}
            className={preset === o.valor ? "activo" : ""}
            onClick={() => elegir(o.valor)}
            aria-expanded={o.valor === "personalizado" ? abierto : undefined}
            title={o.etiqueta}
          >
            {o.valor === "personalizado" && <CalendarRange size={14} aria-hidden="true" />}
            {o.corta}
          </button>
        ))}
      </div>

      <label className="db-periodo-movil">
        <span className="db-sr">Período</span>
        <select value={preset} onChange={(e) => elegir(e.target.value as Preset)}>
          {OPCIONES_PRESET.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>

      <span className="db-periodo-rango" aria-live="polite">
        {rangoLegible(rango)}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={comparar}
        className={`db-comparar ${comparar ? "activo" : ""}`}
        onClick={() => setComparar(!comparar)}
        title="Comparar con el período anterior de igual duración"
      >
        <GitCompareArrows size={14} aria-hidden="true" />
        <span>Comparar</span>
        <span className="db-interruptor" aria-hidden="true" />
      </button>

      {abierto && (
        <form
          className="db-periodo-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalido) return;
            cambiarPeriodo("personalizado", borrador);
            setAbierto(false);
          }}
        >
          <p className="db-periodo-panel-titulo">Rango personalizado</p>
          <label>
            Desde
            <input
              type="date"
              value={borrador.desde}
              max={borrador.hasta || hoy}
              onChange={(e) => setBorrador((b) => ({ ...b, desde: e.target.value }))}
              autoFocus
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={borrador.hasta}
              min={borrador.desde}
              max={hoy}
              onChange={(e) => setBorrador((b) => ({ ...b, hasta: e.target.value }))}
            />
          </label>
          {dias > MAX_DIAS ? (
            <p className="db-periodo-error">El rango no puede superar un año.</p>
          ) : (
            dias > 0 && <p className="db-periodo-ayuda">{dias} {dias === 1 ? "día" : "días"}</p>
          )}
          <div className="db-periodo-acciones">
            <button type="button" className="db-boton-sec" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn primario sm" disabled={invalido}>
              Aplicar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
