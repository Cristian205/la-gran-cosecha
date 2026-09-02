import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lienzo } from "@/bloques/Lienzo";
import { composicionDe, datosDeLosBloques, RUTA_LAYOUT } from "@/lib/pagina";
import { configuracionDeLaTienda } from "@/lib/negocio";

/**
 * Cualquier página que el negocio haya compuesto.
 *
 * Cierra un agujero que llevaba abierto desde la fase 7: el constructor deja
 * crear rutas nuevas —`/entrar`, `/mayoristas`, `/preguntas`— y el backend las
 * publica y las lista en `/storefront/rutas/`, pero Next solo tenía tres
 * páginas escritas a mano. Todo lo que un negocio creara fuera de esas tres
 * daba 404 sin que nada lo avisara: en el panel la página existía, estaba
 * publicada y se veía en la vista previa.
 *
 * Next prefiere los segmentos fijos sobre los dinámicos, así que `/tienda`,
 * `/nosotros` y `/contacto` siguen entrando por sus archivos: esta ruta solo
 * recoge lo que no tiene página propia. Eso importa porque esas tres tienen
 * respaldo —se pintan aunque el negocio no las haya compuesto— y aquí no lo
 * hay: sin composición no hay página que enseñar.
 *
 * Se sirve bajo demanda y no se genera estáticamente. No es una omisión: las
 * rutas dependen del HOST —una instancia sirve todas las tiendas—, así que en
 * tiempo de compilación no se sabe de qué negocio se están pidiendo.
 */
interface Props {
  params: Promise<{ ruta: string }>;
}

/** Las rutas que existen pero no son páginas que se visiten. */
function esReservada(ruta: string): boolean {
  // El armazón se pinta ALREDEDOR de las demás; servirlo como página daría una
  // cabecera y un pie sueltos, y el buscador acabaría indexándolos. El backend
  // ya lo excluye del listado, y esto es la segunda vuelta de la misma llave.
  return ruta === RUTA_LAYOUT || ruta.startsWith("/_");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ruta } = await params;
  const camino = `/${ruta}`;
  if (esReservada(camino)) return {};

  const [pagina, config] = await Promise.all([
    composicionDe(camino),
    configuracionDeLaTienda(),
  ]);
  if (!pagina) return {};

  return {
    title: pagina.seo_titulo || pagina.titulo || undefined,
    description:
      pagina.seo_descripcion ||
      `${pagina.titulo} · ${config?.nombre_empresa ?? ""}`.trim(),
    alternates: { canonical: camino },
  };
}

export default async function PaginaCompuesta({ params }: Props) {
  const { ruta } = await params;
  const camino = `/${ruta}`;
  if (esReservada(camino)) notFound();

  const pagina = await composicionDe(camino);
  if (!pagina || pagina.bloques.length === 0) notFound();

  const datos = await datosDeLosBloques(pagina);
  return <Lienzo bloques={pagina.bloques} datos={datos} />;
}
