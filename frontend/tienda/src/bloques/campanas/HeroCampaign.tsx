"use client";

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
 */
interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  subtitulo?: string;
  imagen?: string;
  imagen_movil?: string;
  imagen_alt?: string;
  /** `object-position` en escritorio y en móvil, ej. "50% 70%". */
  enfoque?: string;
  enfoque_movil?: string;
  video_url?: string;
  video_movil_url?: string;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
}

export function HeroCampaign({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  subtitulo = "",
  imagen = "",
  imagen_movil = "",
  imagen_alt = "",
  enfoque = "50% 60%",
  enfoque_movil = "",
  video_url = "",
  video_movil_url = "",
  cta_texto = "",
  cta_href = "/tienda",
  cta2_texto = "",
  cta2_href = "/contacto",
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

  const variables = {
    "--enfoque": enfoque,
    "--enfoque-movil": enfoque_movil || enfoque,
  } as CSSProperties;

  return (
    <section ref={ref} className="hc" style={variables}>
      <TipografiaEditorial />
      <motion.div
        className="hc-media"
        style={quieto ? undefined : { scale: escala, y: desplazamiento }}
        aria-hidden={imagen_alt ? undefined : true}
      >
        {imagen && (
          <picture>
            {imagen_movil && <source media="(max-width: 780px)" srcSet={imagen_movil} />}
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

      <motion.div
        className="hc-contenido"
        style={quieto ? undefined : { y: textoY, opacity: textoOpacidad }}
      >
        {kicker && <p className="cmp-kicker hc-in" style={{ "--i": 0 } as CSSProperties}>{kicker}</p>}
        <h1 className="hc-in" style={{ "--i": 1 } as CSSProperties}>
          {titulo}
          {titulo_resaltado && <em>{titulo_resaltado}</em>}
        </h1>
        {subtitulo && (
          <p className="hc-sub hc-in" style={{ "--i": 2 } as CSSProperties}>
            {subtitulo}
          </p>
        )}
        {(cta_texto || cta2_texto) && (
          <div className="hc-acciones hc-in" style={{ "--i": 3 } as CSSProperties}>
            {cta_texto && <Boton href={cta_href || "/tienda"}>{cta_texto}</Boton>}
            {cta2_texto && (
              <Boton href={cta2_href || "/contacto"} variante="fantasma" flecha={false}>
                {cta2_texto}
              </Boton>
            )}
          </div>
        )}
      </motion.div>

      <span className="hc-scroll" aria-hidden="true">
        <i />
      </span>
    </section>
  );
}
