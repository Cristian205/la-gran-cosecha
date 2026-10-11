import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  Check,
  GripVertical,
  Image,
  Layers,
  LayoutGrid,
  Megaphone,
  Monitor,
  MousePointer2,
  Palette,
  Smartphone,
  Tablet,
  Type,
} from "lucide-react";
import { Fragment, useRef, type MouseEvent, type ReactNode } from "react";
import { Boton } from "../componentes/Boton";
import { FUENTES } from "../componentes/fuentes";
import { TiendaMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosHero, TemaTienda } from "../contenido/tipos";
import { usarTemas } from "../contenido/usarContenido";
import { usarAutoavance } from "../hooks/usarAutoavance";

const SUAVE = [0.22, 1, 0.36, 1] as const;

/**
 * El hero vende el constructor enseñándolo trabajar: una ventana del editor
 * en la que la misma tienda cambia de identidad cada pocos segundos, con el
 * panel de estilo siguiendo el cambio. Al bajar, la ventana se endereza —de
 * maqueta inclinada a pantalla de trabajo—, que es el gesto de "entrar".
 */
export function Hero({ datos, id }: { datos: DatosHero; id: string }) {
  const temas = usarTemas(datos.temas);
  const escena = useRef<HTMLDivElement>(null);
  const { indice } = usarAutoavance(temas.length, 3800, escena);
  const tema = temas[indice];

  /* Inclinación ligada al scroll. */
  const { scrollYProgress } = useScroll({ target: escena, offset: ["start end", "end start"] });
  const giro = useTransform(scrollYProgress, [0.15, 0.55], [16, 0]);
  const escala = useTransform(scrollYProgress, [0.15, 0.55], [0.92, 1]);

  /* Paralaje con el puntero: las piezas flotantes se mueven más que la ventana. */
  const px = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const py = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });

  function alMover(evento: MouseEvent<HTMLElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();
    px.set((evento.clientX - caja.left) / caja.width - 0.5);
    py.set((evento.clientY - caja.top) / caja.height - 0.5);
  }

  const palabras = datos.titulo.split(" ");

  return (
    <section className="hero" id={id} onMouseMove={alMover} aria-labelledby="hero-titulo">
      <div className="hero__fondo" aria-hidden="true">
        <div className="hero__rejilla" />
        <div className="hero__luz hero__luz--rojo" />
        <div className="hero__luz hero__luz--oro" />
      </div>

      <div className="hero__texto contenedor">
        <motion.span
          className="insignia"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: SUAVE, delay: 0.2 }}
        >
          <i className="insignia__punto" />
          {datos.insignia}
        </motion.span>

        <h1 className="hero__titulo" id="hero-titulo">
          {/* El espacio va FUERA de la máscara: dentro de un inline-block el
              espacio final se colapsa y las palabras quedan pegadas. */}
          {palabras.map((palabra, i) => (
            <Fragment key={i}>
              <span className="mascara">
                <motion.span
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, ease: SUAVE, delay: 0.3 + i * 0.07 }}
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
              transition={{ duration: 1, ease: SUAVE, delay: 0.3 + palabras.length * 0.07 }}
            >
              {datos.destacado}
            </motion.em>
          </span>
        </h1>

        <motion.p
          className="hero__subtitulo"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: SUAVE, delay: 0.75 }}
        >
          {datos.subtitulo}
        </motion.p>

        <motion.div
          className="hero__acciones"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: SUAVE, delay: 0.9 }}
        >
          <Boton enlace={datos.ctaPrincipal} />
          <Boton enlace={datos.ctaSecundario} variante="secundario" />
        </motion.div>
      </div>

      <motion.div
        className="hero__escena"
        ref={escena}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.3, ease: SUAVE, delay: 0.55 }}
      >
        <motion.div className="hero__inclinacion" style={{ rotateX: giro, scale: escala }}>
          <Editor tema={tema} temas={temas} dominio={datos.dominio} />
        </motion.div>

        <Flotante x={px} y={py} fuerza={-28} className="flotante--paleta" retraso={1.4}>
          <span className="flotante__titulo">
            <Palette /> Paleta
          </span>
          <span className="flotante__muestras">
            {temas.map((t) => (
              <i
                key={t.id}
                style={{ background: t.acento === t.texto ? t.hero.objeto[1] : t.acento }}
                className={t.id === tema.id ? "activa" : ""}
              />
            ))}
          </span>
        </Flotante>

        <Flotante x={px} y={py} fuerza={34} className="flotante--tipo" retraso={1.55}>
          <AnimatePresence mode="wait">
            <motion.span
              key={tema.fuente}
              className="flotante__aa"
              style={{ fontFamily: FUENTES[tema.fuente].css }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              Aa
            </motion.span>
          </AnimatePresence>
          <span className="flotante__fuente">{FUENTES[tema.fuente].nombre}</span>
        </Flotante>

        <Flotante x={px} y={py} fuerza={22} className="flotante--bloque" retraso={1.7}>
          <GripVertical className="flotante__agarre" />
          <span>
            <strong>Banner promocional</strong>
            <small>Arrastra para añadir</small>
          </span>
          <MousePointer2 className="flotante__cursor" />
        </Flotante>

        <Flotante x={px} y={py} fuerza={-18} className="flotante--publicado" retraso={1.85}>
          <AnimatePresence mode="wait">
            <motion.span
              key={tema.id}
              className="flotante__publicado"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35 }}
            >
              <Check /> {tema.nombre} publicada
            </motion.span>
          </AnimatePresence>
        </Flotante>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const SECCIONES = ["Anuncio", "Navbar", "Hero", "Categorías", "Productos", "Promoción", "Footer"];
