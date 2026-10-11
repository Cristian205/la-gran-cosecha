import { useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Un índice que avanza solo, como un carrusel, con dos frenos:
 *
 * - Fuera de pantalla no corre. Una demostración que avanza sin que nadie la
 *   mire solo gasta batería, y al volver estaría en un punto arbitrario.
 * - En cuanto la persona elige algo, se detiene para siempre. Quitarle el
 *   control a quien está explorando es la forma más rápida de que deje de
 *   hacerlo.
 */
export function usarAutoavance(
  total: number,
  intervalo: number,
  zona: RefObject<Element>
) {
  const [indice, setIndice] = useState(0);
  const [manual, setManual] = useState(false);
  const enPantalla = useInView(zona, { amount: 0.35 });
  const reloj = useRef<number>();

  useEffect(() => {
    if (manual || !enPantalla || total < 2) return;
    reloj.current = window.setTimeout(
      () => setIndice((actual) => (actual + 1) % total),
      intervalo
    );
    return () => window.clearTimeout(reloj.current);
  }, [indice, manual, enPantalla, total, intervalo]);

  const elegir = useCallback((siguiente: number) => {
    setManual(true);
    setIndice(siguiente);
  }, []);

  return { indice, elegir, corriendo: !manual && enPantalla, setIndice };
}
