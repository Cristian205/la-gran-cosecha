"use client";

import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
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
 *
 * # Capítulos
 *
 * Cada escena es un capítulo con su propia composición —la apertura y el
 * cierre centrados, los del medio alternando texto a la izquierda y a la
 * derecha—, pero comparten un mismo lenguaje:
 *
 *   · la LUZ se funde de una hora a otra (capas superpuestas que cruzan su
 *     opacidad; un degradado no se puede transicionar);
 *   · un único NÚMERO gigante pasa de escena en escena como un odómetro y se
 *     muda de lado con la composición;
 *   · el titular entra palabra por palabra y, al cambiar de capítulo, sale
 *     hacia arriba;
 *   · las fotos se abren con su ventana, con zoom y parallax;
 *   · al pie, una ONDA orgánica cambia de forma en cada capítulo, con un
 *     ramito que la acompaña;
 *   · el riel se llena dentro del capítulo activo.
 *
 * Todo es `transform`/`opacity` (y el `d` de un solo trazo SVG al cambiar de
 * escena): nada recalcula el layout mientras se hace scroll.
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

type Composicion = "centro" | "izq" | "der";
/** Apertura y cierre centrados; los capítulos del medio alternan de lado. */
function composicionDe(i: number, total: number): Composicion {
  if (i === 0 || i === total - 1) return "centro";
  return i % 2 === 1 ? "izq" : "der";
}

/**
 * En el móvil cada capítulo tiene SU composición (no la de escritorio
 * encogida): apertura y cierre centrados sobre la luz; los del medio rotan
 * entre la foto arriba, la foto abajo y la foto como una tarjeta.
 */
type ComposicionMovil = "centro" | "arriba" | "abajo" | "tarjeta";
const ROTACION_MOVIL: ComposicionMovil[] = ["arriba", "abajo", "tarjeta"];
function composicionMovilDe(i: number, total: number): ComposicionMovil {
  if (i === 0 || i === total - 1) return "centro";
  return ROTACION_MOVIL[(i - 1) % ROTACION_MOVIL.length];
}

/**
 * Las formas de la onda del pie, una por capítulo (se repiten si hay más).
 * Mismos comandos en todas —M C C L L Z— para que Motion pueda interpolar el
 * trazo de una a otra.
 */
const ONDAS = [
  "M0 62C240 30 470 24 720 46C960 66 1200 70 1440 44L1440 120L0 120Z",
  "M0 40C260 70 520 78 760 52C980 30 1220 22 1440 58L1440 120L0 120Z",
  "M0 70C300 58 520 20 760 30C1000 40 1180 76 1440 64L1440 120L0 120Z",
  "M0 48C200 24 460 60 720 64C980 68 1240 30 1440 36L1440 120L0 120Z",
  "M0 56C280 72 500 44 740 40C980 36 1200 56 1440 50L1440 120L0 120Z",
];
const soloTrazo = (d: string) => d.replace(/L1440 120L0 120Z$/, "");

/** Las palabras del titular, por frase, cada una con su turno para entrar. */
function palabrasDe(titulo: string) {
  let j = 0;
  return titulo.split(/(?<=[.,:])\s+/).map((frase) =>
    frase
      .split(/\s+/)
      .filter(Boolean)
      .map((palabra) => ({ palabra, j: j++ }))
  );
}

export function ProcessStory({ ancla = "como-lo-hacemos", kicker = "", titulo = "", escenas = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const quieto = useSinMovimiento();
  const lista = escenas.filter((e) => e.titulo);
  const total = lista.length;
  const [activa, setActiva] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (total === 0) return;
    const i = Math.min(total - 1, Math.max(0, Math.floor(v * total)));
    setActiva(i);
    // El avance DENTRO del capítulo, como variable CSS (sin re-render): con
    // él se llena el riel.
    const local = Math.min(1, Math.max(0, v * total - i));
    escenario.current?.style.setProperty("--avance", local.toFixed(3));
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

  const tonoActivo = tonoDe(lista[activa]?.tono);
  const composicion = composicionDe(activa, total);
  const onda = ONDAS[activa % ONDAS.length];
  const curva = { duration: 1.3, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section id={ancla || undefined} className="np">
      <TipografiaEditorial />
      {cabecera}
      <div ref={ref} className="np-pista" style={{ "--escenas": total } as CSSProperties}>
        <div
          ref={escenario}
          className={`np-escenario np-tono--${tonoActivo}`}
          data-composicion={composicion}
          data-movil={composicionMovilDe(activa, total)}
          style={{ "--i": activa } as CSSProperties}
        >
          {/* La luz de cada hora, en capas que se funden entre sí. */}
          {TONOS.map((t) => (
            <div key={t} className={`np-luz np-luz--${t} ${t === tonoActivo ? "visible" : ""}`} aria-hidden="true" />
          ))}

          {lista.map((e, i) => (
            <Ventana key={`${e.titulo}-${i}`} escena={e} indice={i} total={total} progreso={scrollYProgress} activa={i === activa} />
          ))}
          <div className="np-velo" aria-hidden="true" />

          {/* El número del capítulo: uno solo, que rueda y se muda de lado. */}
          <div className="np-numero" aria-hidden="true">
            <span className="np-numero-rueda">
              {lista.map((_, i) => (
                <span key={i}>{String(i + 1).padStart(2, "0")}</span>
              ))}
            </span>
          </div>

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
                  <h3 aria-label={e.titulo}>
                    {palabrasDe(e.titulo ?? "").map((frase, f) => (
                      <span className="np-linea" key={f} aria-hidden="true">
                        {frase.map(({ palabra, j }) => (
                          <span className="np-palabra" key={j}>
                            <span style={{ "--j": j } as CSSProperties}>{palabra}</span>
                          </span>
                        ))}
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

          {/* La onda del pie: cambia de forma con cada capítulo y el ramito la
              acompaña. Es lo que cose una escena con la siguiente. */}
          <svg className="np-onda" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <motion.path className="np-onda-relleno" initial={false} animate={{ d: onda }} transition={curva} />
            <motion.path
              className="np-onda-trazo"
              initial={false}
              animate={{ d: soloTrazo(onda) }}
              transition={curva}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <motion.svg
            className="np-ramito"
            viewBox="0 0 48 32"
            aria-hidden="true"
            focusable="false"
            initial={false}
            animate={{ rotate: activa % 2 === 0 ? -6 : 8, scale: 1 + (activa % 3) * 0.08 }}
            transition={curva}
          >
            <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 30C12 24 20 18 30 6" />
              <path d="M14 22C11 15 13 9 19 6C21 13 19 19 14 22Z" />
              <path d="M22 15C27 10 34 9 40 12C35 17 28 18 22 15Z" />
            </g>
          </motion.svg>
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
  // Parallax: la foto se desliza más despacio que el scroll durante su tramo.
  const desplazamiento = useRango(progreso, [inicio, (indice + 1) / total], [4, -4]);
  const y = useTransform(desplazamiento, (v) => `${v}%`);

  if (!tieneMedio(escena)) return null;
  return (
    <motion.div
      className={`np-ventana ${activa ? "activa" : ""}`}
      style={indice === 0 ? { scale: escala, y } : { clipPath: recorte, scale: escala, y }}
    >
      <Medio {...escena} activo={activa} prioridad={indice === 0} className="np-medio" />
    </motion.div>
  );
}
