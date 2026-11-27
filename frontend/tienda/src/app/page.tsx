import { notFound } from "next/navigation";
import { CapaEditor } from "@/bloques/CapaEditor";
import { Lienzo } from "@/bloques/Lienzo";
import { composicionDe, datosDeLosBloques } from "@/lib/pagina";
import { configuracionDeLaTienda } from "@/lib/negocio";
import type { Metadata } from "next";

/**
 * El inicio de la tienda.
 *
 * Ya no compone nada: pide la composición de «/» y la pinta. El orden de las
 * secciones, sus textos y qué bloques lleva son datos del negocio, así que una
 * frutería y una perfumería llegan aquí y salen distintas sin que este archivo
 * sepa cuál es cuál.
 *
 * Lo que NO cambia es dónde se resuelven los datos: los bloques que necesitan
 * contenido del catálogo se piden aquí, en el servidor, y bajan al lienzo ya
 * resueltos. Es lo que hace que el rastreador reciba los productos dentro del
 * HTML, que es la razón de que esta tienda esté en Next y no en Vite.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [config, pagina] = await Promise.all([
    configuracionDeLaTienda(),
    composicionDe("/"),
  ]);

  // El SEO de la página manda sobre el del negocio: es lo específico frente a
  // lo general, y es lo que el administrador escribió pensando en esta ruta.
  const nombre = config?.nombre_empresa?.trim() ?? "";
  const propio = pagina?.seo_titulo?.trim() || nombre || "Inicio";
  // La plantilla « · <negocio>» del layout NO se aplica a esta página: Next
  // solo la usa en los segmentos hijos, y el inicio es el mismo segmento que el
  // layout. Por eso Google veía «Frutas y verduras frescas para tu mesa y tu
  // negocio» sin la marca. Se añade aquí, salvo que el título ya la lleve.
  const titulo =
    nombre && !propio.toLowerCase().includes(nombre.toLowerCase()) ? `${propio} | ${nombre}` : propio;
  const descripcion =
    pagina?.seo_descripcion ||
    config?.mision?.slice(0, 160) ||
    (config ? `Haz tu pedido en línea en ${config.nombre_empresa}.` : "");

  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: "/" },
  };
}

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;

  // El 404 por «esta dirección no es de ninguna tienda» se pide AQUí y no en el
  // layout raíz, que no puede abortar. Así el estado 404 sale de verdad y se
  // pinta `not-found.tsx`. Dentro del editor no: ahí la capa se monta vacía y
  // espera lo que mande el panel.
  const config = await configuracionDeLaTienda();
  if (!config && parametros.editor !== "1") notFound();

  const pagina = await composicionDe("/");
  const datos = await datosDeLosBloques(pagina);
  const bloques = pagina?.bloques ?? [];

  // Dentro del editor la página la gobierna el panel: se monta la capa que
  // escucha sus mensajes y repinta sin recargar. Fuera, ni se carga.
  if (parametros.editor === "1") {
    return (
      <div>
        <CapaEditor
          inicial={bloques}
          datos={datos}
          origenPanel={process.env.NEXT_PUBLIC_PANEL_URL ?? ""}
        />
      </div>
    );
  }

  return (
    <div>
      <Lienzo bloques={bloques} datos={datos} />
    </div>
  );
}
