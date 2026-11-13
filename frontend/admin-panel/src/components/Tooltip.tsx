import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Lado = "arriba" | "abajo" | "izquierda" | "derecha";

interface Props {
  label: string;
  children: ReactNode;
  /** El lado preferido. Si ahí no cabe, se voltea al opuesto. */
  posicion?: Lado;
}

/** Distancia mínima al borde de la ventana y separación con el ancla. */
const MARGEN = 8;
const SEPARACION = 9;

interface Colocacion {
  top: number;
  left: number;
  lado: Lado;
  /** Dónde apunta la flecha, medido desde el borde del globo. */
  flecha: number;
}

/**
 * Globo de ayuda que NUNCA queda tapado ni recortado.
 *
 * Se pinta en `document.body` (portal) con `position: fixed`, así que no
 * depende de lo que haya alrededor: ni una tarjeta vecina que se pinta
 * encima, ni un contenedor con `overflow: hidden`, ni un modal. Su posición se
 * calcula contra la ventana: si en el lado pedido no cabe, se voltea, y en el
 * otro eje se desliza para no salirse por los bordes; la flecha sigue
 * apuntando al ancla.
 */
export function Tooltip({ label, children, posicion = "arriba" }: Props) {
  const [visible, setVisible] = useState(false);
  const [colocacion, setColocacion] = useState<Colocacion | null>(null);
  const id = useId();
  const ancla = useRef<HTMLSpanElement>(null);
  const globo = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!visible) {
      setColocacion(null);
      return;
    }
    function calcular() {
      if (!ancla.current || !globo.current) return;
      const a = ancla.current.getBoundingClientRect();
      const w = globo.current.offsetWidth;
      const h = globo.current.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

      let lado: Lado = posicion;
      if (lado === "arriba" && a.top - SEPARACION - h < MARGEN) lado = "abajo";
      else if (lado === "abajo" && a.bottom + SEPARACION + h > vh - MARGEN) lado = "arriba";
      else if (lado === "izquierda" && a.left - SEPARACION - w < MARGEN) lado = "derecha";
      else if (lado === "derecha" && a.right + SEPARACION + w > vw - MARGEN) lado = "izquierda";
      // Si tampoco cabe al costado (pantallas estrechas), va arriba o abajo.
      if ((lado === "izquierda" && a.left - SEPARACION - w < MARGEN) || (lado === "derecha" && a.right + SEPARACION + w > vw - MARGEN))
        lado = a.top - SEPARACION - h >= MARGEN ? "arriba" : "abajo";

      if (lado === "arriba" || lado === "abajo") {
        const left = limitar(a.left + a.width / 2 - w / 2, MARGEN, vw - MARGEN - w);
        setColocacion({
          lado,
          left,
          top: lado === "arriba" ? a.top - SEPARACION - h : a.bottom + SEPARACION,
          flecha: limitar(a.left + a.width / 2 - left, 12, w - 12),
        });
      } else {
        const top = limitar(a.top + a.height / 2 - h / 2, MARGEN, vh - MARGEN - h);
        setColocacion({
          lado,
          top,
          left: lado === "izquierda" ? a.left - SEPARACION - w : a.right + SEPARACION,
          flecha: limitar(a.top + a.height / 2 - top, 10, h - 10),
        });
      }
    }
    calcular();
    // Con el globo abierto, desplazarse o cambiar el tamaño lo recoloca.
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
  }, [visible, posicion, label]);

  return (
    <span
      ref={ancla}
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      {visible &&
        createPortal(
          <span
            ref={globo}
            id={id}
            role="tooltip"
            className={`tooltip-globo tooltip-globo--${colocacion?.lado ?? posicion}`}
            style={{
              top: colocacion?.top ?? 0,
              left: colocacion?.left ?? 0,
              // El primer pintado solo sirve para medir: invisible hasta tener sitio.
              visibility: colocacion ? "visible" : "hidden",
              ["--flecha" as string]: `${colocacion?.flecha ?? 0}px`,
            }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}
