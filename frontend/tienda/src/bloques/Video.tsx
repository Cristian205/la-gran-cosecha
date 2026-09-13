"use client";

import Link from "next/link";
import { Pause, Play, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";
import { Reveal } from "@/componentes/animacion";

/**
 * El espacio publicitario de video.
 *
 * Es un bloque de CONTENIDO, igual que `Portada` y `BannerPromocional`: no pide
 * nada al servidor, todo lo que pinta son sus propias propiedades. La
 * diferencia con `BannerPromocional` es el medio — ahí es una foto con texto al
 * lado, aquí es video de fondo con el texto encima — y por eso es un bloque
 * aparte y no una variante de aquél.
 *
 * Sin `video_url` no se pinta un video roto ni se oculta la sección entera: se
 * dibuja un marcador de posición con el texto ya puesto, para que el bloque
 * "exista" en la página en cuanto se coloca desde el constructor, antes de que
 * el negocio tenga el archivo real. Es la misma idea que una `Portada` sin
 * imagen: se adapta, no desaparece.
 *
 * Solo admite un archivo de video servido por URL (MP4 típicamente), no un
 * embed de YouTube/Vimeo. Un iframe externo no se puede silenciar, poner en
 * bucle ni usar como fondo de la misma forma que un `<video>` propio, así que
 * mezclar los dos casos en un solo bloque habría complicado el componente para
 * un contenido que además no es el que promete "video publicitario propio".
 */
export interface Props {
  kicker?: string;
  kicker_icono?: string;
  titulo?: string;
  texto?: string;
  video_url?: string;
  poster_url?: string;
  /** Lo que lee quien no ve el video. Cae al título si no se escribe. */
  video_alt?: string;
  cta_texto?: string;
  cta_href?: string;
  /** Autoreproducir en cuanto entra en pantalla. Siempre en silencio: un video
   *  que empieza a sonar solo es lo primero que un visitante cierra. */
  autoplay?: boolean;
  variante?: string;
}

/**
 * `horizontal` es el anuncio de escritorio: 16:9, a sangre. `vertical` es la
 * composición pensada para campañas grabadas para el móvil —un reel, un
 * story— que un 16:9 recortaría o dejaría con barras negras.
 */
const VARIANTES = ["horizontal", "vertical"] as const;

export function Video({
  kicker = "",
  kicker_icono = "chispa",
  titulo = "",
  texto = "",
  video_url = "",
  poster_url = "",
  video_alt = "",
  cta_texto = "",
  cta_href = "/tienda",
  autoplay = true,
  variante,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);

  useEffect(() => {
    const elemento = videoRef.current;
    if (!elemento || !video_url || !autoplay) return;
    // Quien pidio menos movimiento no recibe un video que arranca solo, sea
    // cual sea lo que el bloque tenga configurado — el mismo criterio que ya
    // aplican todas las animaciones de `global.css`.
    const prefiereQuieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefiereQuieto) return;
    elemento
      .play()
      .then(() => setReproduciendo(true))
      .catch(() => setReproduciendo(false));
  }, [video_url, autoplay]);

  // Sin nada que decir ni que mostrar no se pinta: un panel vacio a sangre
  // ocuparia media pantalla sin motivo.
  if (!titulo && !texto && !video_url && !poster_url) return null;

  function alternar() {
    const elemento = videoRef.current;
    if (!elemento) return;
    if (elemento.paused) {
      elemento.play();
      setReproduciendo(true);
    } else {
      elemento.pause();
      setReproduciendo(false);
    }
  }

  const clase = claseDeVariante(variante, VARIANTES, "video-bloque", "horizontal");
  const IconoKicker = icono(kicker_icono);

  return (
    <Reveal as="section" className={`video-bloque ${clase}`}>
      <div className="video-bloque-media">
        {video_url ? (
          <video
            ref={videoRef}
            src={video_url}
            poster={poster_url || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={video_alt || titulo}
            onClick={alternar}
          />
        ) : poster_url ? (
          // `img` y no `next/image`: el archivo lo sube cada negocio a su
          // propio bucket, igual que en `Portada` y `BannerPromocional`.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster_url} alt={video_alt || titulo} />
        ) : (
          <div className="video-bloque-marcador" aria-hidden="true">
            <Play size={44} strokeWidth={1.5} />
          </div>
        )}
        <div className="video-bloque-velo" />
      </div>

      <div className="contenedor video-bloque-cuerpo">
        {kicker && (
          <span className="video-bloque-kicker">
            <IconoKicker size={15} aria-hidden="true" />
            {kicker}
          </span>
        )}
        {titulo && <h2>{titulo}</h2>}
        {texto && <p>{texto}</p>}
        {cta_texto && (
          <Link className="btn btn-ambar" href={cta_href || "/tienda"}>
            <ShoppingBag size={17} />
            {cta_texto}
          </Link>
        )}
      </div>

      {video_url && (
        <button
          type="button"
          className="video-bloque-alternar"
          onClick={alternar}
          aria-label={reproduciendo ? "Pausar el video" : "Reproducir el video"}
        >
          {reproduciendo ? <Pause size={18} /> : <Play size={18} />}
        </button>
      )}
    </Reveal>
  );
}
