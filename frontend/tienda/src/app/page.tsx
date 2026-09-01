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
  const titulo = pagina?.seo_titulo || config?.nombre_empresa || "Inicio";
  const descripcion =
    pagina?.seo_descripcion ||
    config?.mision?.slice(0, 160) ||
    (config ? `Haz tu pedido en línea en ${config.nombre_empresa}.` : "");

  return { title: titulo, description: descripcion };
}

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
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
