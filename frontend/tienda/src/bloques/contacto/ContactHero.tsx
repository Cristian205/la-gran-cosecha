"use client";

import { ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Boton, TipografiaEditorial } from "../campanas/comunes";
import { Medio, tieneMedio, type MedioDatos } from "../nosotros/Medio";
import { ENLACE_DE, type Intencion } from "./intenciones";

/**
 * El hero de /contacto: "Aquí me pueden ayudar", no "Contáctanos".
 *
 * A la izquierda, el titular en dos tiempos y los dos botones (hablar con el
 * equipo / ver productos). A la derecha, la mesa de trabajo: fotos reales de
 * producto y, encima, la tarjeta "¿Qué necesitas hoy?" con los atajos a cada
 * camino del selector. No es decoración: cada atajo abre su formulario.
 *
 * Admite foto o video de fondo a sangre (`imagen`, `video_url`… como todas
 * las escenas de /nosotros): cuando exista material real de la operación
 * —cajas, preparación, una entrega—, se pega en el panel y el hero pasa a
 * contarse sobre él. Sin medio, el fondo es el verde de la marca.
 */
interface Foto {
  imagen?: string;
  alt?: string;
}

interface Atajo {
  clave?: Intencion;
  texto?: string;
}

interface Props extends MedioDatos {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
  atajos_titulo?: string;
  atajos?: Atajo[];
  fotos?: Foto[];
}

export function ContactHero({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  cta_texto = "",
  cta_href = ENLACE_DE.hablar,
  cta2_texto = "",
  cta2_href = "/tienda",
  atajos_titulo = "",
  atajos = [],
  fotos = [],
  ...medio
}: Props) {
  if (!titulo && !titulo_resaltado) return null;

  const conFondo = tieneMedio(medio);
  const imagenes = fotos.filter((f) => f.imagen).slice(0, 4);
  const caminos = atajos.filter((a) => a.clave && ENLACE_DE[a.clave] && a.texto);

  return (
    <section className={`ct-hero ${conFondo ? "ct-hero--fondo" : ""}`} aria-labelledby="ct-hero-titulo">
      <TipografiaEditorial />
      {conFondo && (
        <>
          <div className="ct-hero-medio">
            <Medio {...medio} prioridad />
          </div>
          <div className="ct-hero-velo" aria-hidden="true" />
        </>
      )}

      <div className="cmp-inner ct-hero-grid">
        <div className="ct-hero-texto">
          {kicker && (
            <p className="cmp-kicker ct-entra" style={{ "--i": 0 } as CSSProperties}>
              {kicker}
            </p>
          )}
          <h1 id="ct-hero-titulo" className="ct-hero-titulo">
            {titulo && (
              <span className="ct-linea">
                <span className="ct-entra" style={{ "--i": 1 } as CSSProperties}>
                  {titulo}
                </span>
              </span>
            )}
            {titulo_resaltado && (
              <span className="ct-linea">
                <em className="ct-entra" style={{ "--i": 2 } as CSSProperties}>
                  {titulo_resaltado}
                </em>
              </span>
            )}
          </h1>
          {texto && (
            <p className="ct-hero-sub ct-entra" style={{ "--i": 3 } as CSSProperties}>
              {texto}
            </p>
          )}
          {(cta_texto || cta2_texto) && (
            <div className="ct-hero-acciones ct-entra" style={{ "--i": 4 } as CSSProperties}>
              {cta_texto && <Boton href={cta_href || ENLACE_DE.hablar}>{cta_texto}</Boton>}
              {cta2_texto && (
                <Boton href={cta2_href || "/tienda"} variante="fantasma" flecha={false}>
                  {cta2_texto}
                </Boton>
              )}
            </div>
          )}
        </div>

        {(imagenes.length > 0 || caminos.length > 0) && (
          <div className="ct-hero-mesa">
            {imagenes.length > 0 && (
              <div className="ct-hero-fotos" data-n={imagenes.length} aria-hidden={imagenes.every((f) => !f.alt)}>
                {imagenes.map((f, i) => (
                  <figure key={`${f.imagen}-${i}`} className="ct-hero-foto" style={{ "--i": i } as CSSProperties}>
                    {/* `img` y no `next/image`: el archivo vive en el bucket de cada negocio. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.imagen}
                      alt={f.alt ?? ""}
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "low"}
                      decoding="async"
                    />
                  </figure>
                ))}
              </div>
            )}
            {caminos.length > 0 && (
              <nav className="ct-hero-tarjeta ct-entra" style={{ "--i": 5 } as CSSProperties} aria-label={atajos_titulo || "Atajos"}>
                {atajos_titulo && <p className="ct-hero-tarjeta-titulo">{atajos_titulo}</p>}
                <ul>
                  {caminos.map((a) => (
                    <li key={a.clave}>
                      <a href={ENLACE_DE[a.clave!]}>
                        {a.texto} <ArrowUpRight size={16} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
