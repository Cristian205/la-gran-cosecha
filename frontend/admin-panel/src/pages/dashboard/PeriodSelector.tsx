import { CalendarRange } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fechaLocal, OPCIONES_PRESET, rangoDesdePreset, rangoLegible, type Preset, type Rango } from "./periodo";

/**
 * Hoy · 7 días · 30 días · Este mes · Personalizado.
 *
 * Las fechas del rango personalizado viven en un panel que se abre solo al
 * pedirlo: dos campos de fecha fijos ocupaban media barra para algo que se
 * usa de vez en cuando. El rango activo siempre se lee al lado.
 */
const MAX_DIAS = 366;

export function PeriodSelector({
  preset,
  rango,
  onCambiar,
}: {
  preset: Preset;
  rango: Rango;
  onCambiar: (preset: Preset, rango: Rango) => void;
}) {
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

  const dias = (Date.parse(borrador.hasta) - Date.parse(borrador.desde)) / 86_400_000 + 1;
  const invalido = !borrador.desde || !borrador.hasta || dias < 1 || dias > MAX_DIAS;

  return (
    <div className="db-periodo" ref={caja}>
      <div className="db-segmentado" role="group" aria-label="Período">
        {OPCIONES_PRESET.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={preset === o.valor}
            className={preset === o.valor ? "activo" : ""}
            onClick={() => {
              if (o.valor === "personalizado") setAbierto((v) => !v);
              else {
                setAbierto(false);
                onCambiar(o.valor, rangoDesdePreset(o.valor));
              }
            }}
            aria-expanded={o.valor === "personalizado" ? abierto : undefined}
          >
            {o.valor === "personalizado" && <CalendarRange size={14} aria-hidden="true" />}
            <span className={o.valor === "personalizado" ? "db-solo-ancho" : ""}>{o.etiqueta}</span>
          </button>
        ))}
      </div>
      <span className="db-periodo-rango" aria-live="polite">
        {rangoLegible(rango)}
      </span>

      {abierto && (
        <form
          className="db-periodo-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalido) return;
            onCambiar("personalizado", borrador);
            setAbierto(false);
          }}
        >
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
          {dias > MAX_DIAS && <p className="db-periodo-error">El rango no puede superar un año.</p>}
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
