"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Un espacio de fotografía o video, reemplazable desde el panel.
 *
 * Es la unidad con la que está hecha toda la historia de /nosotros: cada
 * escena declara QUÉ debería mostrarse (la madrugada en el abasto, la
 * selección, la entrega) y este componente pinta lo que haya — video, foto o
 * nada. Nada está escrito en el código: cuando el negocio grabe su video del
 * abasto, se pega la URL y la escena cambia sin tocar una línea.
 *
 * # Rendimiento
 *
 * - La foto es el póster y lo primero que se pinta; el video se pide DESPUÉS
 *   y solo cuando el bloque está cerca de la pantalla.
 * - En móvil se usa la versión vertical si existe, y nunca se descarga la de
 *   escritorio en una pantalla pequeña.
 * - Con `prefers-reduced-motion` o ahorro de datos no se descarga video: queda
 *   la foto.
 * - Un video solo se reproduce mientras se ve (y mientras `activo`), siempre
 *   en silencio y en bucle.
 */
export interface MedioDatos {
  imagen?: string;
  imagen_movil?: string;
  video_url?: string;
  video_movil_url?: string;
  /** Qué muestra, para el lector de pantalla. Vacío = decorativo. */
  alt?: string;
  /** `object-position`, ej. "50% 60%". */
  enfoque?: string;
  enfoque_movil?: string;
  /** "cubrir" llena el marco; "contener" respeta una composición recortada. */
  ajuste?: "cubrir" | "contener";
}

interface Props extends MedioDatos {
  /** La foto sobre el pliegue: se pide ya (LCP). */
  prioridad?: boolean;
  /** Una escena de un escenario fijo: el video se pausa cuando no es la activa. */
  activo?: boolean;
  className?: string;
}

const MOVIL = "(max-width: 780px)";

export function tieneMedio(m: MedioDatos | undefined): boolean {
  return Boolean(m && (m.imagen || m.imagen_movil || m.video_url || m.video_movil_url));
}

function puedeReproducir(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conexion?.saveData;
}

export function Medio({
  imagen = "",
  imagen_movil = "",
  video_url = "",
  video_movil_url = "",
  alt = "",
  enfoque = "50% 50%",
  enfoque_movil = "",
  ajuste = "cubrir",
  prioridad = false,
  activo = true,
  className = "",
}: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState("");
  const [listo, setListo] = useState(false);
  const [visible, setVisible] = useState(false);
  const hayVideo = Boolean(video_url || video_movil_url);

  // Elegir el archivo al acercarse, no antes.
  useEffect(() => {
    const el = raiz.current;
    if (!el || !hayVideo || !puedeReproducir()) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        const movil = window.matchMedia(MOVIL).matches;
        setSrc(movil ? video_movil_url || video_url : video_url || video_movil_url);
        obs.disconnect();
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayVideo, video_url, video_movil_url]);

  useEffect(() => {
    const el = raiz.current;
    if (!el || !src) return;
    const obs = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      threshold: 0.15,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (visible && activo) v.play().catch(() => undefined);
    else v.pause();
  }, [visible, activo, src]);

  if (!imagen && !imagen_movil && !hayVideo) return null;

  const estilo = {
    "--enfoque": enfoque,
    "--enfoque-movil": enfoque_movil || enfoque,
  } as CSSProperties;
  const foto = imagen || imagen_movil;

  return (
    <div
      ref={raiz}
      className={`medio medio--${ajuste} ${className}`}
      style={estilo}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {foto && (
        <picture>
          {imagen_movil && imagen && <source media={MOVIL} srcSet={imagen_movil} />}
          {/* `img` y no `next/image`: el archivo vive en el bucket de cada negocio. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto}
            alt=""
            loading={prioridad ? "eager" : "lazy"}
            fetchPriority={prioridad ? "high" : "auto"}
            decoding="async"
          />
        </picture>
      )}
      {src && (
        <video
          ref={video}
          className={listo ? "listo" : ""}
          src={src}
          poster={foto || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={() => setListo(true)}
        />
      )}
    </div>
  );
}
