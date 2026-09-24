"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";
import { Medio, tieneMedio, type MedioDatos } from "./Medio";

/**
 * Detrás de cada pedido hay un equipo.
 *
 * Un mosaico editorial de piezas —foto o video— con su etiqueta: la
 * selección, la preparación, las personas, el vehículo, el producto, la
 * entrega. Cada pieza entra descubriéndose (máscara de abajo arriba).
 *
 * Solo se pintan las piezas que tienen medio: el mosaico crece a medida que el
 * negocio sube fotografía real, y nunca muestra un hueco ni una foto de banco
 * de imágenes haciéndose pasar por su equipo. Sin ninguna pieza, el bloque
 * queda en su mensaje, que se sostiene solo.
 */
export interface Pieza extends MedioDatos {
  etiqueta?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  piezas?: Pieza[];
}

export function TeamStory({ kicker = "", titulo = "", titulo_resaltado = "", texto = "", piezas = [] }: Props) {
  const quieto = useSinMovimiento();
  if (!titulo) return null;
  // Con menos movimiento todo aparece ya terminado, sin esperar a entrar en
  // vista. `animate` y no `initial`: la preferencia solo se conoce después de
  // montar (ver `useSinMovimiento`), cuando el estado inicial ya se aplicó.
  const conMedio = piezas.filter(tieneMedio).slice(0, 6);

  return (
    <section className={`ne ${conMedio.length ? "" : "ne--solo-texto"}`}>
      <TipografiaEditorial />
      <div className="cmp-inner">
        <motion.header
          className="ne-cabecera"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          animate={quieto ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2>
            {titulo}
            {titulo_resaltado && <em> {titulo_resaltado}</em>}
          </h2>
          {texto && <p className="ne-texto">{texto}</p>}
        </motion.header>

        {conMedio.length > 0 && (
          <div className={`ne-mosaico ne-mosaico--${conMedio.length}`}>
            {conMedio.map((p, i) => (
              // Disparador en el marco, recorte en el hijo: un elemento recortado
              // al 100 % no cuenta como visible y nunca dispararía su entrada.
              <motion.figure
                key={`${p.etiqueta}-${i}`}
                className="ne-pieza"
                style={{ "--i": i } as CSSProperties}
                initial="oculto"
                whileInView="visible"
                animate={quieto ? "visible" : undefined}
                viewport={{ once: true, amount: 0.3 }}
              >
                <motion.div
                  className="ne-recorte"
                  variants={{
                    oculto: { clipPath: "inset(100% 0% 0% 0% round 22px)" },
                    visible: { clipPath: "inset(0% 0% 0% 0% round 22px)" },
                  }}
                  transition={{ duration: 0.9, delay: (i % 3) * 0.08, ease: [0.77, 0, 0.175, 1] }}
                >
                  <Medio {...p} className="ne-medio" />
                  {p.etiqueta && <figcaption>{p.etiqueta}</figcaption>}
                </motion.div>
              </motion.figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
