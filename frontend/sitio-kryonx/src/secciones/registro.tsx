import type { SeccionSitio, TipoSeccion } from "../contenido/tipos";
import { Beneficios } from "./Beneficios";
import { Campanas } from "./Campanas";
import { Constructor } from "./Constructor";
import { Conversion } from "./Conversion";
import { Demostraciones } from "./Demostraciones";
import { Hero } from "./Hero";
import { Tiendas } from "./Tiendas";

/**
 * De `tipo` a componente. Mismo patrón que `bloques/registro.tsx` en la
 * tienda: la página es una lista de datos y esto la convierte en pantalla.
 * Una sección nueva es una entrada aquí y un caso en `SeccionSitio`.
 */
type Componentes = {
  [T in TipoSeccion]: (props: {
    datos: Extract<SeccionSitio, { tipo: T }>["datos"];
    id: string;
  }) => JSX.Element | null;
};

const COMPONENTES: Componentes = {
  hero: Hero,
  demostraciones: Demostraciones,
  constructor: Constructor,
  campanas: Campanas,
  tiendas: Tiendas,
  beneficios: Beneficios,
  conversion: Conversion,
};

export function RenderSeccion({ seccion }: { seccion: SeccionSitio }) {
  const Componente = COMPONENTES[seccion.tipo] as Componentes[TipoSeccion] as (props: {
    datos: SeccionSitio["datos"];
    id: string;
  }) => JSX.Element | null;
  return <Componente datos={seccion.datos} id={seccion.id} />;
}
