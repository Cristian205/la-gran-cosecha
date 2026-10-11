/**
 * La dirección de cada vista del centro de configuración.
 *
 * Una sola ruta (`/contenido`) con la vista en `?seccion=`: así cualquier
 * parte del panel puede enlazar directo a «Integraciones › WhatsApp» y el
 * botón Atrás del navegador recorre las vistas visitadas.
 */
export const RUTA_CONFIGURACION = "/contenido";

export function rutaDe(clave?: string): string {
  return clave ? `${RUTA_CONFIGURACION}?seccion=${encodeURIComponent(clave)}` : RUTA_CONFIGURACION;
}
