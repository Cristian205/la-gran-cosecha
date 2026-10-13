"use client";

import {
  Leaf,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Store,
  Clock,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Boton, TipografiaEditorial, useSinMovimiento } from "./comunes";

/**
 * El primer impacto del Home: una fotografía a pantalla completa con un titular
 * enorme encima. La imagen hace el trabajo; el texto es corto a propósito.
 *
 * Video opcional: si hay `video_url` (o `video_movil_url`) se carga DESPUÉS de
 * pintar la imagen —que es el póster y el LCP— y solo si el visitante no pidió
 * menos movimiento ni ahorro de datos. En móvil solo se usa el video pensado
 * para móvil; nunca se descarga el de escritorio en una pantalla pequeña.
 *
 * El titular sale en el HTML del servidor y entra con CSS puro: si el
 * JavaScript tarda, el mensaje ya está ahí.
 *
 * Todo lo que se ve es una propiedad del bloque (textos, iconos, beneficios,
 * degradado): se edita desde el panel y ningún texto vive en el código.
 */

/** Los iconos que el banner puede nombrar desde el panel. De trazo (lucide):
 *  siguen el color del texto y se leen a 18 px sobre una foto. */
const ICONOS_HERO: Record<string, LucideIcon> = {
  ubicacion: MapPin,
  carrito: ShoppingCart,
  canasta: ShoppingBasket,
  tienda: Store,
  camion: Truck,
  hoja: Leaf,
  escudo: ShieldCheck,
  reloj: Clock,
  chispa: Sparkles,
  telefono: Phone,
  mensaje: MessageCircle,
};

function IconoHero({ nombre, size = 18 }: { nombre?: string; size?: number }) {
  const Icono = ICONOS_HERO[nombre ?? ""];
  return Icono ? <Icono size={size} strokeWidth={1.8} aria-hidden="true" /> : null;
}

/** Un beneficio de la fila de abajo: «Productos» + «frescos del día». */
interface Beneficio {
  texto?: string;
  detalle?: string;
  icono?: string;
}
interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  subtitulo?: string;
  /** Una segunda línea, más tenue, bajo el subtítulo. */
  subtitulo_secundario?: string;
  /** Icono antes del antetítulo (la ubicación). Vacío: sin icono. */
  kicker_icono?: string;
  cta_icono?: string;
  cta2_icono?: string;
  /** La fila de beneficios al pie del banner. Vacía: no se dibuja. */
  beneficios?: Beneficio[];
  imagen?: string;
  imagen_movil?: string;
  /** Entre 781 y 1024 px. Vacía: la de escritorio. */
  imagen_tablet?: string;
  imagen_alt?: string;
  /** `object-position` en escritorio, tablet y móvil, ej. "50% 70%". */
  enfoque?: string;
  enfoque_movil?: string;
  enfoque_tablet?: string;
  video_url?: string;
  video_movil_url?: string;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
  /** Diseño y legibilidad. Cada valor por defecto es el aspecto de siempre. */
  altura?: "completa" | "alta" | "media";
  alineacion?: "izquierda" | "centro" | "derecha";
  posicion?: "arriba" | "centro" | "abajo";
  /** Capa oscura extra sobre la foto, 0–80 (%). */
  oscurecer?: number;
  degradado?: "editorial" | "inferior" | "lateral" | "bosque" | "ninguno";
  tono_texto?: "claro" | "oscuro";
  cta_visible?: boolean;
  cta_estilo?: "ambar" | "oscuro" | "fantasma";
  cta2_visible?: boolean;
  cta2_estilo?: "ambar" | "oscuro" | "fantasma";
}

/** Solo lo conocido llega a una clase: un valor escrito a mano no rompe el CSS. */
function uno<T extends string>(valor: unknown, validos: readonly T[], defecto: T): T {
  return validos.includes(valor as T) ? (valor as T) : defecto;
}

const ESTILOS_BOTON = ["ambar", "oscuro", "fantasma"] as const;

