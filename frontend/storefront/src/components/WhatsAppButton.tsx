import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSiteConfig } from "../context/SiteConfigContext";
import { whatsappHref } from "../utils";
import { WhatsAppIcon } from "./icons/WhatsAppIcon";

/**
 * Se retira solo cuando el pie está a la vista: ahí el footer ya ofrece
 * "Hablar por WhatsApp" en grande, así que el flotante solo taparía enlaces.
 */
function usePieALaVista(): boolean {
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const pie = document.querySelector("footer.footer");
    if (!pie || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      ([entrada]) => setVisible(entrada.isIntersecting),
      { threshold: 0 }
    );
    observador.observe(pie);
    return () => observador.disconnect();
  }, [pathname]);

  return visible;
}

export function WhatsAppButton() {
  const { config } = useSiteConfig();
  const location = useLocation();
  const pieALaVista = usePieALaVista();

  if (!config.whatsapp_numero) return null;

  // En móvil, dentro de la tienda el flotante se posaba justo encima del botón
  // "Agregar" de la tarjeta derecha, tapando la acción principal. Ahí se retira:
  // WhatsApp sigue a un toque desde la pestaña Contacto y desde el pie.
  const enFlujoDeCompra = location.pathname.startsWith("/tienda");

  return (
    <a
      className={`whatsapp-flotante ${enFlujoDeCompra ? "oculto-en-movil" : ""} ${
        pieALaVista ? "oculto" : ""
      }`}
      href={whatsappHref(config.whatsapp_numero, "Hola, quiero más información sobre sus productos.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      aria-hidden={pieALaVista}
      tabIndex={pieALaVista ? -1 : undefined}
    >
      <WhatsAppIcon size={30} />
    </a>
  );
}
