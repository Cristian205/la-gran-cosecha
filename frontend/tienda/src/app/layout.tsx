import type { Metadata } from "next";
import type { BloqueColocado } from "@/lib/tipos";
import { notFound } from "next/navigation";
import { CapaCliente } from "@/componentes/CapaCliente";
import { Footer } from "@/componentes/Footer";
import { Navbar } from "@/componentes/Navbar";
import { Lienzo } from "@/bloques/Lienzo";
import { armazonDeLaTienda } from "@/lib/pagina";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import {
  estiloDeTarjeta,
  fuenteDeGoogle,
  hojaDeTitulos,
  variablesDeAspecto,
  variablesDelTema,
} from "@/lib/tema";
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
  const armazon = await armazonDeLaTienda();

  // Sin negocio en esta dirección no hay tienda que renderizar. Falla cerrado,
  // igual que el backend: es preferible un 404 honesto a una tienda a medias.
  if (!config) notFound();

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
          */}
          {armazon ? (
            <Armazon bloques={armazon.bloques} lugar="cabecera">
              {children}
            </Armazon>
          ) : (
            <>
              <Navbar />
              {children}
              <Footer />
            </>
          )}
        </CapaCliente>
      </body>
    </html>
  );
}


/**
 * Reparte los bloques del armazon alrededor de la pagina.
 *
 * Todo lo que va ANTES del primer bloque de tipo `pie` envuelve por arriba, y
 * el resto por abajo. Se decide por posicion y no por una lista de tipos
 * «de cabecera» para que anadir un aviso sobre el menu —una franja de envios
 * gratis, por ejemplo— sea colocar un bloque, no tocar este archivo.
 */
function Armazon({
  bloques,
  children,
}: {
  bloques: BloqueColocado[];
  lugar?: string;
  children: React.ReactNode;
}) {
  const corte = bloques.findIndex((b) => b.tipo === "pie");
  const arriba = corte === -1 ? bloques : bloques.slice(0, corte);
  const abajo = corte === -1 ? [] : bloques.slice(corte);

  return (
    <>
      <Lienzo bloques={arriba} />
      {children}
      <Lienzo bloques={abajo} />
    </>
  );
}
