import { useCallback, useEffect, useRef, useState } from "react";
import type { Composicion } from "../api/tienda";

/**
 * La conversación con la tienda que se está previsualizando.
 *
 * Una plantilla no pertenece a ningún negocio, así que no hay tienda propia
 * contra la que verla: se elige una empresa de referencia y se le manda la
 * composición de la plantilla por `postMessage`. Lo que se ve es «cómo quedaría
 * este molde con los datos de esa empresa», que es exactamente la pregunta que
 * se hace quien diseña una plantilla.
 *
 * Nada de esto toca la tienda real: los mensajes solo cambian lo que ese
 * navegador pinta. La tienda de la empresa sigue sirviendo lo publicado.
 */
type MensajeDeLaTienda =
  | { fuente: "crynex-tienda"; tipo: "listo" }
  | { fuente: "crynex-tienda"; tipo: "seleccion"; id: string };

interface Opciones {
  origen: string | null;
  composicion: Composicion;
  /** Las variables CSS del tema, ya resueltas. */
  variables: Record<string, string>;
  elegido: string | null;
  onSeleccion: (id: string) => void;
}

export function usarPrevia({
  origen,
  composicion,
  variables,
  elegido,
  onSeleccion,
}: Opciones) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [lista, setLista] = useState(false);

  const enviar = useCallback(
    (mensaje: Record<string, unknown>) => {
      if (!origen) return;
      marco.current?.contentWindow?.postMessage(
        { fuente: "crynex-editor", ...mensaje },
        origen
      );
    },
    [origen]
  );

  useEffect(() => {
    function alRecibir(evento: MessageEvent) {
      if (origen && evento.origin !== origen) return;
      const dato = evento.data as MensajeDeLaTienda | undefined;
      if (dato?.fuente !== "crynex-tienda") return;
      if (dato.tipo === "listo") setLista(true);
      if (dato.tipo === "seleccion") onSeleccion(dato.id);
    }
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [origen, onSeleccion]);

  // Los mensajes solo salen cuando la tienda ha dicho que está lista: un
  // `postMessage` a un iframe que aún carga se pierde sin avisar.
  useEffect(() => {
    if (lista) enviar({ tipo: "composicion", bloques: composicion });
  }, [lista, composicion, enviar]);

  useEffect(() => {
    if (lista) enviar({ tipo: "tema", variables });
  }, [lista, variables, enviar]);

  useEffect(() => {
    if (lista) enviar({ tipo: "seleccion", id: elegido });
  }, [lista, elegido, enviar]);

  const reiniciar = useCallback(() => setLista(false), []);

  return { marco, lista, reiniciar };
}
