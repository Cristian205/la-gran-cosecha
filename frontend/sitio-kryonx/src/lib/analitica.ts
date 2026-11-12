/**
 * Eventos de analítica del sitio comercial.
 *
 * No elige proveedor: publica cada evento de la forma que el proveedor que
 * esté instalado espera —Google Tag Manager/GA4 (`dataLayer`/`gtag`) o
 * Plausible— y, además, como un `CustomEvent` del navegador. Sin ninguno
 * instalado no hace nada en producción, que es lo correcto: este archivo no
 * decide qué se mide en la empresa, solo deja de ser un obstáculo cuando se
 * decida. En desarrollo imprime cada evento en la consola.
 *
 * Los nombres de evento son un contrato: un tablero los usa por su nombre.
 */
export type EventoAnalitica =
  | "cta_click" //                 cualquier botón de llamada a la acción
  | "solucion_seleccionada" //     eligió Commerce, Custom o Growth
  | "proyecto_visto" //            abrió un proyecto de la galería
  | "formulario_iniciado" //       tocó el primer campo del formulario
  | "formulario_enviado" //        la solicitud llegó al backend
  | "formulario_error" //          no se pudo enviar
  | "contacto_whatsapp"; //        abrió WhatsApp

type Datos = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (nombre: string, opciones?: { props?: Datos }) => void;
  }
}

export function registrar(evento: EventoAnalitica, datos: Datos = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", evento, datos);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: evento, ...datos });
    }
    if (typeof window.plausible === "function") {
      window.plausible(evento, { props: datos });
    }
    window.dispatchEvent(new CustomEvent("crafteech:evento", { detail: { evento, ...datos } }));
  } catch {
    /* La analítica nunca debe romper la página. */
  }
  if (import.meta.env.DEV) console.debug("[analítica]", evento, datos);
}
