"use client";

import Link from "next/link";
import { ClipboardList, MessageCircle, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { whatsappHref } from "@/lib/utiles";
import { ENLACE_DE } from "./intenciones";

/**
 * [Pedido] [WhatsApp] al alcance del pulgar, solo en móvil y solo en /contacto.
 *
 * Convive con lo que ya está fijo abajo sin sumar capas (la regla de
 * `global.css`: nav + UNA sola barra):
 *
 * - Con un pedido en curso manda la barra del carrito y esta se retira
 *   (`body.con-barra-carrito`, en CSS): esa barra ya lleva al pedido.
 * - En /contacto reemplaza al botón flotante de WhatsApp (ver
 *   `WhatsAppButton`), que haría lo mismo que su mitad derecha.
 * - Aparece al dejar atrás el hero —ahí los botones grandes ya están a la
 *   vista— y se esconde mientras se escribe (el teclado la subiría encima
 *   del campo) y cuando el pie está en pantalla.
 */
export function ContactMobileBar() {
  const { config } = useSiteConfig();
  const [pasado, setPasado] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [pie, setPie] = useState(false);

  useEffect(() => {
    const alDesplazar = () => setPasado(window.scrollY > window.innerHeight * 0.6);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });

    const esCampo = (el: EventTarget | null) =>
      el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable]");
    const alEnfocar = (e: FocusEvent) => setEscribiendo(esCampo(e.target));
    const alSalir = () => setEscribiendo(false);
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("focusout", alSalir);

    const piePagina = document.querySelector("footer.footer");
    const obs =
      piePagina && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => setPie(Boolean(e?.isIntersecting)))
        : null;
    if (piePagina && obs) obs.observe(piePagina);

    return () => {
      window.removeEventListener("scroll", alDesplazar);
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("focusout", alSalir);
      obs?.disconnect();
    };
  }, []);

  const visible = pasado && !escribiendo && !pie;
  const enLinea = config.acepta_pedidos_online !== false;

  return (
    <nav className={`ct-barra ${visible ? "ct-barra--visible" : ""}`} aria-label="Acciones rápidas" aria-hidden={!visible} inert={!visible}>
      {enLinea ? (
        <Link className="ct-barra-btn" href="/tienda">
          <ShoppingBag size={19} aria-hidden="true" /> Hacer pedido
        </Link>
      ) : (
        <a className="ct-barra-btn" href={ENLACE_DE.cotizacion}>
          <ClipboardList size={19} aria-hidden="true" /> Cotizar
        </a>
      )}
      {config.whatsapp_numero ? (
        <a
          className="ct-barra-btn ct-barra-btn--wa"
          href={whatsappHref(config.whatsapp_numero, "Hola, quiero ayuda para abastecer mi negocio.")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon size={19} /> WhatsApp
        </a>
      ) : enLinea ? (
        <a className="ct-barra-btn ct-barra-btn--wa" href={ENLACE_DE.cotizacion}>
          <ClipboardList size={19} aria-hidden="true" /> Cotizar
        </a>
      ) : (
        <a className="ct-barra-btn ct-barra-btn--wa" href={ENLACE_DE.hablar}>
          <MessageCircle size={19} aria-hidden="true" /> Hablar
        </a>
      )}
    </nav>
  );
}
