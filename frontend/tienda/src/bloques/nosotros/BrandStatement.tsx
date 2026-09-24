"use client";

import { motion, useScroll } from "motion/react";
import { useRef } from "react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";
import { useRango, useVentana } from "./mapeo";
import { Medio, type MedioDatos } from "./Medio";

/**
 * El manifiesto: el momento visualmente más fuerte de la página.
 *
 * La fotografía empieza como una ventana pequeña en el centro y, mientras el
 * visitante baja, se abre hasta ocupar la pantalla entera; cuando ya es
 * pantalla completa aparece la frase: "No solo llevamos productos. Llevamos
 * tranquilidad a tu operación." El escenario queda fijo durante ese tramo
 * para que el gesto se vea completo.
 */
interface Props extends MedioDatos {
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
}

export function BrandStatement({ titulo = "", titulo_resaltado = "", texto = "", ...medio }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const quieto = useSinMovimiento();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const recorte = useVentana(scrollYProgress, [0, 0.55], [26, 30], 36);
  const escala = useRango(scrollYProgress, [0, 1], [1.25, 1]);
  const textoOpacidad = useRango(scrollYProgress, [0.45, 0.65], [0, 1]);
  const textoY = useRango(scrollYProgress, [0.45, 0.7], [40, 0]);

  if (!titulo) return null;

  return (
    <section className={`nm ${quieto ? "nm--estatico" : ""}`}>
      <TipografiaEditorial />
      <div ref={ref} className="nm-pista">
        <div className="nm-escenario">
          <motion.div className="nm-ventana" style={quieto ? undefined : { clipPath: recorte }}>
            <motion.div className="nm-foto" style={quieto ? undefined : { scale: escala }}>
              <Medio {...medio} className="nm-medio" />
            </motion.div>
            <div className="nm-velo" aria-hidden="true" />
          </motion.div>

          <motion.div className="cmp-inner nm-texto" style={quieto ? undefined : { opacity: textoOpacidad, y: textoY }}>
            <h2>
              <span>{titulo}</span>
              {titulo_resaltado && <em>{titulo_resaltado}</em>}
            </h2>
            {texto && <p>{texto}</p>}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