const HERRAMIENTAS = [Layers, Type, Palette, Image, LayoutGrid, Megaphone];

function Editor({ tema, temas, dominio }: { tema: TemaTienda; temas: TemaTienda[]; dominio: string }) {
  const posicion = temas.findIndex((t) => t.id === tema.id);

  return (
    <div className="editor">
      <div className="editor__barra">
        <span className="marco__semaforo" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="editor__pagina">Inicio</span>
        <span className="editor__dispositivos" aria-hidden="true">
          <Monitor className="activo" />
          <Tablet />
          <Smartphone />
        </span>
        <span className="editor__dominio">{dominio}</span>
        <span className="editor__publicar">Publicar</span>
      </div>

      <div className="editor__cuerpo">
        <aside className="editor__riel" aria-hidden="true">
          {HERRAMIENTAS.map((Icono, i) => (
            <span key={i} className={i === posicion % HERRAMIENTAS.length ? "activo" : ""}>
              <Icono />
            </span>
          ))}
        </aside>

        <aside className="editor__panel editor__panel--capas" aria-hidden="true">
          <span className="editor__rotulo">Secciones</span>
          {SECCIONES.map((s, i) => (
            <span key={s} className={`editor__capa ${i === (posicion + 2) % SECCIONES.length ? "activa" : ""}`}>
              <GripVertical />
              {s}
            </span>
          ))}
        </aside>

        <div className="editor__lienzo">
          <TiendaMaqueta tema={tema} />
        </div>

        <aside className="editor__panel editor__panel--estilo" aria-hidden="true">
          <span className="editor__rotulo">Estilo</span>
          <span className="editor__campo">Color de marca</span>
          <span className="editor__muestras">
            {temas.map((t) => (
              <i key={t.id} style={{ background: t.acento === t.texto ? t.hero.objeto[1] : t.acento }}>
                {t.id === tema.id && <motion.b layoutId="muestra-activa" className="editor__anillo" />}
              </i>
            ))}
          </span>
          <span className="editor__campo">Tipografía</span>
          <span className="editor__selector" style={{ fontFamily: FUENTES[tema.fuente].css }}>
            {FUENTES[tema.fuente].nombre}
          </span>
          <span className="editor__campo">Esquinas</span>
          <span className="editor__deslizador">
            <motion.i animate={{ left: `${Math.min(100, (tema.radio / 2.2) * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 16 }} />
          </span>
          <span className="editor__campo">Fondo</span>
          <span className="editor__fondos">
            <i style={{ background: tema.fondo }} />
            <i style={{ background: tema.superficie }} />
            <i style={{ background: tema.texto }} />
          </span>
        </aside>
      </div>
    </div>
  );
}

function Flotante({
  x,
  y,
  fuerza,
  className,
  retraso,
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  fuerza: number;
  className: string;
  retraso: number;
  children: ReactNode;
}) {
  const dx = useTransform(x, (v) => v * fuerza);
  const dy = useTransform(y, (v) => v * fuerza);
  return (
    <motion.div className={`flotante ${className}`} style={{ x: dx, y: dy }} aria-hidden="true">
      <motion.div
        className="flotante__caja"
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: SUAVE, delay: retraso }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
