"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const DURACION_MS = 2400;
const INTENTOS_MAX = 30;
const INTERVALO_MS = 100;

/**
 * Lee el parámetro `?resaltar=<id>` de la URL: si existe, hace scroll hasta
 * el elemento con ese id y le aplica un flash visual por unos segundos.
 * Reintenta mientras el contenido llega de forma asíncrona (`dependencia`
 * fuerza un nuevo intento cuando cambia, p.ej. al terminar de cargar datos).
 */
export function useResaltarAlLlegar(dependencia?: unknown) {
  // En Next los parámetros son de solo lectura: para quitar `?resaltar` se
  // reescribe la URL con `history.replaceState`, que además evita añadir una
  // entrada al historial —volver atrás no debe repetir el resaltado—.
  const params = useSearchParams();
  const pathname = usePathname();
  const objetivo = params.get("resaltar");

  useEffect(() => {
    if (!objetivo) return;
    const idObjetivo = objetivo;
    let cancelado = false;
    let intentos = 0;

    function limpiarParametro() {
      const siguiente = new URLSearchParams(params.toString());
      siguiente.delete("resaltar");
      const cadena = siguiente.toString();
      window.history.replaceState(null, "", pathname + (cadena ? `?${cadena}` : ""));
    }

    function intentar() {
      if (cancelado) return;
      const el = document.getElementById(idObjetivo);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("resaltado");
        setTimeout(() => el.classList.remove("resaltado"), DURACION_MS);
        limpiarParametro();
        return;
      }
      intentos += 1;
      if (intentos < INTENTOS_MAX) {
        setTimeout(intentar, INTERVALO_MS);
      } else {
        limpiarParametro();
      }
    }

    intentar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo, dependencia]);
}
