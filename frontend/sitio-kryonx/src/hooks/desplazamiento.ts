import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Desplazamiento suave con Lenis.
 *
 * Lenis mueve el scroll nativo de la ventana —no un contenedor falso—, así
 * que `useScroll` de Motion, las anclas y el teclado siguen funcionando igual.
 * Quien pide menos movimiento no lo recibe: para esa persona un scroll con
 * inercia es exactamente el problema.
 */
let instancia: Lenis | null = null;

const reducido = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function usarDesplazamientoSuave() {
  useEffect(() => {
    if (reducido()) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    instancia = lenis;

    let cuadro = 0;
    const paso = (tiempo: number) => {
      lenis.raf(tiempo);
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(cuadro);
      lenis.destroy();
      instancia = null;
    };
  }, []);
}

/** Altura de la navegación fija: el ancla no debe quedar debajo de ella. */
const DESFASE = -72;

/**
 * Lleva a un ancla de la página (`#constructor`). Devuelve `false` si el
 * enlace no es un ancla local, para que el navegador lo siga normalmente.
 */
export function irA(href: string): boolean {
  if (!href.startsWith("#")) return false;
  const destino = href === "#" ? document.body : document.querySelector<HTMLElement>(href);
  if (!destino) return false;

  if (instancia) {
    instancia.scrollTo(destino, { offset: DESFASE });
  } else {
    const y = destino.getBoundingClientRect().top + window.scrollY + DESFASE;
    window.scrollTo({ top: y, behavior: reducido() ? "auto" : "smooth" });
  }
  history.replaceState(null, "", href);
  return true;
}
