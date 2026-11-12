import type { SeccionSitio, TipoSeccion } from "../contenido/tipos";
import { Caminos } from "./Caminos";
import { Contacto } from "./Contacto";
import { Experiencias } from "./Experiencias";
import { Hero } from "./Hero";
import { Personalizacion } from "./Personalizacion";
import { Proceso } from "./Proceso";
import { Proyectos } from "./Proyectos";
import { Soluciones } from "./Soluciones";

/**
 * De `tipo` a componente. Mismo patrón que `bloques/registro.tsx` en la
 * tienda: la página es una lista de datos y esto la convierte en pantalla.
 * Una escena nueva es una entrada aquí y un caso en `SeccionSitio`.
 */
type Componentes = {
  [T in TipoSeccion]: (props: {
    datos: Extract<SeccionSitio, { tipo: T }>["datos"];
    id: string;
  }) => JSX.Element | null;
};

const COMPONENTES: Componentes = {
  hero: Hero,
  caminos: Caminos,
  experiencias: Experiencias,
  personalizacion: Personalizacion,
  proyectos: Proyectos,
  proceso: Proceso,
  soluciones: Soluciones,
  contacto: Contacto,
};

export function RenderSeccion({ seccion }: { seccion: SeccionSitio }) {
  const Componente = COMPONENTES[seccion.tipo] as Componentes[TipoSeccion] as (props: {
    datos: SeccionSitio["datos"];
    id: string;
  }) => JSX.Element | null;
  return <Componente datos={seccion.datos} id={seccion.id} />;
}
