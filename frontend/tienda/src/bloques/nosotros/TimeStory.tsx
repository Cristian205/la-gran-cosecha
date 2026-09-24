"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import { Boton, TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";

/**
 * Tu tiempo vale más.
 *
 * Sin una sola cifra: el tiempo se VE pasar. Mientras el scroll baja, cada
 * tarea que el negocio tendría que hacer por su cuenta (ir al mercado,
 * buscar, comparar, comprar, cargar, transportar, regresar) se enciende y
 * luego se tacha, y la manecilla de un reloj sin números da vueltas. Cuando
 * se acaban las tareas aparece lo que costaron: "Tu negocio sigue
 * esperando." Y al final la escena cambia de luz: "Nosotros hacemos esa
 * parte por ti", con el botón para hacerlo.
 *
 * Las tres fases (tareas, espera, respuesta) están siempre en el HTML; el
 * scroll solo decide cuál se ve. Con menos movimiento se muestran seguidas.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  tareas?: string[];
  espera?: string;
  respuesta?: string;
  respuesta_resaltada?: string;
  cta_texto?: string;
  cta_href?: string;
}

export function TimeStory({
  kicker = "",
  titulo = "",
  tareas = [],
  espera = "",
  respuesta = "",
  respuesta_resaltada = "",
  cta_texto = "",
  cta_href = "/tienda",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const quieto = useSinMovimiento();
  const lista = tareas.filter(Boolean);
  const n = lista.length;
  const [paso, setPaso] = useState(-1);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Las tareas ocupan el 70 % del recorrido; la espera y la respuesta, el resto.
  const giro = useTransform(scrollYProgress, [0, 0.72], [0, 360 * 3]);
  const giroHora = useTransform(scrollYProgress, [0, 0.72], [0, 270]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v >= 0.84) setPaso(n + 1);
    else if (v >= 0.72) setPaso(n);
    else setPaso(Math.min(n - 1, Math.floor((v / 0.72) * n)));
  });

  if (!titulo || n === 0) return null;

  const fase = quieto ? "todo" : paso >= n + 1 ? "respuesta" : paso >= n ? "espera" : "tareas";

  return (
    <section className={`nt nt--${fase}`} aria-label={titulo}>
      <TipografiaEditorial />
      <div ref={ref} className="nt-pista" style={{ "--tareas": n } as CSSProperties}>
        <div className="nt-escenario">
          <div className="cmp-inner nt-grid">
            <div className="nt-izq">
              {kicker && <p className="cmp-kicker">{kicker}</p>}
              <h2>{titulo}</h2>
              {/* La esfera es SVG; las manecillas, elementos HTML: rotar una
                  línea SVG con Motion la gira sobre su propia caja y no sobre el
                  centro del reloj. */}
              <div className="nt-reloj" aria-hidden="true">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" />
                  {Array.from({ length: 12 }, (_, i) => (
                    <line key={i} x1="60" y1="10" x2="60" y2={i % 3 === 0 ? 18 : 14} transform={`rotate(${i * 30} 60 60)`} />
                  ))}
                </svg>
                <motion.i className="nt-aguja nt-aguja--hora" style={quieto ? undefined : { rotate: giroHora }} />
                <motion.i className="nt-aguja nt-aguja--minuto" style={quieto ? undefined : { rotate: giro }} />
                <b className="nt-eje" />
              </div>
            </div>

            <div className="nt-der">
              <ol className="nt-tareas">
                {lista.map((t, i) => (
                  <li
                    key={`${t}-${i}`}
                    className={quieto ? "" : i < paso ? "hecha" : i === paso ? "actual" : ""}
                  >
                    <span className="nt-tarea-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <span className="nt-tarea-texto">{t}</span>
                  </li>
                ))}
              </ol>
              {espera && <p className="nt-espera">{espera}</p>}
            </div>
          </div>

          {(respuesta || respuesta_resaltada) && (
            <div className="nt-respuesta">
              <div className="cmp-inner">
                <p className="nt-respuesta-texto">
                  {respuesta}
                  {respuesta_resaltada && <em> {respuesta_resaltada}</em>}
                </p>
                {cta_texto && <Boton href={cta_href || "/tienda"} variante="oscuro">{cta_texto}</Boton>}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
