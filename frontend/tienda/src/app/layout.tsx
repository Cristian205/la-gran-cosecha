import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArmazonPrevia } from "@/componentes/ArmazonPrevia";
import { CapaCliente } from "@/componentes/CapaCliente";
import { armazonDeLaTienda } from "@/lib/pagina";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import { datosEstructuradosDelNegocio } from "@/lib/jsonld";
import {
  estiloDeTarjeta,
  fuenteDeGoogle,
  hojaDeTitulos,
  variablesDeAspecto,
  variablesDelTema,
} from "@/lib/tema";
import "./global.css";
import "./campanas.css";
import "./nosotros.css";
import "./contacto.css";

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
  const armazon = await armazonDeLaTienda();

  // Sin negocio en esta dirección no hay tienda que renderizar. Falla cerrado,
  // igual que el backend: es preferible un 404 honesto a una tienda a medias.
  if (!config) notFound();

  const { host } = await negocioDeLaPeticion();
  const jsonLd = datosEstructuradosDelNegocio(config, host);

  // En la vista de prueba manda lo que propone la plantilla, encima del tema
  // del negocio. Va DESPUES en la hoja, que es como gana en CSS.
  const previa = armazon?.aspecto;
  const reglasDeLaPrevia = previa
    ? Object.entries(variablesDeAspecto(previa.marca, previa.tokens))
        .map(([variable, valor]) => `${variable}:${valor}`)
        .join(";")
    : "";
  const serifDeLaPrevia = previa
    ? hojaDeTitulos((previa.tokens["--fuente-titulos"] ?? "").trim())
    : null;

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
        {/* La tipografia de la plantilla hay que CARGARLA, no solo nombrarla:
            la etiqueta de arriba trae la del negocio, que en una previa no es
            la que se esta juzgando. */}
        {serifDeLaPrevia && <link rel="stylesheet" href={serifDeLaPrevia} />}
        {reglasDeLaPrevia && (
          <style dangerouslySetInnerHTML={{ __html: `:root{${reglasDeLaPrevia}}` }} />
        )}
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </head>
      <body
        data-tarjeta={
          previa?.tokens["--estilo-tarjeta"]?.trim() || estiloDeTarjeta(config)
        }
      >
        <CapaCliente config={config}>
          {/*
            La cabecera y el pie salen de la composicion de `/_layout`, con sus
            textos, sus enlaces y su visibilidad por dispositivo — el mismo
            motor que el resto de la pagina, no un caso aparte.

            Sin armazon compuesto se pintan los de siempre. Ese respaldo no es
            provisional: es lo que hace que las tiendas creadas antes de que
            esto existiera sigan viendose igual sin que nadie las migre.

            `ArmazonPrevia` es quien decide esto en produccion (aqui no cambia
            nada); dentro del taller de plantillas, ademas escucha lo que esa
            plantilla propone para su propio armazon. Ver el comentario en ese
            archivo.
          */}
          <ArmazonPrevia
            inicial={armazon?.bloques ?? []}
            origenPanel={process.env.NEXT_PUBLIC_PANEL_URL ?? ""}
          >
            {children}
          </ArmazonPrevia>
        </CapaCliente>
      </body>
    </html>
  );
}
