"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BloqueColocado } from "@/lib/tipos";
import { Lienzo } from "./Lienzo";

/**
 * La tienda dentro del editor.
 *
 * Es lo que separa una vista previa de un editor visual: aquí la página no se
 * recarga para verse actualizada. El panel manda la composición por
 * `postMessage` en cuanto alguien mueve un bloque o escribe un título, y esto
 * la repinta — sin guardar, sin ir al servidor y sin perder el desplazamiento.
 *
 * La conversación va en las dos direcciones, y esa es la otra mitad del asunto:
 * al pulsar una sección aquí, se avisa al panel para que la seleccione. Sin eso
 * la previa sería una imagen, no una superficie de trabajo.
 *
 * Solo se monta con `?editor=1`. Un visitante normal no carga nada de esto.
 */

/** Lo que el panel envía. */
type MensajeDelPanel =
  | { fuente: "crynex-editor"; tipo: "composicion"; bloques: BloqueColocado[] }
  | { fuente: "crynex-editor"; tipo: "seleccion"; id: string | null }
  | {
      fuente: "crynex-editor";
      tipo: "tema";
      variables: Record<string, string>;
    };

/** Lo que se responde. */
type MensajeALPanel =
  | { fuente: "crynex-tienda"; tipo: "listo" }
  | { fuente: "crynex-tienda"; tipo: "seleccion"; id: string };

interface Props {
  /** La composición publicada o en borrador, para el primer pintado. */
  inicial: BloqueColocado[];
  datos: Record<string, unknown>;
  /**
   * Quiénes pueden hablar con esta página, separados por comas.
   *
   * Se compara contra `event.origin` de cada mensaje: sin esto, cualquier
   * página que consiguiera enmarcar la tienda podría reescribir lo que se ve.
   *
   * Son varios porque hay dos editores —el panel del negocio y el Control
   * Center de Crynex— y viven en direcciones distintas. Con uno solo, el otro
   * quedaba mudo: los mensajes se descartaban en silencio y la previa parecía
   * funcionar porque el primer pintado sí llega del servidor.
   */
  origenPanel: string;
}

export function CapaEditor({ inicial, datos, origenPanel }: Props) {
  const [bloques, setBloques] = useState(inicial);
  const [elegido, setElegido] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const permitidos = useMemo(
    () =>
      origenPanel
        .split(",")
        .map((o) => o.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    [origenPanel]
  );

  const responder = useCallback(
    (mensaje: MensajeALPanel) => {
      // Se responde a quien enmarca, no a todos: `postMessage` con "*" dejaría
      // leer la respuesta a cualquier página que consiguiera abrir la tienda.
      const destino = permitidos.length === 1 ? permitidos[0] : "*";
      window.parent?.postMessage(mensaje, destino);
    },
    [permitidos]
  );

  useEffect(() => {
    function alRecibir(evento: MessageEvent) {
      // Dos filtros y los dos hacen falta: el origen impide que hable quien no
      // debe, y la marca `fuente` evita confundirse con los mensajes que otras
      // herramientas (extensiones, Vite, Next) mandan a la misma ventana.
      if (permitidos.length > 0 && !permitidos.includes(evento.origin)) return;
      const dato = evento.data as MensajeDelPanel | undefined;
      if (dato?.fuente !== "crynex-editor") return;

      if (dato.tipo === "composicion") setBloques(dato.bloques);

      // El tema se escribe directamente sobre la raíz del documento y no pasa
      // por el estado de React: son variables CSS, así que el navegador
      // repinta sin que nada se vuelva a montar. Mover un color no puede
      // costar reconstruir doce secciones.
      if (dato.tipo === "tema") {
        for (const [variable, valor] of Object.entries(dato.variables)) {
          if (valor) document.documentElement.style.setProperty(variable, valor);
          else document.documentElement.style.removeProperty(variable);
        }
      }
      if (dato.tipo === "seleccion") {
        setElegido(dato.id);
        if (dato.id) {
          raiz.current
            ?.querySelector(`[data-bloque="${CSS.escape(dato.id)}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }

    window.addEventListener("message", alRecibir);
    // El panel no sabe cuándo terminó de cargar el iframe: se avisa, y así
    // manda la composición actual en vez de esperar un tiempo fijo.
    responder({ fuente: "crynex-tienda", tipo: "listo" });
    return () => window.removeEventListener("message", alRecibir);
  }, [permitidos, responder]);

  /**
   * Un clic en cualquier punto de una sección la selecciona.
   *
   * Se captura en el contenedor y no en cada bloque porque los bloques no
   * saben que están en un editor, y no deberían: se busca hacia arriba el
   * ancestro que lleva `data-bloque`.
   */
  function alPulsar(evento: React.MouseEvent) {
    const seccion = (evento.target as HTMLElement).closest<HTMLElement>(
      "[data-bloque]"
    );
    if (!seccion) return;
    // Dentro del editor los enlaces no navegan: irse a otra página mientras se
    // compone es perder el trabajo de vista.
    evento.preventDefault();
    const id = seccion.dataset.bloque!;
    setElegido(id);
    responder({ fuente: "crynex-tienda", tipo: "seleccion", id });
  }

  // La clase se pone sobre el nodo ya montado en vez de pasarla por props:
  // el `Lienzo` no tiene por que saber que existe un editor, y asi el bloque
  // elegido se puede cambiar sin repintar las doce secciones.
  useEffect(() => {
    const nodos = raiz.current?.querySelectorAll<HTMLElement>("[data-bloque]");
    nodos?.forEach((nodo) => {
      nodo.classList.toggle("esta-elegido", nodo.dataset.bloque === elegido);
    });
  }, [elegido, bloques]);

  return (
    <div ref={raiz} className="capa-editor" onClickCapture={alPulsar}>
      <Lienzo bloques={bloques} datos={datos} marcarBloques />
    </div>
  );
}
