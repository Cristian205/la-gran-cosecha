import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  footer?: ReactNode;
  ancho?: boolean;
  lateral?: boolean;
  /** Central, a pantalla completa en el móvil. 860 px; con `ancho`, 1000 px. */
  amplio?: boolean;
  /** Con `amplio`: 640 px, para formularios cortos (cliente, usuario…). */
  medio?: boolean;
  /** Escape cierra (llama a `onCerrar`). Opt-in: en formularios largos,
   *  `onCerrar` debería preguntar antes de descartar cambios. */
  cerrarConEscape?: boolean;
  /** Texto bajo el título, para dar contexto ("Producto: Papa sabanera"). */
  subtitulo?: ReactNode;
}

/**
 * Pila de modales abiertos: con uno encima de otro (la presentación sobre el
 * producto), Escape y el foco son del de arriba, no de todos a la vez.
 */
const pila: string[] = [];

const ENFOCABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function Modal({
  titulo,
  onCerrar,
  children,
  footer,
  ancho,
  lateral,
  amplio,
  medio,
  cerrarConEscape,
  subtitulo,
}: Props) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    pila.push(id);
    // Al cerrar, el foco vuelve a lo que abrió el modal (el botón "Editar",
    // "Agregar presentación"…): quien navega con teclado no se pierde.
    const previo = document.activeElement as HTMLElement | null;
    // Si un hijo ya pidió el foco (`autoFocus`), se respeta.
    if (caja.current && !caja.current.contains(document.activeElement)) {
      const primero =
        caja.current.querySelector(".cuerpo")?.querySelector<HTMLElement>(ENFOCABLE) ??
        caja.current.querySelector<HTMLElement>(ENFOCABLE);
      primero?.focus();
    }
    return () => {
      const i = pila.lastIndexOf(id);
      if (i >= 0) pila.splice(i, 1);
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [id]);

  useEffect(() => {
    if (!cerrarConEscape) return;
    function alPulsar(e: KeyboardEvent) {
      if (e.key !== "Escape" || pila[pila.length - 1] !== id) return;
      // Un SweetAlert abierto encima maneja su propio Escape.
      if (document.querySelector(".swal2-container")) return;
      e.preventDefault();
      cerrarRef.current();
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [cerrarConEscape, id]);

  const contenido = (
    <div
      className={`modal-overlay ${lateral ? "lateral" : ""} ${amplio ? "amplio" : ""}`}
      onClick={onCerrar}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        className={`modal ${ancho ? "ancho" : ""} ${lateral ? "lateral" : ""} ${amplio ? "amplio" : ""} ${medio ? "medio" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div className="modal-titulos">
            <h2 id={`${id}-titulo`}>{titulo}</h2>
            {subtitulo && <p className="modal-subtitulo">{subtitulo}</p>}
          </div>
          <button type="button" className="cerrar-x" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="cuerpo">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
  // El amplio suele abrirse ENCIMA de otro modal (la presentación sobre el
  // editor de producto). Con el portal cubre siempre la pantalla entera y se
  // apila por orden de apertura, aunque algún ancestro use `transform` o
  // `backdrop-filter` (que convierten en referencia a cualquier
  // `position: fixed` de dentro). Los eventos de React siguen subiendo por el
  // árbol de siempre.
  return amplio ? createPortal(contenido, document.body) : contenido;
}
