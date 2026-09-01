import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapaCliente } from "@/componentes/CapaCliente";
import { Footer } from "@/componentes/Footer";
import { Navbar } from "@/componentes/Navbar";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import { fuenteDeGoogle, variablesDelTema } from "@/lib/tema";
import "./global.css";

/**
 * Los metadatos salen de la configuración del negocio, no del código.
 *
 * Es lo que hace que cada tienda se posicione por separado: el rastreador
 * recibe el título y la descripción de ESE negocio dentro del HTML, no un
 * título fijo que se cambia después con JavaScript y que nadie llega a leer.
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = await configuracionDeLaTienda();
  const { host } = await negocioDeLaPeticion();

  if (!config) return { title: "Tienda no encontrada" };

  const nombre = config.nombre_empresa || "Tienda en línea";
  const descripcion =
    config.mision?.slice(0, 160) ||
    `Catálogo y pedidos en línea de ${nombre}.`;

  return {
    metadataBase: new URL(`https://${host}`),
    title: { default: nombre, template: `%s · ${nombre}` },
    description: descripcion,
    openGraph: {
      title: nombre,
      description: descripcion,
      type: "website",
      siteName: nombre,
      ...(config.logo_url ? { images: [config.logo_url] } : {}),
    },
    alternates: { canonical: "/" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await configuracionDeLaTienda();

  // Sin negocio en esta dirección no hay tienda que renderizar. Falla cerrado,
  // igual que el backend: es preferible un 404 honesto a una tienda a medias.
  if (!config) notFound();

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fuenteDeGoogle(config)} />
        {/* El tema va en el HTML, no en un efecto del cliente: si no, la
            página se pintaría con el color por defecto y se reteñiría al
            hidratar. Con una tienda por negocio ese parpadeo mostraría la
            identidad equivocada durante medio segundo. */}
        <style dangerouslySetInnerHTML={{ __html: variablesDelTema(config) }} />
      </head>
      <body>
        <CapaCliente config={config}>
          <Navbar />
          {children}
          <Footer />
        </CapaCliente>
      </body>
    </html>
  );
}
