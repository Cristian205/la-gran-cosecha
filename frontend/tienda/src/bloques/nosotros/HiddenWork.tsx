"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";

/**
 * Hacer visible lo invisible.
 *
 * El cliente solo ve dos momentos: "pedido recibido" y "pedido entregado".
 * Este bloque pone delante todo lo que pasa en medio. A un lado, fijo, lo que
 * él ve —una entrega—; al otro, la cadena de trabajo (madrugada, búsqueda,
 * selección…) que avanza en horizontal mientras el scroll baja, hasta llegar
 * a la última palabra: la única que el cliente conocía.
 *
 * El desplazamiento se calcula con el ancho real de la pista (se vuelve a
 * medir al cambiar el tamaño de la ventana), así que admite cualquier número
 * de pasos. Con menos movimiento es una fila que se desliza a mano.
 */
interface Props {
  kicker?: string;
  titulo_ves?: string;
  ves?: string;
  titulo_hacemos?: string;
  pasos?: string[];
  nota_final?: string;
}

export function HiddenWork({
  kicker = "",
  titulo_ves = "Lo que tú ves",
  ves = "",
  titulo_hacemos = "Lo que nosotros hacemos",
  pasos = [],
  nota_final = "",
}: Props) {
  const seccion = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLOListElement>(null);
  const ventana = useRef<HTMLDivElement>(null);
  const quieto = useSinMovimiento();
  const [distancia, setDistancia] = useState(0);
  const [actual, setActual] = useState(0);
  const lista = pasos.filter(Boolean);

  useEffect(() => {
    const medir = () => {
      const p = pista.current;
      const v = ventana.current;
      if (p && v) setDistancia(Math.max(0, p.scrollWidth - v.clientWidth));
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (pista.current) obs.observe(pista.current);
    if (ventana.current) obs.observe(ventana.current);
    return () => obs.disconnect();
  }, [lista.length]);

  const { scrollYProgress } = useScroll({ target: seccion, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.92], [0, -distancia]);
  const linea = useTransform(scrollYProgress, [0.05, 0.92], ["0%", "100%"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const n = lista.length;
    if (n) setActual(Math.min(n - 1, Math.max(0, Math.floor(((v - 0.05) / 0.87) * n))));
  });

  if (lista.length < 2) return null;
  const ultimo = lista.length - 1;

  return (
    <section className={`ni ${quieto ? "ni--estatico" : ""}`} aria-label={titulo_hacemos}>
      <TipografiaEditorial />
      <div ref={seccion} className="ni-pista-scroll" style={{ "--pasos": lista.length } as CSSProperties}>
        <div className="ni-escenario">
          <div className="cmp-inner ni-cabecera">
            {kicker && <p className="cmp-kicker">{kicker}</p>}
          </div>

          <div className="ni-cuerpo">
            <div className="ni-ves">
              <p className="cmp-kicker">{titulo_ves}</p>
              <p className="ni-ves-texto">{ves || lista[ultimo]}</p>
            </div>

            <div className="ni-hacemos">
              <p className="cmp-kicker ni-hacemos-titulo">{titulo_hacemos}</p>
              {/* La máscara va solo sobre la pista, no sobre el título. */}
              <div className="ni-ventana" ref={ventana}>
                <motion.ol ref={pista} className="ni-pasos" style={quieto ? undefined : { x }}>
                  {lista.map((p, i) => (
                    <li
                      key={`${p}-${i}`}
                      className={[
                        i === ultimo ? "ni-paso--ves" : "",
                        !quieto && i <= actual ? "encendido" : "",
                      ].join(" ")}
                    >
                      <span className="ni-paso-num" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="ni-paso-texto">{p}</span>
                      {i < ultimo && <span className="ni-flecha" aria-hidden="true">→</span>}
                    </li>
                  ))}
                </motion.ol>
              </div>
              {!quieto && (
                <span className="ni-linea" aria-hidden="true">
                  <motion.i style={{ width: linea }} />
                </span>
              )}
            </div>
          </div>

          {nota_final && (
            <p className={`cmp-inner ni-nota ${quieto || actual === ultimo ? "visible" : ""}`}>{nota_final}</p>
          )}
        </div>
      </div>
    </section>
  );
}
