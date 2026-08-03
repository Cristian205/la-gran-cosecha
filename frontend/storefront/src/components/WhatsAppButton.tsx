import { useSiteConfig } from "../context/SiteConfigContext";
import { whatsappHref } from "../utils";
import { WhatsAppIcon } from "./icons/WhatsAppIcon";

export function WhatsAppButton() {
  const { config } = useSiteConfig();

  if (!config.whatsapp_numero) return null;

  return (
    <a
      className="whatsapp-flotante"
      href={whatsappHref(config.whatsapp_numero, "Hola, quiero más información sobre sus productos.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
    >
      <WhatsAppIcon size={30} />
    </a>
  );
}
