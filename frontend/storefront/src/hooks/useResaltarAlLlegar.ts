import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

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
  const [params, setParams] = useSearchParams();
  const objetivo = params.get("resaltar");

  useEffect(() => {
    if (!objetivo) return;
    const idObjetivo = objetivo;
    let cancelado = false;
    let intentos = 0;

    function limpiarParametro() {
      setParams(
        (prev) => {
          const siguiente = new URLSearchParams(prev);
          siguiente.delete("resaltar");
          return siguiente;
        },
        { replace: true }
      );
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
