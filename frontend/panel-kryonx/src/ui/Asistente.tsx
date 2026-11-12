/**
 * Registrar y editar por secciones.
 *
 * Dos piezas, para dos casos distintos:
 *
 * - `ModalAsistente`: un registro NUEVO en pasos. Cada paso pregunta una cosa,
 *   no deja avanzar hasta que está completo y el último resume lo que se va a
 *   crear. Sirve cuando hay decisiones encadenadas (quién es, qué plan, con qué
 *   tienda) y un formulario largo sería una pared de campos.
 * - `Pestanas`: editar algo que YA existe. Se entra a la sección que se quiere
 *   tocar sin recorrer las demás.
 *
 * Ambas viven dentro del `Modal` común, que ya es centrado y de fondo
 * degradado.
 */
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Boton } from "./basicos";
import { Modal } from "./Modal";

/* ---------------------------------------------------------------- pestañas */

export interface PestanaModal<T extends string> {
  id: T;
  etiqueta: string;
  /** Un punto junto a la etiqueta: esa sección tiene cambios sin guardar. */
  pendiente?: boolean;
}

export function Pestanas<T extends string>({
  pestanas,
  activa,
  onCambiar,
  etiqueta = "Secciones",
}: {
  pestanas: PestanaModal<T>[];
  activa: T;
  onCambiar: (id: T) => void;
  etiqueta?: string;
}) {
  const base = useId();

  // Flechas izquierda/derecha entre pestañas, como en cualquier tablist.
  function alPulsar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = pestanas.findIndex((p) => p.id === activa);
    const siguiente = pestanas[(i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length];
    onCambiar(siguiente.id);
    document.getElementById(`${base}-${siguiente.id}`)?.focus();
    e.preventDefault();
  }

  return (
    <div className="modal-pestanas" role="tablist" aria-label={etiqueta} onKeyDown={alPulsar}>
      {pestanas.map((p) => (
        <button
          key={p.id}
          id={`${base}-${p.id}`}
          type="button"
          role="tab"
          aria-selected={activa === p.id}
          tabIndex={activa === p.id ? 0 : -1}
          className={activa === p.id ? "esta-activa" : ""}
          onClick={() => onCambiar(p.id)}
        >
          {p.etiqueta}
          {p.pendiente && <i className="modal-pestanas__punto" aria-label="con cambios" />}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- asistente */

export interface Paso {
  id: string;
  titulo: string;
  /** Si el paso está completo; hasta entonces «Siguiente» queda desactivado. */
  valido?: boolean;
  contenido: ReactNode;
}

export function ModalAsistente({
  titulo,
  descripcion,
  ancho = 560,
  pasos,
  etiquetaFinal = "Crear",
  trabajando = false,
  onCerrar,
  onFinalizar,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  ancho?: number;
  pasos: Paso[];
  etiquetaFinal?: string;
  trabajando?: boolean;
  onCerrar: () => void;
  onFinalizar: () => void;
}) {
  const [actual, setActual] = useState(0);
  const paso = pasos[actual];
  const ultimo = actual === pasos.length - 1;
  const puedeAvanzar = paso.valido !== false;

  // Solo se puede saltar a un paso ya visitado o al siguiente si el actual está completo.
  function ir(i: number) {
    if (i <= actual || (i === actual + 1 && puedeAvanzar)) setActual(i);
  }

  return (
    <Modal
      titulo={titulo}
      descripcion={descripcion}
      ancho={ancho}
      onCerrar={onCerrar}
      cabeceraExtra={
        <ol className="asistente__pasos" aria-label="Pasos">
          {pasos.map((p, i) => {
            const hecho = i < actual;
            return (
              <li
                key={p.id}
                className={`${i === actual ? "esta-activo" : ""} ${hecho ? "esta-hecho" : ""}`}
                aria-current={i === actual ? "step" : undefined}
              >
                <button type="button" onClick={() => ir(i)} disabled={i > actual + 1 || (i === actual + 1 && !puedeAvanzar)}>
                  <span className="asistente__numero">{hecho ? <Check size={12} /> : i + 1}</span>
                  <span className="asistente__titulo">{p.titulo}</span>
                </button>
              </li>
            );
          })}
        </ol>
      }
      pie={
        <>
          <span className="asistente__cuenta tenue">
            Paso {actual + 1} de {pasos.length}
          </span>
          <Boton onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          {actual > 0 && (
            <Boton icono={<ArrowLeft size={14} />} onClick={() => setActual(actual - 1)} disabled={trabajando}>
              Atrás
            </Boton>
          )}
          {ultimo ? (
            <Boton variante="primario" cargando={trabajando} disabled={!puedeAvanzar} onClick={onFinalizar}>
              {etiquetaFinal}
            </Boton>
          ) : (
            <Boton variante="primario" disabled={!puedeAvanzar} onClick={() => setActual(actual + 1)}>
              Siguiente <ArrowRight size={14} />
            </Boton>
          )}
        </>
      }
    >
      <div key={paso.id} className="asistente__contenido">
        {paso.contenido}
      </div>
    </Modal>
  );
}

/** Una fila «etiqueta → valor» para el paso de revisión. */
export function Resumen({ filas }: { filas: { etiqueta: string; valor: ReactNode }[] }) {
  return (
    <dl className="asistente__resumen">
      {filas.map((f) => (
        <div key={f.etiqueta}>
          <dt>{f.etiqueta}</dt>
          <dd>{f.valor || <span className="tenue">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
