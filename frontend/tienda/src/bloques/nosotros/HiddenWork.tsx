"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { OndaOrganica } from "@/componentes/decoracion/OndaOrganica";
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
 * En el móvil la cadena no corre en horizontal (una sola palabra a la vista
 * y media pantalla vacía): se apila en vertical y se centra en el paso
 * actual, con los hechos arriba y los que faltan abajo, unidos por una línea
 * que se enciende.
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
  const escenario = useRef<HTMLDivElement>(null);
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
    // El avance total como variable CSS (sin re-render): con él amanece la luz
    // del fondo a medida que la cadena llega a la entrega.
    const avance = Math.min(1, Math.max(0, (v - 0.05) / 0.87));
    escenario.current?.style.setProperty("--avance", avance.toFixed(3));
  });

  if (lista.length < 2) return null;
  const ultimo = lista.length - 1;

  return (
    <section className={`ni ${quieto ? "ni--estatico" : ""}`} aria-label={titulo_hacemos}>
      <TipografiaEditorial />
      <div ref={seccion} className="ni-pista-scroll" style={{ "--pasos": lista.length } as CSSProperties}>
        <div ref={escenario} className="ni-escenario">
          {/* La luz que amanece con el avance de la cadena. */}
          <div className="ni-luz" aria-hidden="true" />
          <div className="cmp-inner ni-cabecera">
            {kicker && <p className="cmp-kicker">{kicker}</p>}
            {/* El paso en curso, como un odómetro: «03 / 08». */}
            {!quieto && (
              <p className="ni-contador" aria-hidden="true">
                <span className="ni-contador-rueda" style={{ "--actual": actual } as CSSProperties}>
                  {lista.map((_, i) => (
                    <span key={i}>{String(i + 1).padStart(2, "0")}</span>
                  ))}
                </span>
                <span className="ni-contador-total">/ {String(lista.length).padStart(2, "0")}</span>
              </p>
            )}
          </div>

          <div className="ni-cuerpo">
            <div className="ni-ves">
              <p className="cmp-kicker">{titulo_ves}</p>
              <p className="ni-ves-texto">{ves || lista[ultimo]}</p>
              <p className="ni-ves-pie" aria-hidden="true">
                1 momento <span>·</span> {lista.length} pasos detrás
              </p>
            </div>

            <div className="ni-hacemos">
              <p className="cmp-kicker ni-hacemos-titulo">{titulo_hacemos}</p>
              {/* La máscara va solo sobre la pista, no sobre el título. */}
              {/* `--actual`: en el móvil la cadena es vertical y se centra en el
                  paso actual (ver nosotros.css); en escritorio no se usa. */}
              <div className="ni-ventana" ref={ventana} style={{ "--actual": actual } as CSSProperties}>
                <motion.ol ref={pista} className="ni-pasos" style={quieto ? undefined : { x }}>
                  {lista.map((p, i) => (
                    <li
                      key={`${p}-${i}`}
                      className={[
                        i === ultimo ? "ni-paso--ves" : "",
                        !quieto && i <= actual ? "encendido" : "",
                        !quieto && i === actual ? "actual" : "",
                        !quieto && i < actual ? "pasado" : "",
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
                <span className="ni-linea" aria-hidden="true" style={{ "--pasos": lista.length } as CSSProperties}>
                  <motion.i style={{ width: linea }} />
                </span>
              )}
            </div>
          </div>

          {nota_final && (
            <p className={`cmp-inner ni-nota ${quieto || actual === ultimo ? "visible" : ""}`}>{nota_final}</p>
          )}
          <OndaOrganica className="ni-onda" relleno="#0f3a24" trazo="#c9a646" espejo />
        </div>
      </div>
    </section>
  );
}
