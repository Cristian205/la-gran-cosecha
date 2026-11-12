import { AnimatePresence, motion } from "motion/react";
import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { Marco } from "../componentes/Marco";
import { Revelar } from "../componentes/Revelar";
import { TiendaMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosExperiencias } from "../contenido/tipos";
import { usarTema } from "../contenido/usarContenido";
import { usarAutoavance } from "../hooks/usarAutoavance";

const SUAVE = [0.22, 1, 0.36, 1] as const;

/**
 * Escena 03. No es una rejilla de tarjetas iguales: es un escenario. A la
 * izquierda, las industrias como un índice editorial; a la derecha, la tienda
 * de la industria elegida sobre un fondo teñido con SU color, con el nombre
 * enorme detrás y el teléfono delante. Cambiar de industria cambia la luz de
 * toda la escena, que es lo que hace sentir que cada negocio tiene
 * personalidad propia.
 *
 * Avanza sola mientras está a la vista y se detiene para siempre en cuanto la
 * persona elige una: quitarle el control a quien explora es la forma más
 * rápida de que deje de hacerlo.
 */
export function Experiencias({ datos, id }: { datos: DatosExperiencias; id: string }) {
  const zona = useRef<HTMLDivElement>(null);
  const { indice, elegir, corriendo } = usarAutoavance(datos.industrias.length, 5400, zona);
  const industria = datos.industrias[indice];
  const tema = usarTema(industria?.tema ?? "");

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const paso = evento.key === "ArrowDown" || evento.key === "ArrowRight" ? 1 : evento.key === "ArrowUp" || evento.key === "ArrowLeft" ? -1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const siguiente = (indice + paso + datos.industrias.length) % datos.industrias.length;
    elegir(siguiente);
    document.getElementById(`${id}-pestana-${siguiente}`)?.focus();
  }

  if (!industria || !tema) return null;

  const estilo = {
    "--e-fondo": tema.fondo,
    "--e-acento": tema.acento,
    "--e-texto": tema.texto,
  } as CSSProperties;

  return (
    <section className="seccion escena--oscura experiencias" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <div className="experiencias__taller" ref={zona}>
          <Revelar className="experiencias__indice" desde={24}>
            <div role="tablist" aria-label="Industrias" onKeyDown={alTeclear}>
              {datos.industrias.map((ind, i) => {
                const activa = i === indice;
                return (
                  <button
                    key={ind.id}
                    id={`${id}-pestana-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={activa}
                    aria-controls={`${id}-escenario`}
                    tabIndex={activa ? 0 : -1}
                    className={`indice__fila ${activa ? "activa" : ""}`}
                    onClick={() => elegir(i)}
                  >
                    <span className="indice__numero">{String(i + 1).padStart(2, "0")}</span>
                    <span className="indice__texto">
                      <strong>{ind.nombre}</strong>
                      <AnimatePresence initial={false}>
                        {activa && (
                          <motion.small
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: SUAVE }}
                          >
                            {ind.descripcion}
                          </motion.small>
                        )}
                      </AnimatePresence>
                    </span>
                    {activa && corriendo && (
                      <motion.i
                        key={indice}
                        className="indice__progreso"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 5.4, ease: "linear" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Revelar>

          <Revelar className="experiencias__escenario" retraso={0.1} desde={40}>
            <div className="escenario" id={`${id}-escenario`} role="tabpanel" style={estilo}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`rotulo-${industria.id}`}
                  className="escenario__rotulo"
                  aria-hidden="true"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.5, ease: SUAVE }}
                >
                  {industria.nombre}
                </motion.span>
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`ventana-${industria.id}`}
                  className="escenario__ventana"
                  initial={{ opacity: 0, y: 28, rotate: -1.2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.55, ease: SUAVE }}
                >
                  <Marco dominio={`${tema.nombre.toLowerCase().replace(/\s+/g, "")}.com`}>
                    <TiendaMaqueta tema={tema} compacta />
                  </Marco>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`telefono-${industria.id}`}
                  className="escenario__telefono"
                  aria-hidden="true"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.55, ease: SUAVE, delay: 0.08 }}
                >
                  <div className="telefono">
                    <span className="telefono__muesca" />
                    <div className="telefono__pantalla">
                      <TiendaMaqueta tema={tema} compacta />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <ul className="escenario__rasgos">
                {tema.rasgos.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </Revelar>
        </div>
      </div>
    </section>
  );
}
