import type { Metadata } from "next";
import { CapaEditor } from "@/bloques/CapaEditor";
import { Lienzo } from "@/bloques/Lienzo";
import { composicionDe, datosDeLosBloques } from "@/lib/pagina";
import { configuracionDeLaTienda } from "@/lib/negocio";
import { CatalogoProvider } from "@/contextos/CatalogoContexto";
import type { Paginated, Producto } from "@/lib/tipos";

/**
 * El catálogo.
 *
 * Igual que el Inicio: no compone nada, pide la composición de "/tienda" y la
 * pinta. Lo único propio de esta ruta es `CatalogoProvider`, envuelto
 * alrededor del lienzo — es el canal que coordina entre sí a los bloques de
 * catálogo (`categorias-navegacion`, `catalogo-toolbar`, `grid-productos` en
 * modo interactivo), ver `contextos/CatalogoContexto.tsx`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [config, pagina] = await Promise.all([
    configuracionDeLaTienda(),
    composicionDe("/tienda"),
  ]);

  const titulo = pagina?.seo_titulo || "Catálogo";
  const descripcion =
    pagina?.seo_descripcion ||
    `Explora el catálogo completo de ${
      config?.nombre_empresa ?? "la tienda"
    } y arma tu pedido en minutos.`;

  return { title: titulo, description: descripcion, alternates: { canonical: "/tienda" } };
}

export default async function Tienda({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const pagina = await composicionDe("/tienda");
  const datos = await datosDeLosBloques(pagina);
  const bloques = pagina?.bloques ?? [];

  // La primera tanda del catálogo, ya resuelta por el servidor: es lo que
  // siembra `CatalogoProvider` para que el rastreador no vea un esqueleto de
  // carga. Se busca por TIPO y no por un id fijo porque la composición decide
  // cuál bloque es "el" grid del catálogo, no este archivo.
  const bloqueGrid = bloques.find((b) => b.tipo === "grid-productos");
  const datosIniciales = bloqueGrid
    ? (datos[bloqueGrid.id] as Paginated<Producto> | undefined)
    : undefined;

  if (parametros.editor === "1") {
    return (
      <CatalogoProvider datosIniciales={datosIniciales}>
        <CapaEditor
          inicial={bloques}
          datos={datos}
          origenPanel={process.env.NEXT_PUBLIC_PANEL_URL ?? ""}
        />
      </CatalogoProvider>
    );
  }

  return (
    <CatalogoProvider datosIniciales={datosIniciales}>
      <Lienzo bloques={bloques} datos={datos} />
    </CatalogoProvider>
  );
}
