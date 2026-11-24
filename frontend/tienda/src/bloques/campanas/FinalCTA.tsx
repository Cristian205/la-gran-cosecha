"use client";

import { Leaf, Store } from "lucide-react";
import { motion } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { whatsappHref } from "@/lib/utiles";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { Boton, TipografiaEditorial, useParallax } from "./comunes";

/**
 * El cierre: la última imagen del recorrido y una sola invitación a entrar.
 *
 * Composición asimétrica y compacta (≈540–600 px en escritorio): el mensaje
 * a la izquierda, sobre un degradado que solo oscurece esa zona, y la foto
 * protagonista a la derecha, a la vista. Debajo de los botones, dos atributos
 * comerciales cortos.
 *
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
  /** Los dos atributos bajo los botones. Vacío no se dibuja. */
  atributo_1?: string;
  atributo_2?: string;
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
  atributo_1 = "Productos seleccionados",
  atributo_2 = "Abastecimiento para negocios",
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
            <Boton href={wa} variante="fantasma" flecha={false} icono={<WhatsAppIcon size={18} />}>
              {whatsapp_texto}
            </Boton>
          )}
        </div>
        {(atributo_1 || atributo_2) && (
          <ul className="fin-atributos">
            {atributo_1 && (
              <li>
                <span className="fin-atributo-icono" aria-hidden="true"><Leaf size={15} strokeWidth={2} /></span>
                {atributo_1}
              </li>
            )}
            {atributo_2 && (
              <li>
                <span className="fin-atributo-icono" aria-hidden="true"><Store size={15} strokeWidth={2} /></span>
                {atributo_2}
              </li>
            )}
          </ul>
        )}
      </motion.div>
    </section>
  );
}
