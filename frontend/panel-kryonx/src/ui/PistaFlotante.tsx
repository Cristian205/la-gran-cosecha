/**
 * Las pistas (`data-pista`) de la barra lateral plegada y de los botones que
 * son solo icono.
 *
 * Antes eran un `::after` dentro del propio enlace. En la barra lateral eso no
 * funciona: `.lateral__nav` tiene `overflow-y: auto`, y con eso el eje X deja
 * de ser `visible`. La pista quedaba recortada (no se veía) y además abría un
 * scroll horizontal dentro del menú. Cerca del borde derecho de la ventana, las
 * pistas de la cabecera también podían salirse de la pantalla.
 *
 * Aquí hay UNA sola pista para toda la app: escucha en el documento, y cuando
 * el puntero o el foco llegan a un elemento con `data-pista` que la necesita,
 * la pinta en `document.body` con posición fija, siempre dentro de la ventana.
 * Ningún contenedor puede recortarla ni ensancharse por ella.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "./pista.css";

/** Dónde aplica: lo mismo que antes mostraba el `::after`. */
const SELECTOR = ".lateral.esta-plegado [data-pista], .icono-boton[data-pista]";
const MARGEN = 8;
const SEPARACION = 10;

interface Objetivo {
  texto: string;
  rect: DOMRect;
  /** En la barra lateral va a la derecha del icono; en el resto, debajo. */
  lado: "derecha" | "abajo";
}

function objetivoDe(nodo: EventTarget | null): Element | null {
  if (!(nodo instanceof Element)) return null;
  const el = nodo.closest("[data-pista]");
  return el && el.matches(SELECTOR) ? el : null;
}

export function PistaFlotante() {
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);
  const [estilo, setEstilo] = useState<CSSProperties>({ visibility: "hidden" });
  const caja = useRef<HTMLDivElement>(null);
  const actual = useRef<Element | null>(null);

  useEffect(() => {
    function mostrar(el: Element) {
      const texto = el.getAttribute("data-pista");
      if (!texto) return;
      actual.current = el;
      setObjetivo({
        texto,
        rect: el.getBoundingClientRect(),
        lado: el.closest(".lateral") ? "derecha" : "abajo",
      });
    }
    function ocultar() {
      actual.current = null;
      setObjetivo(null);
    }

    const alEntrar = (e: Event) => {
      const el = objetivoDe(e.target);
      if (el && el !== actual.current) mostrar(el);
    };
    const alSalir = (e: Event) => {
      const desde = objetivoDe(e.target);
      const hacia = objetivoDe((e as MouseEvent | FocusEvent).relatedTarget);
      if (desde && desde !== hacia) ocultar();
    };

    document.addEventListener("pointerover", alEntrar);
    document.addEventListener("pointerout", alSalir);
    document.addEventListener("focusin", alEntrar);
    document.addEventListener("focusout", alSalir);
    // Al pulsar, desplazar o cambiar el tamaño, la pista ya no acompaña al botón.
    document.addEventListener("pointerdown", ocultar);
    window.addEventListener("scroll", ocultar, true);
    window.addEventListener("resize", ocultar);
    return () => {
      document.removeEventListener("pointerover", alEntrar);
      document.removeEventListener("pointerout", alSalir);
      document.removeEventListener("focusin", alEntrar);
      document.removeEventListener("focusout", alSalir);
      document.removeEventListener("pointerdown", ocultar);
      window.removeEventListener("scroll", ocultar, true);
      window.removeEventListener("resize", ocultar);
    };
  }, []);

  // Se mide la pista ya pintada (invisible) y se coloca donde quepa.
  useLayoutEffect(() => {
    if (!objetivo || !caja.current) {
      setEstilo({ visibility: "hidden" });
      return;
    }
    const { rect, lado } = objetivo;
    const ancho = caja.current.offsetWidth;
    const alto = caja.current.offsetHeight;
    const maxLeft = window.innerWidth - ancho - MARGEN;
    const maxTop = window.innerHeight - alto - MARGEN;
    let left: number;
    let top: number;
    if (lado === "derecha") {
      left = rect.right + SEPARACION;
      if (left > maxLeft) left = rect.left - SEPARACION - ancho;
      top = rect.top + rect.height / 2 - alto / 2;
    } else {
      left = rect.left + rect.width / 2 - ancho / 2;
      top = rect.bottom + 7;
      if (top > maxTop) top = rect.top - 7 - alto;
    }
    setEstilo({
      left: Math.min(Math.max(MARGEN, left), maxLeft),
      top: Math.min(Math.max(MARGEN, top), maxTop),
    });
  }, [objetivo]);

  if (!objetivo) return null;
  return createPortal(
    <div ref={caja} className="pista-flotante" role="tooltip" style={estilo}>
      {objetivo.texto}
    </div>,
    document.body
  );
}
