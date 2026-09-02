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

/** Los campos de identidad que una plantilla propone. Espejo de
 *  `storefront.aspecto.CAMPOS_DE_MARCA`. */
export interface MarcaPropuesta {
  color_primario?: string;
  color_primario_texto?: string;
  color_secundario?: string;
  color_secundario_texto?: string;
  color_fondo?: string;
  color_superficie?: string;
  color_texto?: string;
  fuente?: string;
  radio_boton?: string;
}

interface Opciones {
  origen: string | null;
  composicion: Composicion;
  /** Las variables CSS de los tokens, ya resueltas. */
  variables: Record<string, string>;
  /**
   * El color de marca y la tipografia que la plantilla propone.
   *
   * Se manda SIN resolver, y es deliberado: de `color_primario` cuelga una
   * escala de nueve pasos, y quien sabe derivarla es la tienda. Resolverla aqui
   * seria una segunda copia de esa matematica, y la copia que se queda vieja
   * siempre es la del panel.
   */
  marca?: MarcaPropuesta;
  elegido: string | null;
  onSeleccion: (id: string) => void;
}

export function usarPrevia({
  origen,
  composicion,
  variables,
  marca,
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
    // Con marca se manda el aspecto entero y la tienda lo traduce; sin ella
    // —el panel del negocio, que ya tiene su color puesto— basta con las
    // variables de los tokens.
    if (!lista) return;
    if (marca) enviar({ tipo: "aspecto", marca, tokens: variables });
    else enviar({ tipo: "tema", variables });
  }, [lista, variables, marca, enviar]);

  useEffect(() => {
    if (lista) enviar({ tipo: "seleccion", id: elegido });
  }, [lista, elegido, enviar]);

  const reiniciar = useCallback(() => setLista(false), []);

  return { marco, lista, reiniciar };
}
