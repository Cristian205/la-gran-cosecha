import type { MetadataRoute } from "next";
import { configuracionDeLaTienda } from "@/lib/negocio";
import { colorDeMarca, esHexValido } from "@/lib/tema";

/**
 * El manifiesto de la app instalable de ESTE negocio.
 *
 * Es lo que permite que el cliente «instale» la tienda desde el navegador
 * (Chrome/Edge en Android y en PC; Safari en iPhone con «Añadir a pantalla de
 * inicio») y la abra después desde un ícono, a pantalla completa, sin barra de
 * direcciones ni tener que volver a escribir el enlace.
 *
 * Igual que `robots.ts`, sale por host: con un servidor para todas las tiendas,
 * un manifiesto fijo instalaría la misma app —nombre, ícono y color— para todos
 * los negocios.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await configuracionDeLaTienda();
  const nombre = config?.nombre_empresa?.trim() || "Tienda en línea";
  const fondo = esHexValido(config?.color_fondo) ? config.color_fondo : "#ffffff";
  const tema = colorDeMarca(config);

  return {
    // El `id` fija la identidad de la app: si algún día cambia `start_url`, el
    // navegador la sigue reconociendo como la misma instalación.
    id: "/",
    name: nombre,
    // Es el nombre bajo el ícono: si no cabe, el propio sistema lo recorta.
    // Cortarlo aquí por palabras dejaba cosas como «La».
    short_name: nombre,
    description:
      config?.mision?.slice(0, 160) || `Catálogo y pedidos en línea de ${nombre}.`,
    lang: "es",
    start_url: "/?origen=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: fondo,
    theme_color: tema,
    categories: ["shopping", "food"],
    icons: [
      { src: "/icono-app/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-app/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-app/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos directos al mantener pulsado el ícono (Android) o con clic
    // derecho (PC): lo que un cliente que repite pedido busca primero.
    shortcuts: [
      { name: "Catálogo", url: "/tienda", icons: [{ src: "/icono-app/192", sizes: "192x192" }] },
      { name: "Mis pedidos", url: "/tienda/mis-pedidos", icons: [{ src: "/icono-app/192", sizes: "192x192" }] },
    ],
  };
}
