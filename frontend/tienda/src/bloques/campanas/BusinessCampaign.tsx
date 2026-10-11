"use client";

import {
  BedDouble,
  Clock,
  Coffee,
  Home,
  Leaf,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/componentes/animacion";
import { useSiteConfig } from "@/componentes/CapaCliente";
import type { Paginated, Producto } from "@/lib/tipos";
import { Boton, TipografiaEditorial } from "./comunes";

/**
 * La pieza para negocios: restaurantes, hoteles, cafeterías, fruterías y
 * tiendas. Es publicidad B2B —un titular grande, una imagen del abastecimiento
 * y cuatro líneas de texto—, no una rejilla de "públicos".
 *
 * # Modo collage
 *
 * Con dos o más fotos en `collage` la pieza cambia de composición: el mensaje
 * a la izquierda (logo del negocio, titular, botón y una franja de
 * beneficios) y a la derecha un collage asimétrico de los clientes —hogar,
 * cocina, hotel, frutería, reparto— que se funde con el verde del fondo. En
 * móvil va primero el mensaje y después cuatro fotos en 2 × 2; la quinta se
 * guarda para pantallas donde hay sitio.
 *
 * Cada casilla tiene su proporción fijada por la rejilla, así que la página no
 * salta cuando las fotos terminan de cargar. Cada foto puede llevar un chip
 * («Restaurantes», «Fruvers y fruterías»…) que nombra a ese cliente.
 *
 * `mostrar_marco` añade el marco de hojas y bejucos dorados en las cuatro
 * esquinas. Va DETRÁS del contenido —asoma por los bordes, no tapa texto ni
 * fotos— y se escala con el ancho de la sección, así que no se deforma.
 *
 * El único número que muestra es el tamaño real del catálogo, que llega del
 * servidor (`count` de `/catalog/products/`): si no llega, la línea no existe.
 * Nada de cifras escritas a mano.
 *
 * Tiene ancla (`#negocios`) para poder enlazarla: el pie la usa. (El menú de
 * la cabecera ya no, ver storefront 0053: la campaña vive en el Inicio.)
 */
export interface Segmento {
  titulo?: string;
  texto?: string;
}

export interface FotoCollage {
  imagen?: string;
  /** Versión más ligera para móvil. Vacía: la misma. */
  imagen_movil?: string;
  alt?: string;
  /** Chip sobre la foto: a qué cliente representa. Vacío: sin chip. */
  etiqueta?: string;
  icono?: string;
}

export interface Beneficio {
  icono?: string;
  texto?: string;
}

interface Props {
  datos?: Paginated<Producto> | Producto[];
  ancla?: string;
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  segmentos?: Segmento[];
  imagen?: string;
  imagen_alt?: string;
  collage?: FotoCollage[];
  beneficios?: Beneficio[];
  mostrar_logo?: boolean;
  mostrar_marco?: boolean;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
}

const ICONOS: Record<string, LucideIcon> = {
  hoja: Leaf,
  escudo: ShieldCheck,
  carrito: ShoppingCart,
  camion: Truck,
  personas: Users,
  reloj: Clock,
  casa: Home,
  cubiertos: UtensilsCrossed,
  cama: BedDouble,
  tienda: Store,
  cafe: Coffee,
};

export function BusinessCampaign({
  datos,
  ancla = "negocios",
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  segmentos = [],
  imagen = "",
  imagen_alt = "",
  collage = [],
  beneficios = [],
  mostrar_logo = false,
  mostrar_marco = false,
  cta_texto = "",
  cta_href = "/contacto",
  cta2_texto = "",
  cta2_href = "/tienda",
}: Props) {
  const { config } = useSiteConfig();
  if (!titulo) return null;

  const totalCatalogo =
    datos && !Array.isArray(datos) && typeof datos.count === "number" ? datos.count : null;

  const fotos = collage.filter((f) => f?.imagen).slice(0, 5);
  const enCollage = fotos.length >= 2;
  const ventajas = beneficios.filter((b) => b?.texto).slice(0, 4);
  const logo = mostrar_logo && config.logo_url ? config.logo_url : "";

  return (
    <section
      id={ancla || undefined}
      className={`bn ${enCollage ? "bn--collage" : ""} ${mostrar_marco ? "bn--marco" : ""}`}
    >
      <TipografiaEditorial />
      {mostrar_marco && <div className="bn-marco" aria-hidden="true" />}
      <div className="cmp-inner bn-grid">
        <div className="bn-texto">
          <Reveal>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bn-logo" src={logo} alt={config.nombre_empresa} decoding="async" />
            )}
            {kicker && <p className="cmp-kicker">{kicker}</p>}
            <h2>
              {titulo}
              {titulo_resaltado && <em>{titulo_resaltado}</em>}
            </h2>
          </Reveal>
          {texto && (
            <Reveal retraso={0.1}>
              <p className="bn-parrafo">{texto}</p>
            </Reveal>
          )}

          {segmentos.length > 0 && (
            <Reveal retraso={0.18}>
              <ul className="bn-segmentos">
                {segmentos.map((s, i) => (
                  <li key={`${s.titulo}-${i}`}>
                    <strong>{s.titulo}</strong>
                    {s.texto && <span>{s.texto}</span>}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal retraso={0.26} className="bn-acciones">
            {cta_texto && <Boton href={cta_href || "/contacto"}>{cta_texto}</Boton>}
            {cta2_texto && (
              <Boton href={cta2_href || "/tienda"} variante="fantasma" flecha={false}>
                {cta2_texto}
              </Boton>
            )}
          </Reveal>
          {totalCatalogo !== null && totalCatalogo > 0 && (
            <p className="bn-dato">
              <strong>{totalCatalogo}</strong> productos, un solo pedido.
            </p>
          )}

          {ventajas.length > 0 && (
            <ul className="bn-beneficios">
              {ventajas.map((b, i) => {
                const Icono = ICONOS[b.icono ?? ""] ?? Leaf;
                return (
                  <li key={`${b.texto}-${i}`}>
                    <Icono size={22} strokeWidth={1.6} aria-hidden="true" />
                    <span>{b.texto}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {enCollage ? (
          <div className={`bn-collage bn-collage--${fotos.length}`}>
            {fotos.map((foto, i) => {
              const IconoChip = foto.icono ? ICONOS[foto.icono] : undefined;
              return (
                <figure key={`${foto.imagen}-${i}`} className={`bn-foto bn-foto--${i + 1}`}>
                  <picture>
                    {foto.imagen_movil && <source media="(max-width: 780px)" srcSet={foto.imagen_movil} />}
                    {/* `img` y no `next/image`: el archivo puede vivir en el bucket del negocio. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foto.imagen} alt={foto.alt ?? ""} loading="lazy" decoding="async" />
                  </picture>
                  {foto.etiqueta && (
                    <figcaption className="bn-chip">
                      {IconoChip && <IconoChip size={16} strokeWidth={2} aria-hidden="true" />}
                      {foto.etiqueta}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        ) : (
          imagen && (
            <Reveal className="bn-imagen" retraso={0.1}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagen} alt={imagen_alt} loading="lazy" decoding="async" />
            </Reveal>
          )
        )}
      </div>
    </section>
  );
}
