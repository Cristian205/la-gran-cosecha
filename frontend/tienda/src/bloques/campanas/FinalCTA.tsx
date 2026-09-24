"use client";

import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { whatsappHref } from "@/lib/utiles";
import { Boton, TipografiaEditorial, useParallax } from "./comunes";

/**
 * El cierre: la última imagen del recorrido y una sola invitación a entrar.
 * El botón principal lleva a la tienda; el secundario abre WhatsApp con el
 * número real del negocio (`SiteConfig.whatsapp_numero`) y desaparece si no
 * hay uno configurado.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  imagen?: string;
  imagen_alt?: string;
  enfoque?: string;
  cta_texto?: string;
  cta_href?: string;
  whatsapp_texto?: string;
  whatsapp_mensaje?: string;
}

export function FinalCTA({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  imagen = "",
  imagen_alt = "",
  enfoque = "50% 50%",
  cta_texto = "Entrar a la tienda",
  cta_href = "/tienda",
  whatsapp_texto = "",
  whatsapp_mensaje = "Hola, quiero hacer un pedido.",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const movimiento = useParallax(ref, { desde: 1.06, hasta: 1.18, desplazamiento: 6 });
  const { config } = useSiteConfig();

  if (!titulo) return null;

  const wa = config.whatsapp_numero ? whatsappHref(config.whatsapp_numero, whatsapp_mensaje) : "";

  return (
    <section ref={ref} className="fin" style={{ "--enfoque": enfoque } as CSSProperties}>
      <TipografiaEditorial />
      {imagen && (
        <motion.div className="fin-media" style={movimiento} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagen} alt={imagen_alt} loading="lazy" decoding="async" />
        </motion.div>
      )}
      <div className="fin-velo" aria-hidden="true" />
      <motion.div
        className="cmp-inner fin-cuerpo"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {kicker && <p className="cmp-kicker">{kicker}</p>}
        <h2>
          {titulo}
          {titulo_resaltado && <em>{titulo_resaltado}</em>}
        </h2>
        {texto && <p className="fin-parrafo">{texto}</p>}
        <div className="fin-acciones">
          <Boton href={cta_href || "/tienda"}>{cta_texto}</Boton>
          {whatsapp_texto && wa && (
            <Boton href={wa} variante="fantasma" flecha={false}>
              {whatsapp_texto}
            </Boton>
          )}
        </div>
      </motion.div>
    </section>
  );
}
