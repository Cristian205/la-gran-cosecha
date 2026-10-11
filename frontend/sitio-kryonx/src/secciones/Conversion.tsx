import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Boton } from "../componentes/Boton";
import { Revelar } from "../componentes/Revelar";
import type { DatosConversion } from "../contenido/tipos";
import monograma from "../assets/logo-kryonx-marca-inverso.png";

/**
 * El cierre. Poco texto y mucho aire: a estas alturas ya se ha visto todo, y
 * lo único que falta es el botón. El anillo detrás del monograma gira con el
 * scroll, no solo —un último movimiento que acompaña la llegada.
 */
export function Conversion({ datos, id }: { datos: DatosConversion; id: string }) {
  const zona = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: zona, offset: ["start end", "end end"] });
  const giro = useTransform(scrollYProgress, [0, 1], [-90, 0]);
  const escala = useTransform(scrollYProgress, [0, 1], [0.7, 1]);

  return (
    <section className="seccion conversion" id={id} ref={zona} aria-labelledby={`${id}-titulo`}>
      <div className="conversion__fondo" aria-hidden="true" />
      <div className="contenedor conversion__interior">
        <motion.div className="conversion__emblema" style={{ scale: escala }} aria-hidden="true">
          <motion.span className="conversion__anillo" style={{ rotate: giro }} />
          <img src={monograma} alt="" width={74} height={52} />
        </motion.div>

        <Revelar>
          <h2 className="conversion__titulo" id={`${id}-titulo`}>
            {datos.titulo} <em>{datos.destacado}</em>
          </h2>
        </Revelar>
        <Revelar retraso={0.1}>
          <p className="conversion__texto">{datos.texto}</p>
        </Revelar>
        <Revelar retraso={0.2} className="conversion__acciones">
          <Boton enlace={datos.ctaPrincipal} />
          <Boton enlace={datos.ctaSecundario} variante="secundario" />
        </Revelar>
      </div>
    </section>
  );
}
