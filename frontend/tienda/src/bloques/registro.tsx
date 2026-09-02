import type { ComponentType } from "react";

import { CategoriasDestacadas } from "@/componentes/CategoriasDestacadas";
import { Footer } from "@/componentes/Footer";
import { CotizacionRapida } from "@/componentes/CotizacionRapida";
import { EstadisticasConfianza } from "@/componentes/EstadisticasConfianza";
import { MasVendidos } from "@/componentes/MasVendidos";
import { Navbar } from "@/componentes/Navbar";
import { OfertasSemana } from "@/componentes/OfertasSemana";
import { PorQueElegirnos } from "@/componentes/PorQueElegirnos";
import { PromoCarousel } from "@/componentes/PromoCarousel";
import { RepetirPedido } from "@/componentes/RepetirPedido";
import { Testimonials } from "@/componentes/Testimonials";
import { TrustBadges } from "@/componentes/TrustBadges";
import { Acceso } from "./Acceso";
import { BarraCategorias } from "./BarraCategorias";
import { ComoFunciona } from "./ComoFunciona";
import { Portada } from "./Portada";
import { PublicosObjetivo } from "./PublicosObjetivo";
import { CtaBanda } from "./CtaBanda";

/**
 * El registro: qué componente pinta cada bloque.
 *
 * Es la frontera del motor y conviene entender por qué está en código y no en
 * la base de datos. El JSON de una página NOMBRA bloques; no los define. Django
 * guarda `"tipo": "testimonios"` y aquí se decide que eso es `<Testimonials/>`.
 *
 * La alternativa —guardar marcado o estilos en la base— haría imposible
 * rediseñar la tienda: cada mejora habría que aplicarla a mano en cada cliente
 * en vez de desplegarla una vez. Con este mapa, mejorar `<Testimonials/>`
 * mejora la sección en las mil tiendas que la tengan puesta.
 *
 * Un `tipo` que no esté aquí no pinta nada y el lienzo sigue. Eso es
 * deliberado: el catálogo del backend y este mapa se despliegan por separado,
 * así que durante unos minutos pueden no coincidir, y una tienda no puede
 * caerse por eso.
 */

/** Lo que recibe cualquier bloque, además de sus propias propiedades. */
export interface PropsDeBloque {
  /** Los datos que el servidor resolvió para él, si los pidió. */
  datos?: unknown;
  /** El aspecto elegido en el constructor. */
  variante?: string;
}

/**
 * El tipo de un bloque en el registro.
 *
 * Es `any` a propósito y acotado a esta línea. El registro despacha
 * componentes heterogéneos —cada bloque tiene sus propias propiedades— y su
 * trabajo es repartir, no conocerlas. Quien las conoce es el propio
 * componente, y quien valida que cuadren es el `esquema_props` del backend.
 *
 * La alternativa sería una unión de todas las firmas, que habría que tocar por
 * cada bloque nuevo y que aun así no podría comprobar nada: el `tipo` llega
 * como cadena desde la base de datos, así que la correspondencia no es
 * verificable en tiempo de compilación por mucho que se escriba.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bloque = ComponentType<any>;

const REGISTRO: Record<string, Bloque> = {
  // El armazon. Van en la composicion de `/_layout`, no en la de cada
  // pagina: con cuatro rutas, tenerlos por pagina serian cuatro copias del
  // menu y del pie, y cambiar un telefono seria editarlo cuatro veces.
  cabecera: Navbar as Bloque,
  pie: Footer as Bloque,
  "carrusel-promociones": PromoCarousel as Bloque,
  "insignias-confianza": TrustBadges as Bloque,
  "repetir-pedido": RepetirPedido as Bloque,
  "productos-destacados": MasVendidos as Bloque,
  "ofertas-semana": OfertasSemana as Bloque,
  "categorias-destacadas": CategoriasDestacadas as Bloque,
  "por-que-elegirnos": PorQueElegirnos as Bloque,
  estadisticas: EstadisticasConfianza as Bloque,
  testimonios: Testimonials as Bloque,
  "como-funciona": ComoFunciona as Bloque,
  portada: Portada as Bloque,
  "publicos-objetivo": PublicosObjetivo as Bloque,
  "cotizacion-rapida": CotizacionRapida as Bloque,
  "cta-banda": CtaBanda as Bloque,
  "barra-categorias": BarraCategorias as Bloque,
  acceso: Acceso as Bloque,
};

export function componenteDe(tipo: string): Bloque | null {
  return REGISTRO[tipo] ?? null;
}

/** Los bloques que este despliegue sabe pintar. Lo usa el constructor. */
export const TIPOS_CONOCIDOS = Object.keys(REGISTRO);
