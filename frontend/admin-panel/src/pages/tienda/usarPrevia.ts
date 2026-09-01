import { useCallback, useEffect, useRef, useState } from "react";
import type { Composicion } from "../../api/tienda";

/**
 * La conversación con la tienda dentro del iframe.
 *
 * Es lo que convierte una vista previa en un editor: la composición viaja por
 * `postMessage` en cuanto cambia, así que la tienda se repinta sin guardar, sin
 * recargar y sin perder el desplazamiento. Guardar pasa a ser lo que debe ser
 * —decidir que esto quede— en vez del paso obligatorio para poder mirar.
 *
 * Los mensajes se mandan solo cuando la tienda ha dicho que está lista: un
 * `postMessage` a un iframe que aún carga se pierde sin avisar, y el editor
 * arrancaría mostrando la versión vieja hasta el primer cambio.
 */
type MensajeDeLaTienda =
  | { fuente: "crynex-tienda"; tipo: "listo" }
  | { fuente: "crynex-tienda"; tipo: "seleccion"; id: string };

interface Opciones {
  /** El origen de la tienda; se usa como destino de cada mensaje. */
  origen: string | null;
  composicion: Composicion;
  elegido: string | null;
  /** Al pulsar una sección dentro de la propia tienda. */
  onSeleccion: (id: string) => void;
}

export function usarPrevia({ origen, composicion, elegido, onSeleccion }: Opciones) {
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

  // Escucha a la tienda: cuándo está lista y qué sección se pulsó dentro.
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

  // La composición, en cuanto cambia. Sin retardo a propósito: `postMessage`
  // es una llamada local, no una petición, y un temporizador solo añadiría un
  // salto perceptible al escribir un título.
  useEffect(() => {
    if (lista) enviar({ tipo: "composicion", bloques: composicion });
  }, [lista, composicion, enviar]);

  // La selección va aparte: mueve el desplazamiento de la tienda hasta la
  // sección, que es lo que hace que elegir en la lista sirva para algo.
  useEffect(() => {
    if (lista) enviar({ tipo: "seleccion", id: elegido });
  }, [lista, elegido, enviar]);

  /** Se llama al recargar el iframe: hasta el próximo «listo», no se habla. */
  const reiniciar = useCallback(() => setLista(false), []);

  return { marco, lista, reiniciar };
}
