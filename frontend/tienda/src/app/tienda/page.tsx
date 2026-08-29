import type { Metadata } from "next";
import { StorePage } from "@/paginas/StorePage";
import { pedirAlBackend } from "@/lib/api";
import { configuracionDeLaTienda } from "@/lib/negocio";
import type { Categoria, Paginated, Producto } from "@/lib/tipos";

export async function generateMetadata(): Promise<Metadata> {
  const config = await configuracionDeLaTienda();
  return {
    title: "Catálogo",
    description: `Explora el catálogo completo de ${
      config?.nombre_empresa ?? "la tienda"
    } y arma tu pedido en minutos.`,
    alternates: { canonical: "/tienda" },
  };
}

/**
 * El catálogo.
 *
 * La primera tanda de productos y las categorías se resuelven en el servidor:
 * son el contenido que tiene que estar indexado. A partir de ahí, filtrar,
 * buscar y paginar ocurre en el navegador sin recargar.
 */
export default async function Tienda() {
  const [pagina, categorias] = await Promise.all([
    pedirAlBackend<Paginated<Producto>>("/catalog/products/", {
      params: { page_size: 24 },
    }),
    pedirAlBackend<Paginated<Categoria> | Categoria[]>("/catalog/categories/"),
  ]);

  return (
    <StorePage
      productosIniciales={pagina?.results ?? []}
      totalInicial={pagina?.count ?? 0}
      categoriasIniciales={
        Array.isArray(categorias) ? categorias : (categorias?.results ?? [])
      }
    />
  );
}
