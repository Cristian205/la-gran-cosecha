import { AnimatePresence, motion } from "motion/react";
import { CalendarClock } from "lucide-react";
import { useRef } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { Marco } from "../componentes/Marco";
import { Revelar } from "../componentes/Revelar";
import { TiendaMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosCampanas } from "../contenido/tipos";
import { usarTema } from "../contenido/usarContenido";
import { usarAutoavance } from "../hooks/usarAutoavance";

const INTERVALO = 4200;

/**
 * La misma tienda, seis campañas. A la izquierda el calendario —que es como
 * se piensa una campaña: por fechas—; a la derecha la portada cambiando de
 * pieza publicitaria con su barra de anuncio. El mensaje es que el marketing
 * no vive fuera de la tienda: se programa dentro.
 */
export function Campanas({ datos, id }: { datos: DatosCampanas; id: string }) {
  const tema = usarTema(datos.tema);
  const zona = useRef<HTMLDivElement>(null);
  const { indice, elegir, corriendo } = usarAutoavance(datos.campanas.length, INTERVALO, zona);
  const campana = datos.campanas[indice];

  if (!campana) return null;

  return (
    <section className="seccion campanas" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="campanas__halo" aria-hidden="true" style={{ background: campana.colores[1] }} />
      <div className="contenedor campanas__rejilla" ref={zona}>
        <div className="campanas__columna">
          <Encabezado datos={datos} id={`${id}-titulo`} />

          <Revelar retraso={0.2} className="campanas__calendario">
            <ol className="calendario" aria-label="Campañas programadas">
              {datos.campanas.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`calendario__item ${i === indice ? "activo" : ""}`}
                    aria-current={i === indice}
                    onClick={() => elegir(i)}
                  >
                    <span className="calendario__punto" style={{ background: c.colores[1] }} />
                    <span className="calendario__nombre">{c.nombre}</span>
                    <span className="calendario__fecha">{c.fecha}</span>
                    {i === indice && corriendo && (
                      <motion.i
                        key={indice}
                        className="calendario__progreso"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: INTERVALO / 1000, ease: "linear" }}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </Revelar>
        </div>

        <Revelar className="campanas__escena" retraso={0.1} desde={40}>
          <Marco dominio={`${tema.nombre.toLowerCase().replace(/\s+/g, "")}.kryonx.co`} className="campanas__marco">
            <TiendaMaqueta tema={tema} campana={campana} compacta />
          </Marco>

          <AnimatePresence mode="wait">
            <motion.span
              key={campana.id}
              className="campanas__programada"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <CalendarClock aria-hidden="true" />
              <span>
                <small>{campana.nombre}</small>
                {campana.fecha}
              </span>
            </motion.span>
          </AnimatePresence>
        </Revelar>
      </div>
    </section>
  );
}
