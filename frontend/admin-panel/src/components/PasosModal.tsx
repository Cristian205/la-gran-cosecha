import { Check } from "lucide-react";
import { Fragment, useId, useRef, type KeyboardEvent } from "react";

/**
 * Los pasos de un modal como pestañas, para la `subcabecera` del `Modal`
 * (van pegados al encabezado y no se desplazan con el cuerpo).
 *
 * Lo usan «Exportar informe» y «Nuevo usuario», así que los dos asistentes
 * se ven y se manejan igual: número en un círculo (✓ cuando el paso ya se
 * completó), título, una línea con lo elegido y la línea verde bajo el paso
 * activo. Flechas izquierda/derecha para moverse entre los pasos disponibles.
 *
 * Con `numerados={false}` sirve también como pestañas simples (editar un
 * usuario: se salta libremente entre secciones, no hay un orden que seguir).
 *
 * `variante="progreso"`: stepper horizontal compacto, en una sola fila:
 * círculo + título de cada paso, unidos por conectores que se rellenan en
 * verde al avanzar (Nuevo producto, Nueva presentación). El detalle de cada
 * paso va en el globo (`title`). Misma lógica y teclado.
 */
export interface PasoModal {
  clave: string;
  titulo: string;
  /** Lo elegido en ese paso, en una línea ("PDF", "3 vistas"). */
  detalle?: string;
  /** Aún no se puede llegar (falta completar uno anterior). */
  bloqueado?: boolean;
  /** Ya completado: muestra ✓ en vez del número. */
  hecho?: boolean;
}

export function PasosModal({
  pasos,
  activo,
  onCambiar,
  etiqueta,
  numerados = true,
  variante = "pestanas",
}: {
  pasos: PasoModal[];
  activo: string;
  onCambiar: (clave: string) => void;
  etiqueta: string;
  numerados?: boolean;
  variante?: "pestanas" | "progreso";
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const disponibles = pasos.map((p, i) => ({ p, i })).filter(({ p }) => !p.bloqueado);
    const actual = disponibles.findIndex(({ p }) => p.clave === activo);
    const salto = e.key === "ArrowRight" ? 1 : -1;
    const destino = disponibles[(actual + salto + disponibles.length) % disponibles.length];
    if (!destino) return;
    onCambiar(destino.p.clave);
    refs.current[destino.i]?.focus();
  }

  const progreso = variante === "progreso";
  const indiceActivo = Math.max(0, pasos.findIndex((p) => p.clave === activo));

  return (
    <div
      className={`pasos-modal ${progreso ? "pasos-modal--progreso" : ""}`}
      role="tablist"
      aria-label={etiqueta}
      onKeyDown={alTeclado}
    >
      {pasos.map((p, i) => {
        const esActivo = p.clave === activo;
        const recorrido = progreso && i < indiceActivo;
        return (
          <Fragment key={p.clave}>
            {/* En «progreso», un conector entre cada par de pasos: se rellena
                en verde cuando el paso de su izquierda ya quedó atrás. */}
            {progreso && i > 0 && (
              <span className={`pasos-modal-conector ${i <= indiceActivo ? "lleno" : ""}`} aria-hidden="true">
                <span />
              </span>
            )}
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-${p.clave}`}
              aria-selected={esActivo}
              aria-disabled={p.bloqueado || undefined}
              tabIndex={esActivo ? 0 : -1}
              // En «progreso» el detalle no ocupa una línea: va en el globo.
              title={progreso && p.detalle ? `${p.titulo}: ${p.detalle}` : undefined}
              className={`pasos-modal-tab ${esActivo ? "activo" : ""} ${p.hecho && !esActivo ? "hecho" : ""} ${
                recorrido ? "recorrido" : ""
              }`}
              onClick={() => !p.bloqueado && onCambiar(p.clave)}
            >
              {numerados && (
                <span className="pasos-modal-num" aria-hidden="true">
                  {(p.hecho || recorrido) && !esActivo ? <Check size={12} strokeWidth={2.6} /> : i + 1}
                </span>
              )}
              <span className="pasos-modal-texto">
                <strong>{p.titulo}</strong>
                {p.detalle && !progreso && <small>{p.detalle}</small>}
              </span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
