import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { FUENTES } from "../componentes/fuentes";
import { Marco } from "../componentes/Marco";
import { TiendaMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosTiendas, TemaTienda } from "../contenido/tipos";
import { usarTemas } from "../contenido/usarContenido";
import { usarMedia } from "../hooks/usarMedia";

/**
 * Seis negocios, seis tiendas que no se parecen.
 *
 * En escritorio la sección se fija y el scroll vertical la recorre en
 * horizontal: la vitrina se mira de una en una, como se pasearía por una
 * galería. En el móvil —o con movimiento reducido— es un carrusel nativo con
 * imán, que el pulgar ya sabe usar y no secuestra el scroll de nadie.
 */
export function Tiendas({ datos, id }: { datos: DatosTiendas; id: string }) {
  const temas = usarTemas(datos.temas);
  const fijada = usarMedia("(min-width: 960px) and (prefers-reduced-motion: no-preference)");

  return (
    <section
      className={`seccion tiendas ${fijada ? "tiendas--fijada" : ""}`}
      id={id}
      aria-labelledby={`${id}-titulo`}
    >
      {fijada ? (
        <Galeria datos={datos} temas={temas} id={id} />
      ) : (
        <>
          <div className="contenedor">
            <Encabezado datos={datos} id={`${id}-titulo`} />
          </div>
          <div className="tiendas__pista tiendas__pista--nativa">
            {temas.map((tema, i) => (
              <Vitrina key={tema.id} tema={tema} posicion={i} total={temas.length} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Galeria({ datos, temas, id }: { datos: DatosTiendas; temas: TemaTienda[]; id: string }) {
  const seccion = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const [recorrido, setRecorrido] = useState(0);

  useLayoutEffect(() => {
    const medir = () => {
      if (!pista.current) return;
      setRecorrido(Math.max(0, pista.current.scrollWidth - window.innerWidth));
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (pista.current) observador.observe(pista.current);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: seccion, offset: ["start start", "end end"] });
  const suave = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });
  const x = useTransform(suave, (v) => -v * recorrido);

  return (
    <div
      ref={seccion}
      className="tiendas__recorrido"
      // Tanto scroll vertical como desplazamiento horizontal hay, más una
      // pantalla para que la última vitrina se quede quieta un momento.
      style={{ height: `calc(${recorrido}px + 100vh)` }}
    >
      <div className="tiendas__fijo">
        <motion.div className="tiendas__pista" ref={pista} style={{ x }}>
          <div className="tiendas__intro">
            <Encabezado datos={datos} id={`${id}-titulo`} />
          </div>
          {temas.map((tema, i) => (
            <Vitrina key={tema.id} tema={tema} posicion={i} total={temas.length} />
          ))}
        </motion.div>
        <div className="tiendas__barra" aria-hidden="true">
          <motion.i style={{ scaleX: suave }} />
        </div>
      </div>
    </div>
  );
}

function Vitrina({ tema, posicion, total }: { tema: TemaTienda; posicion: number; total: number }) {
  const estilo = { "--v-acento": tema.acento === tema.texto ? tema.hero.objeto[0] : tema.acento } as CSSProperties;
  return (
    <article className="vitrina" style={estilo}>
      <Marco dominio={`${tema.nombre.toLowerCase().replace(/\s+/g, "")}.kryonx.co`} className="vitrina__marco">
        <TiendaMaqueta tema={tema} compacta />
      </Marco>
      <div className="vitrina__pie">
        <span className="vitrina__numero">
          {String(posicion + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <h3 className="vitrina__rubro" style={{ fontFamily: FUENTES[tema.fuente].css }}>
          {tema.rubro}
        </h3>
        <span className="vitrina__nombre">{tema.nombre}</span>
        <ul className="vitrina__rasgos">
          {tema.rasgos.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <span className="vitrina__colores" aria-hidden="true">
          {[tema.fondo, tema.superficie, tema.acento, tema.texto].map((c, i) => (
            <i key={i} style={{ background: c }} />
          ))}
        </span>
      </div>
    </article>
  );
}