export function HeroCampaign({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  subtitulo = "",
  subtitulo_secundario = "",
  kicker_icono = "",
  cta_icono = "",
  cta2_icono = "",
  beneficios = [],
  imagen = "",
  imagen_movil = "",
  imagen_tablet = "",
  imagen_alt = "",
  enfoque = "50% 60%",
  enfoque_movil = "",
  enfoque_tablet = "",
  video_url = "",
  video_movil_url = "",
  cta_texto = "",
  cta_href = "/tienda",
  cta2_texto = "",
  cta2_href = "/contacto",
  altura,
  alineacion,
  posicion,
  oscurecer = 0,
  degradado,
  tono_texto,
  cta_visible = true,
  cta_estilo,
  cta2_visible = true,
  cta2_estilo,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const quieto = useSinMovimiento();
  const [videoSrc, setVideoSrc] = useState("");
  const [videoListo, setVideoListo] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const escala = useTransform(scrollYProgress, [0, 1], [1.04, 1.2]);
  const desplazamiento = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const textoY = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);
  const textoOpacidad = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  useEffect(() => {
    if (!video_url && !video_movil_url) return;
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ahorro = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    if (sinMovimiento || ahorro) return;
    const movil = window.matchMedia("(max-width: 780px)").matches;
    setVideoSrc(movil ? video_movil_url : video_url || video_movil_url);
  }, [video_url, video_movil_url]);

  if (!titulo && !titulo_resaltado) return null;

  const velo = Math.min(80, Math.max(0, Number(oscurecer) || 0));
  const variables = {
    "--enfoque": enfoque,
    "--enfoque-movil": enfoque_movil || enfoque,
    "--enfoque-tablet": enfoque_tablet || enfoque,
    "--hc-oscurecer": velo / 100,
  } as CSSProperties;
  const clases = [
    "hc",
    `hc--alto-${uno(altura, ["completa", "alta", "media"] as const, "completa")}`,
    `hc--alinear-${uno(alineacion, ["izquierda", "centro", "derecha"] as const, "izquierda")}`,
    `hc--posicion-${uno(posicion, ["arriba", "centro", "abajo"] as const, "arriba")}`,
    `hc--degradado-${uno(degradado, ["editorial", "inferior", "lateral", "bosque", "ninguno"] as const, "editorial")}`,
    `hc--texto-${uno(tono_texto, ["claro", "oscuro"] as const, "claro")}`,
  ].join(" ");
  const verCta = Boolean(cta_texto) && cta_visible !== false;
  const verCta2 = Boolean(cta2_texto) && cta2_visible !== false;
  const listaBeneficios = (Array.isArray(beneficios) ? beneficios : []).filter((b) => b?.texto?.trim());

  return (
    <section
      ref={ref}
      className={`${clases} ${listaBeneficios.length > 0 ? "hc--con-beneficios" : ""}`}
      style={variables}
    >
      <TipografiaEditorial />
      <motion.div
        className="hc-media"
        style={quieto ? undefined : { scale: escala, y: desplazamiento }}
        aria-hidden={imagen_alt ? undefined : true}
      >
        {imagen && (
          <picture>
            {imagen_movil && <source media="(max-width: 780px)" srcSet={imagen_movil} />}
            {imagen_tablet && (
              <source media="(min-width: 781px) and (max-width: 1024px)" srcSet={imagen_tablet} />
            )}
            {/* `img` y no `next/image`: el archivo vive en el bucket de cada negocio. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hc-img" src={imagen} alt={imagen_alt} fetchPriority="high" decoding="async" />
          </picture>
        )}
        {videoSrc && (
          <video
            className={`hc-video ${videoListo ? "listo" : ""}`}
            src={videoSrc}
            poster={imagen || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            onCanPlay={() => setVideoListo(true)}
          />
        )}
      </motion.div>
      <div className="hc-velo" aria-hidden="true" />
      {velo > 0 && <div className="hc-oscuro" aria-hidden="true" />}

      <motion.div
        className="hc-contenido"
        style={quieto ? undefined : { y: textoY, opacity: textoOpacidad }}
      >
        {kicker && (
          <p className="cmp-kicker hc-kicker hc-in" style={{ "--i": 0 } as CSSProperties}>
            <IconoHero nombre={kicker_icono} size={15} />
            {kicker}
          </p>
        )}
        <h1 className="hc-in" style={{ "--i": 1 } as CSSProperties}>
          {titulo}
          {titulo_resaltado && <em>{titulo_resaltado}</em>}
        </h1>
        {(subtitulo || subtitulo_secundario) && (
          <p className="hc-sub hc-in" style={{ "--i": 2 } as CSSProperties}>
            {subtitulo}
            {subtitulo_secundario && <span className="hc-sub-2">{subtitulo_secundario}</span>}
          </p>
        )}
        {(verCta || verCta2) && (
          <div className="hc-acciones hc-in" style={{ "--i": 3 } as CSSProperties}>
            {verCta && (
              <Boton
                href={cta_href || "/tienda"}
                variante={uno(cta_estilo, ESTILOS_BOTON, "ambar")}
                icono={ICONOS_HERO[cta_icono] ? <IconoHero nombre={cta_icono} /> : undefined}
              >
                {cta_texto}
              </Boton>
            )}
            {verCta2 && (
              <Boton
                href={cta2_href || "/contacto"}
                variante={uno(cta2_estilo, ESTILOS_BOTON, "fantasma")}
                flecha={false}
                icono={ICONOS_HERO[cta2_icono] ? <IconoHero nombre={cta2_icono} /> : undefined}
              >
                {cta2_texto}
              </Boton>
            )}
          </div>
        )}

        {listaBeneficios.length > 0 && (
          <ul className="hc-beneficios hc-in" style={{ "--i": 4 } as CSSProperties}>
            {listaBeneficios.map((b, i) => (
              <li key={`${b.texto}-${i}`}>
                <span className="hc-beneficio-icono">
                  <IconoHero nombre={b.icono || "hoja"} size={26} />
                </span>
                <span className="hc-beneficio-texto">
                  {b.texto}
                  {b.detalle && <span>{b.detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <span className="hc-scroll" aria-hidden="true">
        <i />
      </span>
    </section>
  );
}
