import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { confirmarDescartar } from "../utils/alertas";

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
  /** Escape cierra (llama a `onCerrar`), preguntando antes si hay cambios
   *  sin guardar, igual que el clic fuera y la ×. */
  cerrarConEscape?: boolean;
  /** Texto bajo el título, para dar contexto ("Producto: Papa sabanera"). */
  subtitulo?: ReactNode;
  /** Muestra un botón para llevar el modal a casi toda la pantalla y volver. */
  expandible?: boolean;
  /** Va pegado bajo el encabezado y no se desplaza con el cuerpo (pestañas, pasos). */
  subcabecera?: ReactNode;
  /** Clase extra en la caja del modal, para el estilo propio de un modal concreto. */
  clase?: string;
  /**
   * `onCerrar` ya pregunta por su cuenta antes de descartar (porque sabe con
   * exactitud qué cambió): el modal no vuelve a preguntar. Ver «Cambios sin
   * guardar» más abajo.
   */
  preguntaAlCerrar?: boolean;
}

/**
 * Pila de modales abiertos: con uno encima de otro (la presentación sobre el
 * producto), Escape y el foco son del de arriba, no de todos a la vez.
 */
const pila: string[] = [];

/**
 * «Cambios sin guardar»: la foto de lo que dicen los campos del modal.
 *
 * Un clic fuera del modal, la × o Escape cerraban sin más, y con un
 * formulario a medias se perdía todo. Ahora el modal compara sus campos con
 * cómo estaban cuando el usuario empezó a tocarlos y, si algo cambió,
 * pregunta antes de cerrar. Vive aquí, una vez, y no en cada formulario: así
 * lo tienen todos los modales del panel, también los que se escriban después.
 *
 * Cuenta todo lo que guarda un valor: entradas, selects, áreas de texto,
 * casillas, texto editable y los controles propios que lo exponen en
 * `data-campo-valor` (el `Combobox`, el campo de imagen). Si una fila se añade
 * o se quita, cambia el número de campos y también cuenta.
 *
 * No cuentan los buscadores (`type="search"` o `data-sin-cambios`): escribir
 * para filtrar no es un cambio que se pierda. Tampoco los campos de un modal
 * abierto encima, que tiene su propia foto.
 */
const CAMPOS =
  "input, select, textarea, [contenteditable='true'], [data-campo-valor], [role='switch'][aria-checked]";
const SIN_VALOR = new Set(["search", "button", "submit", "reset", "image"]);

