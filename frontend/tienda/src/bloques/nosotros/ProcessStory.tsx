"use client";

import { motion, useMotionValueEvent, useScroll, type MotionValue } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";
import { useRango, useVentana } from "./mapeo";
import { Medio, tieneMedio, type MedioDatos } from "./Medio";

/**
 * Así funciona La Gran Cosecha: el proceso contado con el scroll.
 *
 * Un escenario queda fijo a pantalla completa mientras el visitante baja, y
 * cada tramo de scroll es una escena: 01 antes de que amanezca, 02
 * seleccionamos, 03 organizamos, 04 entregamos, 05 tú te concentras en tu
 * negocio. Al entrar, la foto de la escena aparece en una ventana pequeña y
 * se abre hasta ocupar la pantalla (máscara + escala), mientras el titular
 * sube línea a línea.
 *
 * # La luz cuenta la hora
 *
 * Cada escena tiene un `tono` —noche, alba, día, claro— que tiñe el fondo.
 * Recorrer el bloque es pasar de la madrugada a la mañana en el negocio del
 * cliente, sin escribir ni una hora concreta que la empresa no haya dicho.
 *
 * # Escenas sin foto
 *
 * No hay todavía fotografía real de la madrugada en el abasto ni de una
 * entrega, y no se inventa: una escena sin medio se cuenta con tipografía y
 * luz (el número enorme en contorno, el tono de la hora). En cuanto el negocio
 * suba la foto o el video de esa escena, aparece sin tocar el código.
 *
 * Con `prefers-reduced-motion` no hay escenario fijo: cada escena es un panel
 * apilado, con todo su contenido.
 */
export interface Escena extends MedioDatos {
  etiqueta?: string;
  titulo?: string;
  texto?: string;
  tono?: "noche" | "alba" | "dia" | "claro";
}

interface Props {
  ancla?: string;
  kicker?: string;
  titulo?: string;
  escenas?: Escena[];
}

const TONOS = ["noche", "alba", "dia", "claro"] as const;
const tonoDe = (t?: string) => (TONOS.includes(t as (typeof TONOS)[number]) ? t : "noche");

export function ProcessStory({ ancla = "como-lo-hacemos", kicker = "", titulo = "", escenas = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const quieto = useSinMovimiento();
  const lista = escenas.filter((e) => e.titulo);
  const total = lista.length;
  const [activa, setActiva] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (total === 0) return;
    setActiva(Math.min(total - 1, Math.max(0, Math.floor(v * total))));
  });

  if (total === 0) return null;

  const cabecera = (kicker || titulo) && (
    <header className="cmp-inner np-cabecera">
      {kicker && <p className="cmp-kicker">{kicker}</p>}
      {titulo && <h2>{titulo}</h2>}
    </header>
  );

  if (quieto) {
    return (
      <section id={ancla || undefined} className="np np--estatico">
        <TipografiaEditorial />
        {cabecera}
        {lista.map((e, i) => (
          <article key={`${e.titulo}-${i}`} className={`np-panel np-tono--${tonoDe(e.tono)}`}>
            {tieneMedio(e) && <Medio {...e} className="np-medio" />}
            <div className="np-velo" aria-hidden="true" />
            <div className="cmp-inner np-texto">
              <p className="np-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</p>
              {e.etiqueta && <p className="cmp-kicker">{e.etiqueta}</p>}
              <h3>{e.titulo}</h3>
              {e.texto && <p className="np-parrafo">{e.texto}</p>}
            </div>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section id={ancla || undefined} className="np">
      <TipografiaEditorial />
      {cabecera}
      <div ref={ref} className="np-pista" style={{ "--escenas": total } as CSSProperties}>
        <div className={`np-escenario np-tono--${tonoDe(lista[activa]?.tono)}`}>
          {lista.map((e, i) => (
            <Ventana key={`${e.titulo}-${i}`} escena={e} indice={i} total={total} progreso={scrollYProgress} activa={i === activa} />
          ))}
          <div className="np-velo" aria-hidden="true" />

          <div className="cmp-inner np-marco">
            <div className="np-textos">
              {lista.map((e, i) => (
                <article
                  key={`${e.titulo}-${i}`}
                  className={`np-texto ${i === activa ? "activo" : i < activa ? "pasado" : ""}`}
                  aria-hidden={i === activa ? undefined : true}
                >
                  <p className="np-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</p>
                  {e.etiqueta && <p className="cmp-kicker">{e.etiqueta}</p>}
                  <h3>
                    {(e.titulo ?? "").split(/(?<=[.,:])\s+/).map((linea, j) => (
                      <span className="np-linea" key={j}>
                        <span style={{ "--j": j } as CSSProperties}>{linea}</span>
                      </span>
                    ))}
                  </h3>
                  {e.texto && <p className="np-parrafo">{e.texto}</p>}
                </article>
              ))}
            </div>

            <ol className="np-riel" aria-hidden="true">
              {lista.map((e, i) => (
                <li key={`${e.etiqueta}-${i}`} className={i === activa ? "activo" : i < activa ? "hecho" : ""}>
                  <i />
                  <span>{e.etiqueta || String(i + 1).padStart(2, "0")}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * La ventana de una escena: aparece pequeña y redondeada y se abre hasta
 * ocupar el escenario mientras su tramo de scroll avanza. Solo `clip-path` y
 * `transform` — nada que obligue al navegador a recalcular el layout.
 */
function Ventana({
  escena,
  indice,
  total,
  progreso,
  activa,
}: {
  escena: Escena;
  indice: number;
  total: number;
  progreso: MotionValue<number>;
  activa: boolean;
}) {
  const inicio = indice / total;
  const medio = (indice + 0.55) / total;
  const recorte = useVentana(progreso, [inicio, medio], [22, 26], 28);
  const escala = useRango(progreso, [inicio, (indice + 1) / total], [1.18, 1.02]);

  if (!tieneMedio(escena)) return null;
  return (
    <motion.div
      className={`np-ventana ${activa ? "activa" : ""}`}
      style={indice === 0 ? { scale: escala } : { clipPath: recorte, scale: escala }}
    >
      <Medio {...escena} activo={activa} prioridad={indice === 0} className="np-medio" />
    </motion.div>
  );
}
