import { createContext, useContext, type ReactNode } from "react";
import { contenidoPorDefecto } from "./porDefecto";
import type { ContenidoSitio, TemaTienda } from "./tipos";

/**
 * El único punto por el que la página lee su contenido.
 *
 * Hoy sirve el contenido por defecto. Para administrarlo desde el panel basta
 * con que el proveedor lo pida al backend y caiga a `contenidoPorDefecto`
 * mientras carga o si falla: ninguna sección sabe de dónde vienen sus datos.
 */
const Contexto = createContext<ContenidoSitio>(contenidoPorDefecto);

export function ProveedorContenido({
  contenido = contenidoPorDefecto,
  children,
}: {
  contenido?: ContenidoSitio;
  children: ReactNode;
}) {
  return <Contexto.Provider value={contenido}>{children}</Contexto.Provider>;
}

export function usarContenido(): ContenidoSitio {
  return useContext(Contexto);
}

/**
 * Las identidades que una sección cita por id, en ese orden. Un id que no
 * existe se descarta en vez de romper: en un contenido administrable, borrar
 * un tema no debería tumbar la sección que lo usaba.
 */
export function usarTemas(ids: string[]): TemaTienda[] {
  const { temas } = usarContenido();
  return ids
    .map((id) => temas.find((tema) => tema.id === id))
    .filter((tema): tema is TemaTienda => Boolean(tema));
}

export function usarTema(id: string): TemaTienda {
  const { temas } = usarContenido();
  return temas.find((tema) => tema.id === id) ?? temas[0];
}
