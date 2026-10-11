import type { Metadata } from "next";
import { cache } from "react";
import { pedirAlBackend } from "@/lib/api";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import { resolverDatos, textoPlano } from "./datos";
import { POLITICAS } from "./politicas";
import type { DatosLegales, LegalGuardado, Politica, PoliticaEditable } from "./tipos";

export interface CentroLegal {
  datos: DatosLegales;
  politicas: Politica[];
}

/**
 * Lo que el negocio reescribió encima del texto por defecto. Campo a campo:
 * se puede cambiar solo el resumen, o solo la fecha, sin copiar la política
 * entera. Unas secciones vacías no borran el texto: sería publicar una
 * política en blanco por un descuido en el panel.
 */
function combinar(base: Politica, propia: Partial<PoliticaEditable> | undefined): Politica {
  if (!propia) return base;
  return {
    ...base,
    titulo: propia.titulo?.trim() || base.titulo,
    resumen: propia.resumen?.trim() || base.resumen,
    secciones: propia.secciones?.length ? propia.secciones : base.secciones,
    actualizado: propia.actualizado || base.actualizado,
    historial: propia.historial ?? base.historial,
  };
}

/**
 * El centro legal de la tienda de esta petición. Memorizado por petición: la
 * página y sus metadatos lo piden por separado.
 *
 * Si el backend todavía no tiene el endpoint (o falla), se sirven los textos
 * por defecto con los datos de la configuración: una política sin los datos
 * del panel es mejor que una página legal caída.
 */
export const centroLegal = cache(async (): Promise<CentroLegal | null> => {
  const [config, guardado, { host }] = await Promise.all([
    configuracionDeLaTienda(),
    pedirAlBackend<LegalGuardado>("/content/legal/").catch(() => null),
    negocioDeLaPeticion(),
  ]);
  if (!config) return null;

  return {
    datos: resolverDatos(config, guardado, host),
    politicas: POLITICAS.map((p) => combinar(p, guardado?.politicas?.[p.slug])),
  };
});

export async function metadatosDePolitica(slug: string): Promise<Metadata> {
  const centro = await centroLegal();
  const politica = centro?.politicas.find((p) => p.slug === slug);
  if (!centro || !politica) return {};
  return {
    title: politica.titulo,
    description: textoPlano(politica.resumen, centro.datos).slice(0, 160),
    alternates: { canonical: `/${slug}` },
  };
}
