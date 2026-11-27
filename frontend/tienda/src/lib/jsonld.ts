import type { SiteConfig } from "./tipos";

/**
 * Los datos estructurados (schema.org) de ESTE negocio.
 *
 * Solo con lo que `SiteConfig` de verdad trae — nada de horarios inventados
 * ni direcciones supuestas. Un campo vacío simplemente no entra al objeto: es
 * preferible un LocalBusiness incompleto a uno con datos que nadie confirmó.
 *
 * `addressCountry: "CO"` es la única excepción, y no es un dato inventado:
 * toda la plataforma es para negocios colombianos (el propio `ciudad` ya trae
 * el departamento, p. ej. "Soacha, Cundinamarca"), así que es un hecho
 * estructural del producto, no un supuesto sobre ESTE negocio en particular.
 */
export function datosEstructuradosDelNegocio(
  config: SiteConfig,
  host: string
): Record<string, unknown> | null {
  if (!config.nombre_empresa) return null;

  const base = `https://${host}`;
  const redes = [config.instagram_url, config.facebook_url, config.tiktok_url].filter(
    (url): url is string => Boolean(url)
  );

  const direccion =
    config.direccion || config.ciudad
      ? {
          "@type": "PostalAddress",
          ...(config.direccion ? { streetAddress: config.direccion } : {}),
          ...(config.ciudad ? { addressLocality: config.ciudad } : {}),
          addressCountry: "CO",
        }
      : undefined;

  // Un solo bloque con dos nodos enlazados por `@id`, en vez de esquemas
  // sueltos: la ficha de producto declara su vendedor como
  // `{"@id": ".../#negocio"}` y Google lo une con este, sin repetir el negocio
  // entero en cada página ni arriesgar dos versiones que no coinciden.
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#sitio`,
        url: base,
        name: config.nombre_empresa,
        inLanguage: "es-CO",
        publisher: { "@id": `${base}/#negocio` },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${base}/#negocio`,
        name: config.nombre_empresa,
        url: base,
        ...(config.logo_url ? { logo: config.logo_url, image: config.logo_url } : {}),
        ...(config.telefono ? { telephone: config.telefono } : {}),
        ...(config.email ? { email: config.email } : {}),
        ...(direccion ? { address: direccion } : {}),
        ...(redes.length ? { sameAs: redes } : {}),
      },
    ],
  };
}
