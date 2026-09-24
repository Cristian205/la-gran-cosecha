"use client";

import { motion, useInView } from "motion/react";
import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { whatsappHref } from "@/lib/utiles";
import { TipografiaEditorial, useSinMovimiento } from "../campanas/comunes";

/**
 * "¿Prefieres hablar directamente? Hablemos por WhatsApp."
 *
 * WhatsApp como acción comercial, no como botón verde genérico: a un lado la
 * invitación y el botón grande; al otro, el chat tal como se va a abrir, con
 * el borrador escribiéndose solo en la caja de texto. No es una conversación
 * inventada ni un mensaje enviado: es exactamente el texto que la persona
 * encuentra al pulsar, y que puede cambiar antes de enviarlo.
 *
 * Usa el número real de la configuración del negocio y no se pinta si no hay
 * uno.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  cta_texto?: string;
  mensaje?: string;
  nota_chat?: string;
}

/** 573002124562 → +57 300 212 4562. Otros formatos se muestran tal cual. */
export function numeroLegible(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return numero;
}

export function WhatsAppCTA({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  cta_texto = "Abrir WhatsApp",
  mensaje = "Hola, quiero abastecer mi negocio.",
  nota_chat = "",
}: Props) {
  const { config } = useSiteConfig();
  const chat = useRef<HTMLDivElement>(null);
  const enVista = useInView(chat, { once: true, amount: 0.5 });
  const quieto = useSinMovimiento();
  const [escritos, setEscritos] = useState(0);

  // El borrador se escribe letra a letra la primera vez que se ve. Con menos
  // movimiento aparece completo.
  useEffect(() => {
    if (!enVista) return;
    if (quieto) {
      setEscritos(mensaje.length);
      return;
    }
    let n = 0;
    const t = window.setInterval(() => {
      n += 2;
      setEscritos(Math.min(n, mensaje.length));
      if (n >= mensaje.length) window.clearInterval(t);
    }, 28);
    return () => window.clearInterval(t);
  }, [enVista, quieto, mensaje]);

  if (!config.whatsapp_numero || !titulo) return null;

  const href = whatsappHref(config.whatsapp_numero, mensaje);
  const completo = escritos >= mensaje.length;

  return (
    <section id="contacto-whatsapp" className="ct-wa" aria-labelledby="ct-wa-titulo">
      <TipografiaEditorial />
      <div className="cmp-inner ct-wa-grid">
        <motion.div
          className="ct-wa-texto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2 id="ct-wa-titulo">
            {titulo}
            {titulo_resaltado && <em>{titulo_resaltado}</em>}
          </h2>
          {texto && <p className="ct-wa-parrafo">{texto}</p>}
          <a className="ct-wa-btn" href={href} target="_blank" rel="noopener noreferrer">
            <span className="ct-wa-btn-icono" aria-hidden="true">
              <WhatsAppIcon size={24} />
            </span>
            <span className="ct-wa-btn-texto">
              {cta_texto}
              <small>{numeroLegible(config.whatsapp_numero)}</small>
            </span>
          </a>
        </motion.div>

        <div ref={chat} className="ct-wa-chat" aria-hidden="true">
          <div className="ct-wa-chat-cabecera">
            <span className="ct-wa-chat-avatar">
              {config.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.logo_url} alt="" loading="lazy" decoding="async" />
              ) : (
                <WhatsAppIcon size={18} />
              )}
            </span>
            <span>
              <strong>{config.nombre_empresa}</strong>
              <small>WhatsApp</small>
            </span>
          </div>
          <div className="ct-wa-chat-cuerpo">
            {nota_chat && <p className="ct-wa-chat-nota">{nota_chat}</p>}
          </div>
          <div className="ct-wa-redactar">
            <p className="ct-wa-borrador">
              {mensaje.slice(0, escritos)}
              {!completo && <span className="ct-wa-cursor" />}
            </p>
            <span className={`ct-wa-enviar ${completo ? "ct-wa-enviar--listo" : ""}`}>
              <SendHorizontal size={17} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
