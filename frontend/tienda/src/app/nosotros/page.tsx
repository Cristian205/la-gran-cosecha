import type { Metadata } from "next";
import { Lienzo } from "@/bloques/Lienzo";
import { composicionDe, datosDeLosBloques } from "@/lib/pagina";
import { AboutPage } from "@/paginas/AboutPage";
import { configuracionDeLaTienda } from "@/lib/negocio";

export async function generateMetadata(): Promise<Metadata> {
  // `composicionDe` está memorizada por petición: la página la vuelve a pedir
  // para pintarse sin una segunda llamada al backend.
  const [config, pagina] = await Promise.all([configuracionDeLaTienda(), composicionDe("/nosotros")]);
  return {
    title: pagina?.seo_titulo || "Nosotros",
    description:
      pagina?.seo_descripcion ||
      config?.historia?.slice(0, 160) ||
      `Conoce ${config?.nombre_empresa ?? "el negocio"} y cómo trabajamos.`,
    alternates: { canonical: "/nosotros" },
  };
}

export default async function Nosotros() {
  // Si el negocio compuso esta ruta, manda su composicion. Si no, se pinta la
  // pagina de siempre.
  //
  // El respaldo no es provisional: las tiendas que ya existian no tienen
  // composicion para «/nosotros», y quitarles la pagina por estrenar el motor
  // seria romperles el sitio para ganar coherencia interna.
  const pagina = await composicionDe("/nosotros");
  if (!pagina || pagina.bloques.length === 0) return <AboutPage />;

  const datos = await datosDeLosBloques(pagina);
  return <Lienzo bloques={pagina.bloques} datos={datos} />;
}
