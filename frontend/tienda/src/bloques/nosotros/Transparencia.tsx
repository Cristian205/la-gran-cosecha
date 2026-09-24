"use client";

import { motion } from "motion/react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";

/**
 * El precio cambia. La transparencia no.
 *
 * Explica el "precio del día" sin una sola cifra: una línea que sube y baja
 * —el mercado— y, sobre ella, una recta que no se mueve —lo que el negocio le
 * promete al cliente—. Las dos se dibujan al entrar en pantalla.
 *
 * Los `puntos` son los de la política que la tienda ya publica en
 * `AvisoPrecios` (confirmar el valor antes de despachar, nunca cobrar algo
 * distinto sin avisar): esta sección la explica, no inventa otra.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  puntos?: string[];
  etiqueta_mercado?: string;
  etiqueta_promesa?: string;
}

const MERCADO =
  "M0 120 C 40 60, 70 170, 110 110 S 170 40, 210 95 S 270 175, 310 115 S 370 50, 410 100 S 470 160, 520 90 S 580 60, 620 105";

export function Transparencia({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  puntos = [],
  etiqueta_mercado = "El mercado del día",
  etiqueta_promesa = "Lo que te confirmamos",
}: Props) {
  const quieto = useSinMovimiento();
  if (!titulo) return null;
  const dibujo = quieto
    ? {}
    : {
        initial: { pathLength: 0 },
        whileInView: { pathLength: 1 },
        viewport: { once: true, amount: 0.5 },
      };

  return (
    <section className="nx">
      <TipografiaEditorial />
      <div className="cmp-inner nx-grid">
        <div className="nx-texto">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2>
            <span>{titulo}</span>
            {titulo_resaltado && <em>{titulo_resaltado}</em>}
          </h2>
          {texto && <p className="nx-parrafo">{texto}</p>}
          {puntos.length > 0 && (
            <ul className="nx-puntos">
              {puntos.filter(Boolean).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </div>

        <figure className="nx-grafico" aria-hidden="true">
          <svg viewBox="0 0 620 220" preserveAspectRatio="none">
            <motion.path className="nx-mercado" d={MERCADO} {...dibujo} transition={{ duration: 2.2, ease: "easeInOut" }} />
            <motion.path className="nx-promesa" d="M0 100 L 620 100" {...dibujo} transition={{ duration: 1.4, delay: 0.9, ease: "easeOut" }} />
          </svg>
          <figcaption>
            <span className="nx-leyenda nx-leyenda--mercado">{etiqueta_mercado}</span>
            <span className="nx-leyenda nx-leyenda--promesa">{etiqueta_promesa}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
