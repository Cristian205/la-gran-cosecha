import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { Code2, PenTool, Rocket, Search, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { Revelar } from "../componentes/Revelar";
import type { DatosProceso } from "../contenido/tipos";

/** Un icono por etapa, en el orden en que se cuentan. */
const ICONOS: LucideIcon[] = [Search, PenTool, Code2, Rocket];

/**
 * Escena 06. No es una lista: es un recorrido. Una línea se va llenando de
 * verde a medida que se baja por la escena y cada etapa se enciende cuando la
 * línea la alcanza. En escritorio las etapas van en horizontal; en el móvil,
 * en vertical, con la línea al costado.
 *
 * Con «menos movimiento» la línea aparece ya llena y las etapas ya
 * encendidas: no hay nada que animar para entender el orden.
 */
export function Proceso({ datos, id }: { datos: DatosProceso; id: string }) {
  const zona = useRef<HTMLOListElement>(null);
  const reducido = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: zona, offset: ["start 85%", "end 55%"] });
  const progreso = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const llenado = useTransform(progreso, (v) => (reducido ? 1 : v));

  return (
    <section className="seccion escena--nube2 proceso" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <div className="etapas">
          <span className="etapas__riel" aria-hidden="true">
            <motion.i style={{ scaleX: llenado, scaleY: llenado }} />
          </span>
          <ol className="etapas__lista" ref={zona}>
          {datos.etapas.map((etapa, i) => {
            const Icono = ICONOS[i % ICONOS.length]!;
            return (
              <li key={etapa.numero} className="etapa">
                <Revelar retraso={i * 0.1} desde={36}>
                  <span className="etapa__numero" aria-hidden="true">
                    {etapa.numero}
                  </span>
                  <span className="etapa__icono" aria-hidden="true">
                    <Icono />
                  </span>
                  <h3 className="etapa__titulo">
                    <span className="sr-solo">{etapa.numero}. </span>
                    {etapa.titulo}
                  </h3>
                  <p className="etapa__texto">{etapa.texto}</p>
                </Revelar>
              </li>
            );
          })}
          </ol>
        </div>
      </div>
    </section>
  );
}
