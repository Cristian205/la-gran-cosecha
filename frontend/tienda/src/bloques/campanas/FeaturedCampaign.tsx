"use client";

import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { claseDeVariante } from "../Seccion";
import { Boton, useParallax } from "./comunes";

/**
 * Campaña de imagen gigante: la fotografía ocupa la pantalla y el texto es
 * mínimo. Es la pieza para "esta semana toca esto", sin precio ni ficha —
 * quien quiere el detalle sigue el enlace.
 *
 * `gigante` es la composición alta (móvil casi vertical); `cinematico` es un
 * banner ancho y bajo, para cortar el ritmo entre dos secciones más densas.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  texto?: string;
  imagen?: string;
  imagen_movil?: string;
  imagen_alt?: string;
  enfoque?: string;
  enfoque_movil?: string;
  cta_texto?: string;
  cta_href?: string;
  alineacion?: "izquierda" | "centro";
  variante?: string;
}

const VARIANTES = ["gigante", "cinematico"] as const;

export function FeaturedCampaign({
  kicker = "",
  titulo = "",
  texto = "",
  imagen = "",
  imagen_movil = "",
  imagen_alt = "",
  enfoque = "50% 50%",
  enfoque_movil = "",
  cta_texto = "",
  cta_href = "/tienda",
  alineacion = "izquierda",
  variante,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const movimiento = useParallax(ref, { desde: 1.08, hasta: 1.22, desplazamiento: 8 });

  if (!imagen || !titulo) return null;

  const clase = claseDeVariante(variante, VARIANTES, "fc", "gigante");
  const variables = {
    "--enfoque": enfoque,
    "--enfoque-movil": enfoque_movil || enfoque,
  } as CSSProperties;

  return (
    <section ref={ref} className={`fc ${clase} fc--${alineacion === "centro" ? "centro" : "izquierda"}`} style={variables}>
      <motion.div className="fc-media" style={movimiento}>
        <picture>
          {imagen_movil && <source media="(max-width: 780px)" srcSet={imagen_movil} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagen} alt={imagen_alt} loading="lazy" decoding="async" />
        </picture>
      </motion.div>
      <div className="fc-velo" aria-hidden="true" />
      <motion.div
        className="fc-texto"
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {kicker && <p className="cmp-kicker">{kicker}</p>}
        <h2>{titulo}</h2>
        {texto && <p className="fc-parrafo">{texto}</p>}
        {cta_texto && <Boton href={cta_href || "/tienda"}>{cta_texto}</Boton>}
      </motion.div>
    </section>
  );
}
