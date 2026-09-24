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
  "producto-destacado": "/orders/productos-mas-vendidos/",
  "producto-spotlight": "/orders/productos-mas-vendidos/",
  "testimonios-editorial": "/content/testimonials/",
  // Solo se lee `count`: pedir una fila basta para saber el tamano del catalogo.
  "campana-negocios": "/catalog/products/?page_size=1",
  // La primera tanda del catálogo sin filtrar — exactamente lo que
  // `CatalogoProvider` necesita para sembrar `grid-productos` en modo
  // interactivo sin que el rastreador vea un esqueleto de carga. Un
  // `grid-productos` fuera de una página de catálogo (la vitrina fija de
  // siempre) sencillamente no usa este dato.
  "grid-productos": "/catalog/products/?page_size=24",
  // Sin esto, `CatalogoProvider` sembraba productos y total desde el servidor
  // pero categorías las pedía solo el navegador: la primera pintura —y lo que
  // veía el rastreador— decía "190 productos · 0 categorías" hasta que ese
  // fetch del cliente terminaba. Mismo criterio que el de arriba: la cuenta
  // que se le muestra a alguien no puede depender de si su conexión fue lenta.
  "categorias-navegacion": "/catalog/categories/",
  // Mismo problema, más visible: sin esto, "Compra por categoría" se pintaba
  // vacía en el HTML del servidor y solo aparecía al hidratar, así que un
  // enlace del menú a `#categorias` (su propio ancla) apuntaba a un elemento
  // que todavía no existía cuando el navegador intentaba saltar a él — el
  // clic no hacía nada.
  "categorias-destacadas": "/catalog/categories/",
  // Mismo problema que arriba: sin esto, "Por qué elegirnos" se pintaba
  // vacía en el HTML del servidor (sus beneficios solo llegaban al
  // hidratar), así que un rastreador —o alguien con conexión lenta— veía el
  // salto del resto de la página directamente a la siguiente sección.
  "por-que-elegirnos": "/content/beneficios/",
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


/** La ruta reservada del armazon. Espejo de `Pagina.RUTA_LAYOUT`. */
export const RUTA_LAYOUT = "/_layout";

/**
 * La ruta reservada de la página "no encontrada".
 *
 * Mismo criterio que `RUTA_LAYOUT`: no es una página que se visite por su
 * cuenta, es una composición más —editable desde el panel— que
 * `app/[ruta]/not-found.tsx` pinta cuando una ruta compuesta no existe.
 */
export const RUTA_NO_ENCONTRADA = "/_no-encontrada";

/**
 * La cabecera y el pie de esta tienda.
 *
 * Devuelve `null` si el negocio todavia no tiene armazon compuesto, y ese caso
 * NO es un error: son todas las tiendas creadas antes de que esto existiera. El
 * layout las sigue pintando con la cabecera y el pie de siempre, que es
 * exactamente lo que veian ayer.
 */
export const armazonDeLaTienda = cache(
  async (): Promise<PaginaTienda | null> => composicionDe(RUTA_LAYOUT)
);