function huellaDeCampos(caja: HTMLElement): string {
  const partes: string[] = [];
  caja.querySelectorAll<HTMLElement>(CAMPOS).forEach((el) => {
    if (el.closest(".modal") !== caja || el.closest("[data-sin-cambios]")) return;
    if (el.dataset.campoValor !== undefined) partes.push(el.dataset.campoValor);
    else if (el.getAttribute("role") === "switch") partes.push(el.getAttribute("aria-checked") ?? "");
    else if (el instanceof HTMLInputElement) {
      if (SIN_VALOR.has(el.type)) return;
      if (el.type === "checkbox" || el.type === "radio") partes.push(String(el.checked));
      else if (el.type === "file") partes.push(Array.from(el.files ?? [], (f) => `${f.name}:${f.size}`).join(","));
      else partes.push(el.value);
    } else if (el instanceof HTMLSelectElement) {
      partes.push(Array.from(el.selectedOptions, (o) => o.value).join(","));
    } else if (el instanceof HTMLTextAreaElement) partes.push(el.value);
    else partes.push(el.innerHTML);
  });
  return `${partes.length}|${partes.join("")}`;
}

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
  expandible,
  subcabecera,
  clase,
  preguntaAlCerrar,
}: Props) {
  const id = useId();
  const [expandido, setExpandido] = useState(false);
  // ¿Se abre encima de otro modal (la biblioteca sobre el producto)? Se fija
  // al montar: el de abajo ya está en la pila porque se abrió antes.
  const [encima] = useState(() => pila.length > 0);
  const caja = useRef<HTMLDivElement>(null);
  // La foto de los campos se toma en la PRIMERA interacción del usuario, no
  // al abrir: muchos formularios rellenan sus campos al llegar los datos, y
  // eso no es un cambio de nadie. El autofoco del abrir no cuenta (no es un
  // clic ni una tecla).
  const huellaInicial = useRef<string | null>(null);
  const preguntando = useRef(false);
  // Dónde empezó el clic: si fue DENTRO del modal (seleccionar texto y soltar
  // fuera), soltar sobre el fondo no es «clic fuera» y no debe cerrar.
  const pulsadoEnFondo = useRef(false);

  function tomarHuella() {
    if (huellaInicial.current === null && caja.current) huellaInicial.current = huellaDeCampos(caja.current);
  }

  async function intentarCerrar() {
    if (preguntando.current) return;
    const cambio =
      !preguntaAlCerrar &&
      huellaInicial.current !== null &&
      caja.current !== null &&
      huellaDeCampos(caja.current) !== huellaInicial.current;
    if (cambio) {
      preguntando.current = true;
      try {
        if (!(await confirmarDescartar())) return;
      } finally {
        preguntando.current = false;
      }
    }
    cerrarRef.current();
  }

  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const intentarRef = useRef(intentarCerrar);
  intentarRef.current = intentarCerrar;

  // Pegar, el autocompletado del navegador o el dictado cambian un campo sin
  // clic ni tecla dentro del modal. `beforeinput` llega justo ANTES de que el
  // valor cambie, así que la foto sigue siendo la de antes del cambio.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const alEscribir = () => {
      if (huellaInicial.current === null) huellaInicial.current = huellaDeCampos(el);
    };
    el.addEventListener("beforeinput", alEscribir, true);
    return () => el.removeEventListener("beforeinput", alEscribir, true);
  }, []);

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
      void intentarRef.current();
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [cerrarConEscape, id]);

  const contenido = (
    <div
      className={`modal-overlay ${lateral ? "lateral" : ""} ${amplio ? "amplio" : ""} ${encima ? "encima" : ""}`}
      onMouseDown={(e) => {
        pulsadoEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || !pulsadoEnFondo.current) return;
        void intentarCerrar();
      }}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        className={`modal ${ancho ? "ancho" : ""} ${lateral ? "lateral" : ""} ${amplio ? "amplio" : ""} ${medio ? "medio" : ""} ${expandido ? "expandido" : ""} ${clase ?? ""}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDownCapture={tomarHuella}
        onKeyDownCapture={tomarHuella}
      >
        <header className={subcabecera ? "con-subcabecera" : undefined}>
          <div className="modal-titulos">
            <h2 id={`${id}-titulo`}>{titulo}</h2>
            {subtitulo && <p className="modal-subtitulo">{subtitulo}</p>}
          </div>
          <div className="modal-acciones-cabecera">
            {expandible && (
              <button
                type="button"
                className="cerrar-x modal-expandir"
                onClick={() => setExpandido((v) => !v)}
                aria-pressed={expandido}
                aria-label={expandido ? "Restaurar tamaño" : "Expandir"}
                title={expandido ? "Restaurar tamaño" : "Expandir"}
              >
                {expandido ? <Minimize2 size={17} aria-hidden /> : <Maximize2 size={17} aria-hidden />}
              </button>
            )}
            <button type="button" className="cerrar-x" onClick={() => void intentarCerrar()} aria-label="Cerrar">
              ×
            </button>
          </div>
        </header>
        {subcabecera && <div className="modal-subcabecera">{subcabecera}</div>}
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
  //
  // Lo mismo para CUALQUIER modal abierto encima de otro: dibujado dentro del
  // de abajo, quedaba atrapado en su contexto de apilamiento y los campos del
  // formulario de debajo (los desplegables de categoría y unidad) asomaban por
  // encima de la biblioteca.
  return amplio || encima ? createPortal(contenido, document.body) : contenido;
}
