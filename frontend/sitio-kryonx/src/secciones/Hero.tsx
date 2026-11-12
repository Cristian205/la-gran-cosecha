import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check, Palette } from "lucide-react";
import { Fragment, useRef, type MouseEvent, type ReactNode } from "react";
import { Boton } from "../componentes/Boton";
import { FUENTES } from "../componentes/fuentes";
import { Marco } from "../componentes/Marco";
import { Objeto } from "../componentes/Objeto";
import { TiendaMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosHero } from "../contenido/tipos";
import { usarTemas } from "../contenido/usarContenido";
import { usarAutoavance } from "../hooks/usarAutoavance";

const SUAVE = [0.22, 1, 0.36, 1] as const;

/**
 * Escena 01. La tienda es la protagonista: una ventana de navegador con una
 * tienda que cambia de identidad cada pocos segundos y, delante, el teléfono
 * con la siguiente. Nada de un computador genérico: lo que se ve es lo que la
 * gente va a comprar.
 *
 * El movimiento es poco y tiene dueño: la ventana se endereza al bajar (de
 * maqueta inclinada a pantalla de trabajo) y las piezas flotantes siguen al
 * puntero a distinta distancia, que es lo que da profundidad. Con «menos
 * movimiento» nada de esto se inclina ni sigue al puntero.
 */
export function Hero({ datos, id }: { datos: DatosHero; id: string }) {
  const temas = usarTemas(datos.temas);
  const escena = useRef<HTMLDivElement>(null);
  const reducido = useReducedMotion();
  const { indice } = usarAutoavance(temas.length, 4200, escena);
  const tema = temas[indice];
  const otro = temas[(indice + 1) % temas.length];

  const { scrollYProgress } = useScroll({ target: escena, offset: ["start end", "end start"] });
  const giro = useTransform(scrollYProgress, [0.1, 0.5], [reducido ? 0 : 14, 0]);
  const escala = useTransform(scrollYProgress, [0.1, 0.5], [reducido ? 1 : 0.93, 1]);

  const px = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const py = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });

  function alMover(evento: MouseEvent<HTMLElement>) {
    if (reducido) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    px.set((evento.clientX - caja.left) / caja.width - 0.5);
    py.set((evento.clientY - caja.top) / caja.height - 0.5);
  }

  if (!tema) return null;
  const palabras = datos.titulo.split(" ");

  return (
    <section className="hero escena--oscura" id={id} onMouseMove={alMover} aria-labelledby="hero-titulo">
      <div className="hero__fondo" aria-hidden="true">
        <div className="hero__rejilla" />
        <div className="hero__luz hero__luz--a" />
        <div className="hero__luz hero__luz--b" />
      </div>

      <div className="hero__interior contenedor">
        <div className="hero__texto">
          <motion.p
            className="hero__lema"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: SUAVE, delay: 0.15 }}
          >
            <i aria-hidden="true" />
            {datos.lema}
          </motion.p>

          <h1 className="hero__titulo" id="hero-titulo">
            {/* El espacio va FUERA de la máscara: dentro de un inline-block el
                espacio final se colapsa y las palabras quedan pegadas. */}
            {palabras.map((palabra, i) => (
              <Fragment key={i}>
                <span className="mascara">
                  <motion.span
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1, ease: SUAVE, delay: 0.25 + i * 0.06 }}
                  >
                    {palabra}
                  </motion.span>
                </span>{" "}
              </Fragment>
            ))}
            <span className="mascara">
              <motion.em
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1, ease: SUAVE, delay: 0.25 + palabras.length * 0.06 }}
              >
                {datos.destacado}
              </motion.em>
            </span>
          </h1>

          <motion.p
            className="hero__subtitulo"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: SUAVE, delay: 0.7 }}
          >
            {datos.subtitulo}
          </motion.p>

          <motion.div
            className="hero__acciones"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: SUAVE, delay: 0.85 }}
          >
            <Boton enlace={datos.ctaPrincipal} />
            <Boton enlace={datos.ctaSecundario} variante="secundario" />
          </motion.div>
        </div>

        <motion.div
          className="hero__escena"
          ref={escena}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: SUAVE, delay: 0.5 }}
        >
          <motion.div className="hero__inclinacion" style={{ rotateX: giro, scale: escala }}>
            <Marco dominio={datos.dominio} className="hero__marco">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tema.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <TiendaMaqueta tema={tema} compacta />
                </motion.div>
              </AnimatePresence>
            </Marco>
          </motion.div>

          {otro && (
            <Flotante x={px} y={py} fuerza={-14} className="hero__telefono" retraso={1}>
              <div className="telefono" aria-hidden="true">
                <span className="telefono__muesca" />
                <div className="telefono__pantalla">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={otro.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <TiendaMaqueta tema={otro} compacta />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </Flotante>
          )}

          <Flotante x={px} y={py} fuerza={30} className="hero__objeto hero__objeto--a" retraso={1.2}>
            <Objeto forma="cubo" color={tema.hero.objeto} />
          </Flotante>
          <Flotante x={px} y={py} fuerza={-26} className="hero__objeto hero__objeto--b" retraso={1.35}>
            <Objeto forma="gota" color={otro ? otro.hero.objeto : tema.hero.objeto} />
          </Flotante>

          <Flotante x={px} y={py} fuerza={-22} className="hero__ficha hero__ficha--paleta" retraso={1.5}>
            <span className="chip__titulo">
              <Palette aria-hidden="true" /> Paleta
            </span>
            <span className="chip__muestras">
              {temas.map((t) => (
                <i
                  key={t.id}
                  style={{ background: t.acento === t.texto ? t.hero.objeto[1] : t.acento }}
                  className={t.id === tema.id ? "activa" : ""}
                />
              ))}
            </span>
          </Flotante>

          <Flotante x={px} y={py} fuerza={26} className="hero__ficha hero__ficha--tipo" retraso={1.65}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={tema.fuente}
                className="chip__aa"
                style={{ fontFamily: FUENTES[tema.fuente].css }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                Aa
              </motion.span>
            </AnimatePresence>
            <span className="chip__nombre">{FUENTES[tema.fuente].nombre}</span>
          </Flotante>

          <Flotante x={px} y={py} fuerza={16} className="hero__ficha hero__ficha--publicado" retraso={1.8}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={tema.id}
                className="chip__publicada"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3 }}
              >
                <Check aria-hidden="true" /> {tema.nombre}
              </motion.span>
            </AnimatePresence>
          </Flotante>
        </motion.div>
      </div>
    </section>
  );
}

/** Una pieza que entra con retraso y se desplaza con el puntero a su propia distancia. */
function Flotante({
  x,
  y,
  fuerza,
  retraso,
  className,
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  fuerza: number;
  retraso: number;
  className: string;
  children: ReactNode;
}) {
  const tx = useTransform(x, (v) => v * fuerza);
  const ty = useTransform(y, (v) => v * fuerza);
  return (
    <motion.div
      className={`flotante ${className}`}
      style={{ x: tx, y: ty }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: SUAVE, delay: retraso }}
    >
      {children}
    </motion.div>
  );
}
