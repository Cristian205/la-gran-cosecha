"use client";

import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "@/componentes/animacion";
import { claseDeVariante } from "../Seccion";
import { Boton } from "./comunes";

/**
 * Una pieza de video publicitario. Es el espacio reservado para los videos de
 * campaña y de historia de marca: sin `video_url` ni `poster_url` NO se pinta
 * nada —un marcador vacío en producción sería ruido—, pero el bloque ya está
 * en la composición, así que activarlo es pegar una URL desde el panel.
 *
 * Carga y reproducción por observación: el archivo no se pide hasta que el
 * bloque está a punto de verse, y solo suena en bucle (siempre en silencio)
 * mientras está en pantalla. Con `prefers-reduced-motion` o ahorro de datos
 * queda el póster y el botón de reproducir, sin descargar nada por su cuenta.
 *
 * `vertical` es para lo grabado como reel o story: el video va en un marco
 * 9:16 junto al texto en escritorio, y ocupa el ancho en móvil.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  texto?: string;
  video_url?: string;
  video_movil_url?: string;
  poster_url?: string;
  video_alt?: string;
  cta_texto?: string;
  cta_href?: string;
  variante?: string;
}

const VARIANTES = ["horizontal", "vertical"] as const;

export function VideoCampaign({
  kicker = "",
  titulo = "",
  texto = "",
  video_url = "",
  video_movil_url = "",
  poster_url = "",
  video_alt = "",
  cta_texto = "",
  cta_href = "/tienda",
  variante,
}: Props) {
  const seccion = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const quieroReproducir = useRef(false);
  const sinMovimiento = useReducedMotion();
  const [src, setSrc] = useState("");
  const [sonando, setSonando] = useState(false);

  const hayVideo = Boolean(video_url || video_movil_url);

  const elegirArchivo = useCallback(() => {
    const movil = window.matchMedia("(max-width: 780px)").matches;
    return movil ? video_movil_url || video_url : video_url || video_movil_url;
  }, [video_url, video_movil_url]);

  const ahorroDeDatos = () =>
    Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    );

  useEffect(() => {
    const el = seccion.current;
    if (!el || !hayVideo || ahorroDeDatos()) return;
    const cerca = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setSrc((actual) => actual || elegirArchivo());
      },
      { rootMargin: "400px 0px" }
    );
    cerca.observe(el);
    return () => cerca.disconnect();
  }, [hayVideo, elegirArchivo]);

  useEffect(() => {
    const el = seccion.current;
    if (!el || !src) return;
    const vista = new IntersectionObserver(
      ([e]) => {
        const v = video.current;
        if (!v || !e) return;
        if (e.isIntersecting && !sinMovimiento) {
          v.play().then(() => setSonando(true)).catch(() => setSonando(false));
        } else if (!e.isIntersecting) {
          v.pause();
          setSonando(false);
        }
      },
      { threshold: 0.45 }
    );
    vista.observe(el);
    return () => vista.disconnect();
  }, [src, sinMovimiento]);

  useEffect(() => {
    if (src && quieroReproducir.current) {
      quieroReproducir.current = false;
      video.current?.play().then(() => setSonando(true)).catch(() => setSonando(false));
    }
  }, [src]);

  if (!hayVideo && !poster_url) return null;

  function alternar() {
    const v = video.current;
    if (!src) {
      quieroReproducir.current = true;
      setSrc(elegirArchivo());
      return;
    }
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setSonando(true)).catch(() => undefined);
    } else {
      v.pause();
      setSonando(false);
    }
  }

  const clase = claseDeVariante(variante, VARIANTES, "vc", "horizontal");

  return (
    <Reveal as="section" className={`vc ${clase}`} ref={seccion as never}>
      <div className="vc-marco">
        {src ? (
          <video
            ref={video}
            className="vc-media"
            src={src}
            poster={poster_url || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={video_alt || titulo || "Video"}
          />
        ) : poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="vc-media" src={poster_url} alt={video_alt || titulo} loading="lazy" decoding="async" />
        ) : null}
        <div className="vc-velo" aria-hidden="true" />
        {hayVideo && (
          <button
            type="button"
            className="vc-alternar"
            onClick={alternar}
            aria-label={sonando ? "Pausar el video" : "Reproducir el video"}
          >
            {sonando ? <Pause size={18} /> : <Play size={18} />}
          </button>
        )}
      </div>

      {(kicker || titulo || texto || cta_texto) && (
        <div className="vc-texto">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          {titulo && <h2>{titulo}</h2>}
          {texto && <p className="vc-parrafo">{texto}</p>}
          {cta_texto && <Boton href={cta_href || "/tienda"}>{cta_texto}</Boton>}
        </div>
      )}
    </Reveal>
  );
}
