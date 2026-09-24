"use client";

import { motion, useScroll, type MotionValue } from "motion/react";
import { useRef } from "react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";
import { useRango } from "./mapeo";

/**
 * Por qué existimos: el origen de la empresa, leído al ritmo del scroll.
 *
 * El párrafo está completo en el HTML (lo lee el buscador y el lector de
 * pantalla) y se "enciende" palabra por palabra mientras cruza la pantalla:
 * obliga a leerlo, que es el punto — es la razón de ser de todo lo demás.
 * Las `resaltadas` (palabras sueltas, sin tildes ni mayúsculas que importen)
 * se encienden en ámbar.
 *
 * `datos` es el espacio preparado para cifras REALES ("desde 2019", "300
 * negocios"): solo se pinta un dato que tenga valor. Hoy va vacío a
 * propósito — ninguna cifra se inventa.
 */
interface Dato {
  valor?: string;
  etiqueta?: string;
}

interface Props {
  ancla?: string;
  kicker?: string;
  texto?: string;
  resaltadas?: string[];
  firma?: string;
  datos?: Dato[];
}

function normal(p: string) {
  return p
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

export function StorySection({ ancla = "", kicker = "", texto = "", resaltadas = [], firma = "", datos = [] }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const quieto = useSinMovimiento();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });

  if (!texto) return null;

  const palabras = texto.split(/\s+/).filter(Boolean);
  const claves = new Set(resaltadas.map(normal));
  const reales = datos.filter((d) => d.valor && d.etiqueta);

  return (
    <section id={ancla || undefined} className="no">
      <TipografiaEditorial />
      <div className="cmp-inner no-inner">
        {kicker && <p className="cmp-kicker no-kicker">{kicker}</p>}
        <p ref={ref} className="no-texto">
          {palabras.map((p, i) => (
            <Palabra
              key={`${p}-${i}`}
              texto={p}
              resaltada={claves.has(normal(p))}
              progreso={scrollYProgress}
              rango={[i / palabras.length, (i + 1) / palabras.length]}
              quieto={quieto}
            />
          ))}
        </p>
        {firma && <p className="no-firma">{firma}</p>}
        {reales.length > 0 && (
          <dl className="no-datos">
            {reales.map((d, i) => (
              <div key={`${d.etiqueta}-${i}`}>
                <dt>{d.etiqueta}</dt>
                <dd>{d.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

function Palabra({
  texto,
  resaltada,
  progreso,
  rango,
  quieto,
}: {
  texto: string;
  resaltada: boolean;
  progreso: MotionValue<number>;
  rango: [number, number];
  quieto: boolean;
}) {
  const opacidad = useRango(progreso, rango, [0.16, 1]);
  return (
    <>
      <motion.span className={resaltada ? "no-clave" : undefined} style={{ opacity: quieto ? 1 : opacidad }}>
        {texto}
      </motion.span>{" "}
    </>
  );
}
