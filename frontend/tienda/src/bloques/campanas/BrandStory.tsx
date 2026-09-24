"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import { Boton, TipografiaEditorial, useSinMovimiento } from "./comunes";

/**
 * La historia de la marca, contada con el scroll.
 *
 * Un escenario que se queda fijo a pantalla completa mientras el visitante
 * baja: cada tramo de scroll es un capítulo (campo, selección, calidad,
 * entrega), y la fotografía de fondo cambia con él. Es el único lugar del Home
 * donde el scroll "manda"; el resto de piezas se limita a aparecer.
 *
 * Todos los capítulos están siempre en el HTML —el buscador y el lector de
 * pantalla los leen completos—; solo el activo se ve. Para quien pide menos
 * movimiento no hay escenario fijo: cada capítulo es un panel apilado.
 *
 * Un capítulo sin `imagen` no rompe nada: cae a un fondo verde de marca. Es el
 * hueco donde entrará la foto real del proceso cuando exista.
 */
export interface Capitulo {
  etiqueta?: string;
  titulo?: string;
  texto?: string;
  imagen?: string;
  enfoque?: string;
}

interface Props {
  kicker?: string;
  capitulos?: Capitulo[];
  cta_texto?: string;
  cta_href?: string;
}

export function BrandStory({ kicker = "", capitulos = [], cta_texto = "", cta_href = "/tienda" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const quieto = useSinMovimiento();
  const [activo, setActivo] = useState(0);
  const lista = capitulos.filter((c) => c.titulo);
  const total = lista.length;

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (total === 0) return;
    setActivo(Math.min(total - 1, Math.max(0, Math.floor(v * total))));
  });

  if (total === 0) return null;

  if (quieto) {
    return (
      <section className="bs bs--estatico" aria-label={kicker || "Nuestra historia"}>
        <TipografiaEditorial />
        {lista.map((c, i) => (
          <article className="bs-panel" key={`${c.titulo}-${i}`}>
            {c.imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imagen} alt="" loading="lazy" decoding="async" style={{ objectPosition: c.enfoque || "50% 50%" }} />
            )}
            <div className="bs-panel-velo" aria-hidden="true" />
            <div className="bs-texto-fijo">
              <p className="cmp-kicker">
                {String(i + 1).padStart(2, "0")} · {c.etiqueta}
              </p>
              <h2>{c.titulo}</h2>
              {c.texto && <p>{c.texto}</p>}
            </div>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="bs"
      style={{ "--capitulos": total } as CSSProperties}
      aria-label={kicker || "Nuestra historia"}
    >
      <TipografiaEditorial />
      <div className="bs-escenario">
        <div className="bs-fotos" aria-hidden="true">
          {lista.map((c, i) => (
            <div key={`${c.titulo}-${i}`} className={`bs-foto ${i === activo ? "activa" : ""}`}>
              {c.imagen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imagen}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  style={{ objectPosition: c.enfoque || "50% 50%" }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="bs-velo" aria-hidden="true" />

        <div className="cmp-inner bs-marco">
          <p className="cmp-kicker bs-kicker">{kicker}</p>

          <div className="bs-capitulos">
            {lista.map((c, i) => (
              <article
                key={`${c.titulo}-${i}`}
                className={`bs-capitulo ${i === activo ? "activo" : ""}`}
              >
                <span className="bs-numero" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="cmp-kicker">{c.etiqueta}</p>
                <h2>{c.titulo}</h2>
                {c.texto && <p className="bs-parrafo">{c.texto}</p>}
              </article>
            ))}
          </div>

          <ol className="bs-progreso" aria-hidden="true">
            {lista.map((c, i) => (
              <li key={`${c.etiqueta}-${i}`} className={i === activo ? "activo" : i < activo ? "hecho" : ""}>
                <i />
                <span>{c.etiqueta}</span>
              </li>
            ))}
          </ol>

          {cta_texto && (
            <div className={`bs-cta ${activo === total - 1 ? "visible" : ""}`}>
              <Boton href={cta_href || "/tienda"}>{cta_texto}</Boton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
