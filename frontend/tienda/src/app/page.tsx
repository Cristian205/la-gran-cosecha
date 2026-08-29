import { HomePage } from "@/paginas/HomePage";
import { pedirAlBackend } from "@/lib/api";
import { configuracionDeLaTienda } from "@/lib/negocio";
import type { Metadata } from "next";
import type { Producto } from "@/lib/tipos";

/**
 * El inicio de la tienda.
 *
 * Los productos más vendidos se piden AQUÍ, en el servidor, y se le pasan a la
 * página como propiedades. Es la diferencia con la tienda anterior: el
 * rastreador recibe los productos dentro del HTML en vez de un contenedor
 * vacío que se llena luego, que es lo que hacía imposible posicionar cada
 * tienda por separado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = await configuracionDeLaTienda();
  if (!config) return {};
  return {
    title: config.nombre_empresa || "Inicio",
    description:
      config.mision?.slice(0, 160) ||
      `Haz tu pedido en línea en ${config.nombre_empresa}.`,
  };
}

export default async function Inicio() {
  const destacados =
    (await pedirAlBackend<Producto[]>("/orders/productos-mas-vendidos/")) ?? [];

  return <HomePage destacados={destacados} />;
}
