"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { whatsappHref } from "@/lib/utiles";

/**
 * La confirmación: qué pasó, qué se envió y qué puede hacer ahora.
 *
 * No promete un tiempo de respuesta —el negocio no lo ha definido—; dice lo
 * que es cierto: la solicitud llegó y el equipo la va a revisar. El foco se
 * mueve al titular para que un lector de pantalla lo anuncie.
 */
interface Props {
  titulo?: string;
  texto?: string;
  /** Lo que se envió, tal como llegó a la bandeja. */
  resumen: string;
  /** El mismo contenido, listo para seguir la conversación por WhatsApp. */
  whatsappMensaje: string;
  onOtra: () => void;
}

export function ContactSuccess({
  titulo = "¡Recibimos tu solicitud!",
  texto = "Nuestro equipo revisará tu requerimiento y te contactará por el medio que nos dejaste.",
  resumen,
  whatsappMensaje,
  onOtra,
}: Props) {
  const { config } = useSiteConfig();
  const encabezado = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    encabezado.current?.focus();
  }, []);

  const lineas = resumen.split("\n").slice(1);

  return (
    <div className="ct-exito">
      <svg className="ct-exito-sello" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="M15 27l7.5 7.5L38 19" />
      </svg>
      <h3 ref={encabezado} tabIndex={-1}>
        {titulo}
      </h3>
      <p className="ct-exito-texto">{texto}</p>

      {lineas.length > 0 && (
        <dl className="ct-exito-resumen" aria-label="Lo que nos enviaste">
          {lineas.map((l) => {
            const corte = l.indexOf(": ");
            return (
              <div key={l}>
                <dt>{l.slice(0, corte)}</dt>
                <dd>{l.slice(corte + 2)}</dd>
              </div>
            );
          })}
        </dl>
      )}

      <div className="ct-exito-acciones">
        {config.whatsapp_numero && (
          <a
            className="cmp-btn cmp-btn--ambar"
            href={whatsappHref(config.whatsapp_numero, whatsappMensaje)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon size={18} />
            <span>Hablar por WhatsApp</span>
          </a>
        )}
        <Link className="ct-enlace" href="/tienda">
          Seguir viendo productos <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <button type="button" className="ct-enlace" onClick={onOtra}>
          Enviar otra solicitud
        </button>
      </div>
    </div>
  );
}
