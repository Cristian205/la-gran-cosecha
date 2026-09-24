"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { Boton, TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";
import { Medio, type MedioDatos } from "./Medio";

/**
 * El hero de /nosotros: una campaña, no una landing.
 *
 * La foto (o el video de la madrugada en el abasto, cuando exista) ocupa el
 * viewport entero y el titular se escribe encima, abajo a la izquierda, en
 * dos tiempos: "Mientras tú haces crecer tu negocio," — y, un instante
 * después, en serif cursiva, "nosotros conseguimos lo que necesitas." Es la
 * frase que la página entera va a demostrar.
 *
 * Al pie, el `recorrido`: la ruta que el cliente NO tiene que hacer
 * (madrugada → abasto → selección → tu negocio), con un punto que la recorre.
 * Es la primera pista de lo que cuenta el resto de la página.
 *
 * El titular sale en el HTML del servidor y entra con CSS: si el JavaScript
 * tarda, el mensaje ya está. Solo el movimiento de cámara al hacer scroll
 * depende de Motion, y se apaga con `prefers-reduced-motion`.
 */
interface Props extends MedioDatos {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  subtitulo?: string;
  recorrido?: string[];
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
}

export function AboutHero({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  subtitulo = "",
  recorrido = [],
  cta_texto = "",
  cta_href = "#como-lo-hacemos",
  cta2_texto = "",
  cta2_href = "/tienda",
  ...medio
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const quieto = useSinMovimiento();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const escala = useTransform(scrollYProgress, [0, 1], [1.02, 1.18]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const textoY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const opacidad = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  if (!titulo && !titulo_resaltado) return null;

  const pasos = recorrido.filter(Boolean);

  return (
    <section ref={ref} className="nh" aria-labelledby="nh-titulo">
      <TipografiaEditorial />
      <motion.div className="nh-media" style={quieto ? undefined : { scale: escala, y }}>
        <Medio {...medio} prioridad className="nh-medio" />
      </motion.div>
      <div className="nh-velo" aria-hidden="true" />

      <motion.div className="nh-cuerpo" style={quieto ? undefined : { y: textoY, opacity: opacidad }}>
        {kicker && <p className="cmp-kicker nh-kicker nh-entra" style={{ "--i": 0 } as CSSProperties}>{kicker}</p>}
        <h1 id="nh-titulo" className="nh-titulo">
          {titulo && (
            <span className="nh-linea">
              <span className="nh-entra" style={{ "--i": 1 } as CSSProperties}>{titulo}</span>
            </span>
          )}
          {titulo_resaltado && (
            <span className="nh-linea">
              <em className="nh-entra" style={{ "--i": 2 } as CSSProperties}>{titulo_resaltado}</em>
            </span>
          )}
        </h1>
        {subtitulo && (
          <p className="nh-sub nh-entra" style={{ "--i": 3 } as CSSProperties}>
            {subtitulo}
          </p>
        )}
        {(cta_texto || cta2_texto) && (
          <div className="nh-acciones nh-entra" style={{ "--i": 4 } as CSSProperties}>
            {cta_texto && <Boton href={cta_href || "#como-lo-hacemos"}>{cta_texto}</Boton>}
            {cta2_texto && (
              <Boton href={cta2_href || "/tienda"} variante="fantasma" flecha={false}>
                {cta2_texto}
              </Boton>
            )}
          </div>
        )}
      </motion.div>

      {pasos.length > 1 && (
        <ol className="nh-ruta" aria-label="El recorrido de tu pedido">
          {pasos.map((p, i) => (
            <li key={`${p}-${i}`} style={{ "--i": i } as CSSProperties}>
              <span>{p}</span>
            </li>
          ))}
          <span className="nh-ruta-punto" aria-hidden="true" style={{ "--pasos": pasos.length } as CSSProperties} />
        </ol>
      )}
    </section>
  );
}
