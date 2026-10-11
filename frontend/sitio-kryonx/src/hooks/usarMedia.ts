import { useEffect, useState } from "react";

/** `true` mientras la consulta de medios se cumpla. */
export function usarMedia(consulta: string): boolean {
  const [cumple, setCumple] = useState(
    () => typeof window !== "undefined" && window.matchMedia(consulta).matches
  );

  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const alCambiar = () => setCumple(lista.matches);
    alCambiar();
    lista.addEventListener("change", alCambiar);
    return () => lista.removeEventListener("change", alCambiar);
  }, [consulta]);

  return cumple;
}
