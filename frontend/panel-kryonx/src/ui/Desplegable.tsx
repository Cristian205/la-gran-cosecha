/**
 * Un panel flotante anclado a un botón.
 *
 * `Menu` es para listas de acciones; esto es para paneles con contenido propio
 * —el selector de marca, las notificaciones—. Comparten el comportamiento que
 * importa: se cierra al pulsar fuera, con Escape, y devuelve el foco al botón.
 *
 * Como `Menu`, el panel se pinta en `document.body` con posición fija. Con
 * `position: absolute` dentro de la cabecera, el panel de notificaciones
 * (320px) se salía por la derecha y abría un scroll horizontal en la página.
 * Aquí se coloca junto al botón y siempre dentro de la ventana.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MARGEN = 8;
const SEPARACION = 6;

export function Desplegable({
  disparador,
  etiqueta,
  alineacion = "derecha",
  lado = "abajo",
  ancho = 320,
  claseDisparador = "",
  children,
}: {
  disparador: ReactNode;
  etiqueta: string;
  alineacion?: "izquierda" | "derecha";
  lado?: "abajo" | "lateral";
  ancho?: number;
  claseDisparador?: string;
  children: (cerrar: () => void) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  // Hasta medir el panel no se sabe dónde cabe: se pinta invisible un instante.
  const [posicion, setPosicion] = useState<CSSProperties>({ visibility: "hidden" });
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!abierto) {
      setPosicion({ visibility: "hidden" });
      return;
    }
    const r = caja.current?.getBoundingClientRect();
    const el = panel.current;
    if (!r || !el) return;
    const anchoReal = el.offsetWidth;
    const alto = el.offsetHeight;
    const maxLeft = window.innerWidth - anchoReal - MARGEN;
    const maxTop = Math.max(MARGEN, window.innerHeight - alto - MARGEN);

    let left: number;
    let top: number;
    // "lateral" se abre a la derecha del botón; si no cabe (pantallas
    // estrechas), debajo, como ya hacía la regla de móvil del CSS.
    if (lado === "lateral" && r.right + 10 + anchoReal <= window.innerWidth - MARGEN) {
      left = r.right + 10;
      top = r.top;
    } else {
      left = alineacion === "derecha" ? r.right - anchoReal : r.left;
      top = r.bottom + SEPARACION;
      if (top + alto > window.innerHeight - MARGEN && r.top - SEPARACION - alto >= MARGEN) {
        top = r.top - SEPARACION - alto;
      }
    }
    setPosicion({
      position: "fixed",
      left: Math.min(Math.max(MARGEN, left), maxLeft),
      top: Math.min(Math.max(MARGEN, top), maxTop),
      right: "auto",
      bottom: "auto",
    });
  }, [abierto, alineacion, lado, ancho]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!caja.current?.contains(t) && !panel.current?.contains(t)) setAbierto(false);
    };
    // Con posición fija, al cambiar el tamaño de la ventana el panel quedaría
    // lejos de su botón.
    const alRedimensionar = () => setAbierto(false);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", alRedimensionar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", alRedimensionar);
    };
  }, [abierto]);

  return (
    <div className="desplegable" ref={caja}>
      <button
        ref={boton}
        type="button"
        className={`desplegable__disparador ${claseDisparador} ${abierto ? "esta-abierto" : ""}`}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={etiqueta}
        onClick={() => setAbierto((a) => !a)}
      >
        {disparador}
      </button>
      {abierto &&
        createPortal(
          <div
            id={id}
            ref={panel}
            role="dialog"
            aria-label={etiqueta}
            className={`desplegable__panel desplegable__panel--${alineacion} desplegable__panel--${lado}`}
            style={{ width: `min(${ancho}px, calc(100vw - ${MARGEN * 2}px))`, ...posicion }}
          >
            {children(() => setAbierto(false))}
          </div>,
          document.body
        )}
    </div>
  );
}
