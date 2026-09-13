"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone, Sprout } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { obtenerAnuncios } from "@/lib/datos";
import type { Anuncio } from "@/lib/tipos";
import { Reveal } from "@/componentes/animacion";

/**
 * El carrusel de anuncios del cuerpo del Home.
 *
 * No es una rejilla de productos ni una variante de `PromoCarousel`: es un
 * espacio de marketing propio, pensado para campañas ("Temporada de fruta",
 * "Precios por volumen"), no para mostrar el catálogo. El dato de detrás es
 * `content.Anuncio` — imagen, etiqueta, título, texto, CTA, enlace, orden y
 * activo — administrable desde el panel sin tocar este componente: añadir,
 * reordenar o apagar una campaña es una fila, nunca un despliegue.
 *
 * Sin anuncios activos no se pinta nada, el mismo criterio que
 * `Testimonials`/`EstadisticasConfianza`: un espacio de marketing vacío
 * parece un error de carga, así que si el negocio no ha cargado ninguno
 * todavía, la sección sencillamente no existe.
 */
interface Props {
  /** Rotar solo. Se pausa en cuanto alguien usa las flechas o los puntos —
   *  no solo mientras el ratón está encima, que en móvil no existe. */
  autoplay?: boolean;
  segundos?: number;
}

export function AnunciosCarrusel({ autoplay = true, segundos }: Props) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    obtenerAnuncios()
      .then(setAnuncios)
      .catch(() => setAnuncios([]));
  }, []);

  const total = anuncios.length;

  const siguiente = useCallback(() => {
    setIndice((i) => (i + 1) % total);
  }, [total]);

  useEffect(() => {
    setIndice(0);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || !autoplay || pausado) return;
    const espera = Math.min(30, Math.max(2, segundos ?? 7)) * 1000;
    const id = setInterval(siguiente, espera);
    return () => clearInterval(id);
  }, [siguiente, total, autoplay, segundos, pausado]);

  if (total === 0) return null;

  function irA(i: number) {
    setIndice(i);
    setPausado(true);
  }

  function anteriorManual() {
    setIndice((i) => (i - 1 + total) % total);
    setPausado(true);
  }

  function siguienteManual() {
    siguiente();
    setPausado(true);
  }

  const anuncio = anuncios[indice];
  const externo = anuncio.cta_href.startsWith("http");

  return (
    <Reveal
      className="anuncios-carrusel"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <span className="anuncios-blob b1" aria-hidden="true" />
      <span className="anuncios-blob b2" aria-hidden="true" />

      <div className="anuncios-media">
        {anuncio.imagen_url ? (
          // `img` y no `next/image`: la foto la sube cada negocio a su propio
          // bucket, igual que en `Portada` y `BannerPromocional`.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={anuncio.id} src={anuncio.imagen_url} alt="" className="anuncios-fade" />
        ) : (
          <div key={anuncio.id} className="anuncios-marcador anuncios-fade" aria-hidden="true">
            <Sprout size={56} strokeWidth={1.3} />
          </div>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              className="anuncios-flecha izquierda"
              onClick={anteriorManual}
              aria-label="Anuncio anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="anuncios-flecha derecha"
              onClick={siguienteManual}
              aria-label="Siguiente anuncio"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      <div className="anuncios-contenido" key={anuncio.id}>
        <div className="anuncios-fade">
          {anuncio.etiqueta && (
            <span className="anuncios-etiqueta">
              <Megaphone size={14} aria-hidden="true" />
              {anuncio.etiqueta}
            </span>
          )}
          <h2>{anuncio.titulo}</h2>
          {anuncio.texto && <p>{anuncio.texto}</p>}
          {anuncio.cta_texto &&
            (externo ? (
              <a
                className="btn primario"
                href={anuncio.cta_href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {anuncio.cta_texto}
                <ArrowRight size={16} />
              </a>
            ) : (
              <Link className="btn primario" href={anuncio.cta_href || "/tienda"}>
                {anuncio.cta_texto}
                <ArrowRight size={16} />
              </Link>
            ))}
        </div>
      </div>

      {total > 1 && (
        <div className="anuncios-dots">
          {anuncios.map((a, i) => (
            <button
              key={a.id}
              className={i === indice ? "activo" : ""}
              onClick={() => irA(i)}
              aria-label={`Ir al anuncio ${i + 1}`}
            />
          ))}
        </div>
      )}
    </Reveal>
  );
}
