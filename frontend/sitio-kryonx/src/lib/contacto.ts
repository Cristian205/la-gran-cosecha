import type { Solucion } from "../contenido/tipos";

/**
 * Cómo la gente le escribe a Crafteech: por WhatsApp o por el formulario, que
 * guarda la solicitud en el backend de la plataforma.
 *
 * Nada de esto lleva un número ni una dirección escritos: vienen del entorno
 * (`VITE_WHATSAPP_NUMERO`, `VITE_API_URL`) para que ningún dato de contacto
 * salga del código. Sin número, los botones de WhatsApp no se pintan.
 */
const NUMERO = String(import.meta.env.VITE_WHATSAPP_NUMERO ?? "").replace(/\D/g, "");
const API = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const whatsappDisponible = NUMERO.length >= 8;

/** El primer mensaje de cada modalidad: la conversación empieza con contexto. */
const MENSAJES: Record<Solucion | "general", string> = {
  commerce: "Hola Crafteech, quiero crear mi tienda online con Crafteech Commerce.",
  custom: "Hola Crafteech, quiero desarrollar una tienda online personalizada con Crafteech Custom.",
  growth: "Hola Crafteech, ya tengo un proyecto y me interesa el soporte y la evolución de Crafteech Growth.",
  general: "Hola Crafteech, quiero conversar sobre mi proyecto.",
};

export function urlWhatsApp(solucion?: Solucion | null, adicional?: string): string | null {
  if (!whatsappDisponible) return null;
  const base = MENSAJES[solucion ?? "general"];
  const texto = adicional ? `${base}\n\n${adicional}` : base;
  return `https://wa.me/${NUMERO}?text=${encodeURIComponent(texto)}`;
}

export interface SolicitudComercial {
  nombre: string;
  negocio: string;
  solucion: Solucion | "por_definir";
  descripcion: string;
  contacto: string;
  origen: string;
  /** Trampa para bots: una persona nunca lo llena (va escondido). */
  sitio_web: string;
}

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; motivo: "validacion"; errores: Record<string, string> }
  | { ok: false; motivo: "limite" | "red" | "servidor" };

const SOLUCION_API: Record<SolicitudComercial["solucion"], string> = {
  commerce: "COMMERCE",
  custom: "CUSTOM",
  growth: "GROWTH",
  por_definir: "POR_DEFINIR",
};

export async function enviarSolicitud(datos: SolicitudComercial): Promise<ResultadoEnvio> {
  try {
    const respuesta = await fetch(`${API}/api/contact/solicitudes-comerciales/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...datos,
        solucion: SOLUCION_API[datos.solucion],
        pagina: window.location.href,
      }),
    });
    if (respuesta.ok) return { ok: true };
    if (respuesta.status === 429) return { ok: false, motivo: "limite" };
    if (respuesta.status === 400) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as Record<string, string[] | string>;
      const errores = Object.fromEntries(
        Object.entries(cuerpo).map(([campo, mensaje]) => [campo, Array.isArray(mensaje) ? mensaje[0] : String(mensaje)])
      );
      return { ok: false, motivo: "validacion", errores };
    }
    return { ok: false, motivo: "servidor" };
  } catch {
    return { ok: false, motivo: "red" };
  }
}
