/**
 * Qué es un hostname, a la vista de la consola.
 *
 * La plataforma guarda un `verificado` por dominio, pero hoy no existe ninguna
 * comprobación DNS, de certificado ni de conectividad: ese indicador lo fija
 * una persona. Esta clasificación sirve solo para NO presentar como dominio
 * público lo que claramente no lo es (localhost, direcciones IP, nombres
 * internos), sin inventar ninguna validación.
 */

export type TipoDominio = "publico" | "interno";

const SUFIJOS_INTERNOS = [".localhost", ".local", ".internal", ".test", ".invalid", ".lan", ".home"];

export function tipoDeDominio(hostname: string): TipoDominio {
  const h = hostname.trim().toLowerCase();
  if (!h) return "interno";
  if (h.includes(":")) return "interno"; // lleva puerto o es IPv6
  if (h === "localhost" || SUFIJOS_INTERNOS.some((s) => h.endsWith(s))) return "interno";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return "interno"; // dirección IPv4
  if (!h.includes(".")) return "interno"; // nombre sin punto: red interna
  return "publico";
}

/** El dominio propio de un negocio frente a un subdominio de la plataforma no se
 *  puede distinguir sin conocer el dominio base, así que no se afirma. */
export function urlDe(hostname: string): string {
  return `https://${hostname}`;
}
