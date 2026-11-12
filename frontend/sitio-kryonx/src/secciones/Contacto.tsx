import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { MessageCircle } from "lucide-react";
import { useRef } from "react";
import isotipo from "../assets/crafteech-isotipo-grande.webp";
import { FormularioComercial } from "../componentes/FormularioComercial";
import { Revelar } from "../componentes/Revelar";
import type { DatosContacto } from "../contenido/tipos";
import { registrar } from "../lib/analitica";
import { urlWhatsApp } from "../lib/contacto";
import { usarSolucionElegida } from "../lib/solucion";

/**
 * Escena 08. El cierre: un titular que no se disculpa, el botón de WhatsApp si
 * hay número y el formulario. El isotipo enorme detrás gira un poco con el
 * scroll —un último movimiento que acompaña la llegada—, y con «menos
 * movimiento» se queda quieto.
 *
 * El WhatsApp sale con el mensaje de la modalidad que la persona eligió antes
 * en la página, así la conversación empieza con contexto.
 */
export function Contacto({ datos, id }: { datos: DatosContacto; id: string }) {
  const zona = useRef<HTMLElement>(null);
  const reducido = useReducedMotion();
  const { solucion } = usarSolucionElegida();
  const { scrollYProgress } = useScroll({ target: zona, offset: ["start end", "end end"] });
  const giro = useTransform(scrollYProgress, [0, 1], [reducido ? 0 : -24, 0]);
  const urlWa = urlWhatsApp(solucion);

  return (
    <section className="seccion escena--oscura contacto" id={id} ref={zona} aria-labelledby={`${id}-titulo`}>
      <div className="contacto__fondo" aria-hidden="true">
        <div className="contacto__luz" />
        <motion.img className="contacto__isotipo" src={isotipo} alt="" width={560} height={461} loading="lazy" style={{ rotate: giro }} />
      </div>

      <div className="contenedor contacto__interior">
        <div className="contacto__texto">
          <Revelar>
            <h2 className="contacto__titulo" id={`${id}-titulo`}>
              {datos.titulo} <em>{datos.destacado}</em>
            </h2>
          </Revelar>
          <Revelar retraso={0.1}>
            <p className="contacto__subtitulo">{datos.texto}</p>
          </Revelar>
          {urlWa && (
            <Revelar retraso={0.2}>
              <a
                className="boton boton--secundario contacto__whatsapp"
                href={urlWa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrar("contacto_whatsapp", { origen: "contacto", solucion: solucion ?? "" })}
              >
                <MessageCircle className="boton__icono" aria-hidden="true" />
                <span className="boton__texto">{datos.whatsapp}</span>
              </a>
            </Revelar>
          )}
        </div>

        <Revelar className="contacto__formulario" retraso={0.15} desde={40}>
          <FormularioComercial datos={datos} />
        </Revelar>
      </div>
    </section>
  );
}
