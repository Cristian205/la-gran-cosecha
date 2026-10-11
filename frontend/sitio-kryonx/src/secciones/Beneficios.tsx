import { motion } from "motion/react";
import { Monitor, Smartphone } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { ICONOS } from "../componentes/iconos";
import { Revelar } from "../componentes/Revelar";
import { TiendaMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosBeneficios } from "../contenido/tipos";
import { usarTema } from "../contenido/usarContenido";
import { usarAutoavance } from "../hooks/usarAutoavance";

/**
 * Los beneficios como un índice editorial, no como una rejilla de tarjetas:
 * se leen de arriba abajo en un vistazo. Al lado, fija, la única promesa que
 * se puede demostrar en vez de contar —que la tienda se adapta sola al
 * móvil—, con la misma maqueta estrechándose y reordenándose.
 */
export function Beneficios({ datos, id }: { datos: DatosBeneficios; id: string }) {
  const tema = usarTema(datos.tema);
  const zona = useRef<HTMLDivElement>(null);
  const { indice: modo } = usarAutoavance(2, 2600, zona);

  function alMover(evento: MouseEvent<HTMLLIElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();
    evento.currentTarget.style.setProperty("--mx", `${evento.clientX - caja.left}px`);
    evento.currentTarget.style.setProperty("--my", `${evento.clientY - caja.top}px`);
  }

  return (
    <section className="seccion beneficios" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor beneficios__rejilla">
        <div className="beneficios__fijo">
          <Encabezado datos={datos} id={`${id}-titulo`} />

          <Revelar className="adaptable" retraso={0.15}>
            <div className="adaptable__escenario" ref={zona}>
              <motion.div
                className="adaptable__dispositivo"
                animate={{ width: modo ? "40%" : "100%", borderRadius: modo ? 26 : 14 }}
                transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
              >
                <TiendaMaqueta tema={tema} compacta />
              </motion.div>
            </div>
            <span className="adaptable__modos" aria-hidden="true">
              <span className={modo === 0 ? "activo" : ""}>
                <Monitor /> Escritorio
              </span>
              <span className={modo === 1 ? "activo" : ""}>
                <Smartphone /> Móvil
              </span>
            </span>
          </Revelar>
        </div>

        <ol className="beneficios__lista">
          {datos.beneficios.map((b, i) => {
            const Icono = ICONOS[b.icono];
            return (
              <motion.li
                key={b.titulo}
                className="beneficio"
                onMouseMove={alMover}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: (i % 4) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="beneficio__numero">{String(i + 1).padStart(2, "0")}</span>
                <span className="beneficio__icono">
                  <Icono aria-hidden="true" />
                </span>
                <span className="beneficio__texto">
                  <strong>{b.titulo}</strong>
                  <span>{b.texto}</span>
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
