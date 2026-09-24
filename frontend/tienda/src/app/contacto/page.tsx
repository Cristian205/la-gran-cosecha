import type { Metadata } from "next";
import { Lienzo } from "@/bloques/Lienzo";
import { composicionDe, datosDeLosBloques } from "@/lib/pagina";
import { ContactPage } from "@/paginas/ContactPage";
import { configuracionDeLaTienda } from "@/lib/negocio";

export async function generateMetadata(): Promise<Metadata> {
  // `composicionDe` está memorizada por petición: la página la vuelve a pedir
  // para pintarse sin una segunda llamada al backend.
  const [config, pagina] = await Promise.all([configuracionDeLaTienda(), composicionDe("/contacto")]);
  return {
    title: pagina?.seo_titulo || "Contacto",
    description:
      pagina?.seo_descripcion ||
      `Escríbenos o llámanos: ${config?.telefono || config?.email || config?.nombre_empresa || ""}`.trim(),
    alternates: { canonical: "/contacto" },
  };
}

export default async function Contacto() {
  // Si el negocio compuso esta ruta, manda su composicion. Si no, se pinta la
  // pagina de siempre.
  //
  // El respaldo no es provisional: las tiendas que ya existian no tienen
  // composicion para «/contacto», y quitarles la pagina por estrenar el motor
  // seria romperles el sitio para ganar coherencia interna.
  const pagina = await composicionDe("/contacto");
  if (!pagina || pagina.bloques.length === 0) return <ContactPage />;

  const datos = await datosDeLosBloques(pagina);
  return <Lienzo bloques={pagina.bloques} datos={datos} />;
}
