import { ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteConfig } from "../context/SiteConfigContext";
import { whatsappHref } from "../utils";
import { WhatsAppIcon } from "./icons/WhatsAppIcon";

export function CotizacionRapida() {
  const { config } = useSiteConfig();

  return (
    <section className="seccion">
      <div className="cotizacion-rapida glass">
        <span className="cotizacion-icono">
          <ClipboardList size={26} />
        </span>
        <div className="cotizacion-info">
          <h3>{config.cotizacion_titulo}</h3>
          <p>{config.cotizacion_texto}</p>
        </div>
        <div className="cotizacion-acciones">
          <Link className="btn btn-outline" to="/contacto">
            Solicitar cotización
          </Link>
          {config.whatsapp_numero && (
            <a
              className="btn btn-whatsapp"
              href={whatsappHref(
                config.whatsapp_numero,
                "Hola, quiero cotizar un pedido grande o fuera de catálogo."
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={18} /> Comprar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
