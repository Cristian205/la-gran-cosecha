"use client";

import { motion } from "motion/react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";

/**
 * Los valores, contados como comportamientos.
 *
 * Nada de "Misión / Visión / Valores" en tres cajas: cada compromiso es una
 * fila a todo el ancho con la palabra enorme —SELECCIÓN, PUNTUALIDAD…— que se
 * rellena de color al entrar en pantalla, y al lado lo que esa palabra
 * significa en la práctica para la operación del cliente.
 */
interface Compromiso {
  palabra?: string;
  frase?: string;
  texto?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  compromisos?: Compromiso[];
}

export function Compromisos({ kicker = "", titulo = "", compromisos = [] }: Props) {
  const quieto = useSinMovimiento();
  const lista = compromisos.filter((c) => c.palabra);
  if (lista.length === 0) return null;

  return (
    <section className="nc">
      <TipografiaEditorial />
      <div className="cmp-inner">
        {(kicker || titulo) && (
          <header className="nc-cabecera">
            {kicker && <p className="cmp-kicker">{kicker}</p>}
            {titulo && <h2>{titulo}</h2>}
          </header>
        )}
        <ol className="nc-lista">
          {lista.map((c, i) => (
            <motion.li
              key={`${c.palabra}-${i}`}
              className="nc-fila"
              initial="fuera"
              whileInView="dentro"
              // Ver TeamStory: la preferencia llega después de montar.
              animate={quieto ? "dentro" : undefined}
              viewport={{ once: true, amount: 0.55 }}
            >
              <span className="nc-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="nc-palabra">
                <span className="nc-palabra-contorno" aria-hidden="true">{c.palabra}</span>
                <motion.span
                  className="nc-palabra-relleno"
                  variants={{
                    // Márgenes negativos arriba y abajo: la tilde de
                    // SELECCIÓN sobresale de la caja y no debe quedar fuera.
                    fuera: { clipPath: "inset(-30% 100% -15% 0%)" },
                    dentro: { clipPath: "inset(-30% 0% -15% 0%)" },
                  }}
                  transition={{ duration: 1.1, ease: [0.77, 0, 0.175, 1] }}
                >
                  {c.palabra}
                </motion.span>
              </h3>
              <motion.div
                className="nc-significado"
                variants={{ fuera: { opacity: 0, y: 18 }, dentro: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {c.frase && <p className="nc-frase">{c.frase}</p>}
                {c.texto && <p className="nc-texto">{c.texto}</p>}
              </motion.div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
