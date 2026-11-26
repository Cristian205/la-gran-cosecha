import type { Metadata, Viewport } from "next";
import { ArmazonPrevia } from "@/componentes/ArmazonPrevia";
import { CapaCliente } from "@/componentes/CapaCliente";
import { armazonDeLaTienda } from "@/lib/pagina";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import { datosEstructuradosDelNegocio } from "@/lib/jsonld";
import {
  colorDeMarca,
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
import "./legal.css";
import "./arranque.css";
import { PantallaArranque, SCRIPT_DECIDIR_ARRANQUE } from "@/componentes/PantallaArranque";

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
    // El ícono de la pestaña, el de la app instalada y el de iOS son el logo
    // del negocio, generado en `/icono-app`: cuadrado y en PNG, porque el logo
    // tal cual puede venir en WebP o apaisado. Con una tienda por negocio, un
    // ícono fijo en el código pondría la misma marca en la pestaña de todas.
    icons: {
      icon: [{ url: "/icono-app/192", type: "image/png", sizes: "192x192" }],
      shortcut: "/icono-app/192",
      apple: "/icono-app/180",
    },
    // Abierta desde el ícono del iPhone, a pantalla completa como una app.
    appleWebApp: { capable: true, title: nombre, statusBarStyle: "default" },
    alternates: { canonical: "/" },
  };
}

/** El color de la barra del sistema (Android) y de la ventana de la app: el de la marca. */
export async function generateViewport(): Promise<Viewport> {
  const config = await configuracionDeLaTienda();
  return config ? { themeColor: colorDeMarca(config) } : {};
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await configuracionDeLaTienda();
  const armazon = await armazonDeLaTienda();

  // Sin negocio en esta dirección no hay tienda que renderizar, pero el 404 NO
  // se puede pedir desde aquí: un layout raíz no puede abortar —Next lo
  // rechaza con «notFound() is not allowed to use in root layout»— y el
  // intento se ve como un error de render en vez de como la página de «esta
  // tienda no existe».
  //
  // Así que este armazón se queda en lo mínimo imprescindible y deja que la
  // página decida: `page.tsx` llama a `notFound()`, el estado 404 sale de
  // verdad y `not-found.tsx` se pinta aquí dentro. Tampoco se puede seguir
  // adelante sin `config`: el tema, la fuente y el armazón salen de ella.
  if (!config) {
    return (
      <html lang="es">
        <body>{children}</body>
      </html>
    );
  }

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
    // `suppressHydrationWarning`: el script de la pantalla de carga pone
    // `data-arranque` en <html> antes de hidratar (solo cubre esta etiqueta).
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Antes que nada: si es la app instalada, la pantalla de carga se
            decide aquí, antes del primer pintado (ver PantallaArranque). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DECIDIR_ARRANQUE }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Las fuentes NO bloquean el primer pintado: la hoja entra con
            `media="print"` (el navegador la baja igual, pero sin frenar el
            renderizado) y un script mínimo la pasa a `all` al terminar. Con
            `display=swap` el texto sale primero con la fuente de respaldo.
            Sin JavaScript, el `<noscript>` la carga de la forma normal. */}
        <link
          rel="stylesheet"
          href={fuenteDeGoogle(config)}
          media="print"
          data-fuente=""
          suppressHydrationWarning
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.querySelectorAll('link[data-fuente]').forEach(function(l){function a(){l.media='all'}l.sheet?a():l.addEventListener('load',a)})",
          }}
        />
        <noscript>
          <link rel="stylesheet" href={fuenteDeGoogle(config)} />
        </noscript>
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
        <PantallaArranque nombre={config.nombre_empresa || "Tienda en línea"} logoUrl={config.logo_url} />
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
