import { headers } from "next/headers";
import { cache } from "react";
import type { SiteConfig } from "./tipos";

/**
 * Qué negocio corresponde a la dirección por la que entró el visitante.
 *
 * Este servidor atiende TODAS las tiendas: `negocio.plataforma.com`,
 * `www.otronegocio.com`, todas. Lo único que las distingue es el `Host` de la
 * petición, así que resolverlo aquí es lo primero que hace cada página.
 *
 * `negocio.plataforma.com` -> slug "negocio". Un dominio propio no lleva el
 * slug en ninguna parte, así que en ese caso lo resuelve el backend por su
 * tabla `Domain`, que es la fuente única de verdad.
 */
const DOMINIO_PLATAFORMA = process.env.DOMINIO_PLATAFORMA ?? "plataforma.com";

export interface Negocio {
  /** El slug, cuando el host es un subdominio de la plataforma. */
  slug: string | null;
  /** El host original, que el backend usa para buscar en `Domain`. */
  host: string;
}

/**
 * El testigo del enlace de prueba, si esta peticion lo trae.
 *
 * Lo pone `proxy.ts` como cabecera a partir de `?vista=` o de su cookie. Vive
 * aqui —junto a la resolucion del negocio— porque es lo mismo: informacion de
 * la peticion que cualquier cosa que se renderice puede necesitar.
 */
export async function testigoDeVista(): Promise<string> {
  const cabeceras = await headers();
  return cabeceras.get("x-crynex-vista") ?? "";
}

export async function negocioDeLaPeticion(): Promise<Negocio> {
  const cabeceras = await headers();
  // `x-forwarded-host` es el que llega detrás de un proxy o de Vercel; `host`
  // sería el del propio contenedor y no el que escribió el visitante.
  const bruto = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "";
  const host = bruto.split(":")[0].toLowerCase();

  const sufijo = `.${DOMINIO_PLATAFORMA}`;
  const slug = host.endsWith(sufijo) ? host.slice(0, -sufijo.length) : null;

  // "www" no es el nombre de ningún negocio: es el sitio comercial de la
  // plataforma, que vive aparte.
  return { slug: slug && slug !== "www" ? slug : null, host };
}

/**
 * La identidad y la apariencia de la tienda: colores, tipografía, contacto,
 * textos. Es lo que convierte el mismo motor en tiendas distintas.
 *
 * `cache()` de React la memoriza durante el renderizado de una petición: el
 * layout, la cabecera y el pie la piden por separado y sin esto serían tres
 * llamadas idénticas al backend por página.
 */
export const configuracionDeLaTienda = cache(
  async (): Promise<SiteConfig | null> => {
    const { pedirAlBackend } = await import("./api");
    return pedirAlBackend<SiteConfig>("/content/site-config/");
  }
);
