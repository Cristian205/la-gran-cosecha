import { cache } from "react";
import { pedirAlBackend } from "./api";
import type { PaginaTienda } from "./tipos";

/**
 * La composición de una ruta de la tienda, resuelta en el SERVIDOR.
 *
 * Es la petición que decide el HTML: qué bloques lleva la página, en qué orden
 * y con qué textos. Tiene que ocurrir aquí y no en el navegador por la misma
 * razón que el tema — si la composición llegara después, el rastreador vería
 * una página vacía y se perdería el posicionamiento que cada tienda tiene
 * ganado por separado.
 *
 * `cache()` la memoriza durante el renderizado de una petición: la página la
 * pide para pintarse y `generateMetadata` para el título, y sin esto serían
 * dos llamadas idénticas al backend.
 */
export const composicionDe = cache(
  async (ruta: string): Promise<PaginaTienda | null> =>
    pedirAlBackend<PaginaTienda>(
      `/storefront/pagina/?ruta=${encodeURIComponent(ruta)}`
    )
);

/**
 * Los bloques que necesitan datos del servidor antes de pintarse.
 *
 * El catálogo declara cuáles son (`requiere_datos`), pero resolverlos es
 * trabajo del frontend porque solo él sabe qué endpoint le toca a cada uno.
 * Este mapa es ese puente, y se queda corto a propósito: un bloque que no
 * aparezca aquí sencillamente se pinta sin datos previos y los pide al
 * hidratar, que es lo que ya hacían todos antes del motor.
 */
export const RESUELVE_EN_SERVIDOR: Record<string, string> = {
  "productos-destacados": "/orders/productos-mas-vendidos/",
};

/**
 * Pide en paralelo los datos de los bloques que los necesiten.
 *
 * Devuelve un mapa por id de bloque —y no por tipo— porque una página puede
 * llevar dos rejillas de productos con límites distintos, y mezclar sus datos
 * sería el tipo de error que solo se ve en producción.
 */
export async function datosDeLosBloques(
  pagina: PaginaTienda | null
): Promise<Record<string, unknown>> {
  if (!pagina) return {};

  const pendientes = pagina.bloques
    .filter((b) => RESUELVE_EN_SERVIDOR[b.tipo])
    .map(async (bloque) => {
      const datos = await pedirAlBackend<unknown>(RESUELVE_EN_SERVIDOR[bloque.tipo]);
      return [bloque.id, datos ?? null] as const;
    });

  return Object.fromEntries(await Promise.all(pendientes));
}
