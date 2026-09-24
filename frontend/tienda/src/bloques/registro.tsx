import type { ComponentType } from "react";

import { AnunciosCarrusel } from "@/componentes/AnunciosCarrusel";
import { CategoriasDestacadas } from "@/componentes/CategoriasDestacadas";
import { Footer } from "@/componentes/Footer";
import { CotizacionRapida } from "@/componentes/CotizacionRapida";
import { EstadisticasConfianza } from "@/componentes/EstadisticasConfianza";
import { MasVendidos } from "@/componentes/MasVendidos";
import { Navbar } from "@/componentes/Navbar";
import { OfertasSemana } from "@/componentes/OfertasSemana";
import { PorQueElegirnos } from "@/componentes/PorQueElegirnos";
import { ProductoDestacado } from "@/componentes/ProductoDestacado";
import { PromoCarousel } from "@/componentes/PromoCarousel";
import { RepetirPedido } from "@/componentes/RepetirPedido";
import { Testimonials } from "@/componentes/Testimonials";
import { TrustBadges } from "@/componentes/TrustBadges";
import { FeaturedProducts } from "@/componentes/tienda/FeaturedProducts";
import { Acceso } from "./Acceso";
import { BannerPromocional } from "./BannerPromocional";
import { Boletin } from "./Boletin";
import { Galeria } from "./Galeria";
import { GridProductos } from "./GridProductos";
import { Marcas } from "./Marcas";
import { Separador } from "./Separador";
import { BarraCategorias } from "./BarraCategorias";
import { ComoFunciona } from "./ComoFunciona";
import { Portada } from "./Portada";
import { PublicosObjetivo } from "./PublicosObjetivo";
import { CtaBanda } from "./CtaBanda";
import { CatalogHero } from "./CatalogHero";
import { CategoryNavigation } from "./CategoryNavigation";
import { CatalogToolbar } from "./CatalogToolbar";
import { PaginaNoEncontrada } from "./PaginaNoEncontrada";
import { Marquesina } from "./Marquesina";
import { TextoLibre } from "./TextoLibre";
import { Video } from "./Video";
import { BrandStory } from "./campanas/BrandStory";
import { BusinessCampaign } from "./campanas/BusinessCampaign";
import { EditorialCampaign } from "./campanas/EditorialCampaign";
import { FeaturedCampaign } from "./campanas/FeaturedCampaign";
import { FinalCTA } from "./campanas/FinalCTA";
import { HeroCampaign } from "./campanas/HeroCampaign";
import { ProductSpotlight } from "./campanas/ProductSpotlight";
import { TestimonialStory } from "./campanas/TestimonialStory";
import { VideoCampaign } from "./campanas/VideoCampaign";
import { AboutHero } from "./nosotros/AboutHero";
import { BrandStatement } from "./nosotros/BrandStatement";
import { BusinessTypes } from "./nosotros/BusinessTypes";
import { Compromisos } from "./nosotros/Compromisos";
import { HiddenWork } from "./nosotros/HiddenWork";
import { ProcessStory } from "./nosotros/ProcessStory";
import { StorySection } from "./nosotros/StorySection";
import { TeamStory } from "./nosotros/TeamStory";
import { TimeStory } from "./nosotros/TimeStory";
import { Transparencia } from "./nosotros/Transparencia";

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
  "producto-destacado": ProductoDestacado as Bloque,
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
  video: Video as Bloque,
  "anuncios-carrusel": AnunciosCarrusel as Bloque,
  marquesina: Marquesina as Bloque,

  // --- las campañas del Home: publicidad propia, no catalogo ------------------
  "hero-campana": HeroCampaign as Bloque,
  "video-campana": VideoCampaign as Bloque,
  "campana-destacada": FeaturedCampaign as Bloque,
  "campana-editorial": EditorialCampaign as Bloque,
  "producto-spotlight": ProductSpotlight as Bloque,
  "campana-negocios": BusinessCampaign as Bloque,
  "historia-marca": BrandStory as Bloque,
  "testimonios-editorial": TestimonialStory as Bloque,
  "cierre-cta": FinalCTA as Bloque,

  // --- /nosotros: la historia de por qué existe el negocio -----------------
  // Cada escena es un espacio de foto/video reemplazable (ver `nosotros/Medio`):
  // el contenido audiovisual cambia desde el panel sin tocar estos bloques.
  "nosotros-hero": AboutHero as Bloque,
  "nosotros-origen": StorySection as Bloque,
  "nosotros-proceso": ProcessStory as Bloque,
  "nosotros-invisible": HiddenWork as Bloque,
  "nosotros-tiempo": TimeStory as Bloque,
  "nosotros-equipo": TeamStory as Bloque,
  "nosotros-negocios": BusinessTypes as Bloque,
  "nosotros-compromisos": Compromisos as Bloque,
  "nosotros-precio": Transparencia as Bloque,
  "nosotros-manifiesto": BrandStatement as Bloque,

  // --- la biblioteca que llego con el paso 3 --------------------------------
  // Ninguno obligo a tocar el lienzo ni el registro mas alla de estas filas:
  // es la parte del motor que ya funcionaba y que esta fase solo llena.
  "grid-productos": GridProductos as Bloque,
  "banner-promocional": BannerPromocional as Bloque,
  galeria: Galeria as Bloque,
  marcas: Marcas as Bloque,
  boletin: Boletin as Bloque,
  separador: Separador as Bloque,
  "texto-libre": TextoLibre as Bloque,

  // --- el catalogo como bloques del motor ------------------------------------
  // Genericos y reutilizables por cualquier tienda: la que los coordina entre
  // si es `CatalogoProvider` (ver `contextos/CatalogoContexto.tsx`), envuelto
  // alrededor del lienzo en `app/tienda/page.tsx`. Sin ese contexto, cada uno
  // se apaga solo o cae a un comportamiento suelto — ninguno depende del otro
  // por fuera de ese canal.
  "catalogo-hero": CatalogHero as Bloque,
  "categorias-navegacion": CategoryNavigation as Bloque,
  "catalogo-toolbar": CatalogToolbar as Bloque,
  // El merchandising del catálogo: un protagonista + "También puedes
  // pedir…". Sucede a `producto-destacado`, que sigue registrado para las
  // composiciones que ya lo usan.
  "favoritos-negocios": FeaturedProducts as Bloque,

  // Va en la ruta reservada `/_no-encontrada` (ver `RUTA_NO_ENCONTRADA` en
  // `lib/pagina.ts`), con el mismo criterio que `cabecera`/`pie` en `/_layout`.
  "error-404": PaginaNoEncontrada as Bloque,
};

export function componenteDe(tipo: string): Bloque | null {
  return REGISTRO[tipo] ?? null;
}

/** Los bloques que este despliegue sabe pintar. Lo usa el constructor. */
export const TIPOS_CONOCIDOS = Object.keys(REGISTRO);
