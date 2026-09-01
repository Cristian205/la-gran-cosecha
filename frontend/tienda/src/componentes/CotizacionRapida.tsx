"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { whatsappHref } from "@/lib/utiles";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";

interface Props {
  titulo?: string;
  texto?: string;
}

/**
 * El bloque manda; la configuracion del negocio es el respaldo.
 *
 * Durante el traslado al motor conviven los dos: las paginas ya compuestas
 * traen el texto en sus propiedades y las que aun no, lo siguen leyendo de
 * `StoreSettings`. Cuando esas columnas se retiren, el `??` cae solo.
 */
export function CotizacionRapida({ titulo, texto }: Props) {
  const { config } = useSiteConfig();

  return (
    <section className="seccion">
      <div className="cotizacion-rapida glass">
        <span className="cotizacion-icono">
          <ClipboardList size={26} />
        </span>
        <div className="cotizacion-info">
          <h3>{titulo || config.cotizacion_titulo}</h3>
          <p>{texto || config.cotizacion_texto}</p>
        </div>
        <div className="cotizacion-acciones">
          <Link className="btn btn-outline" href="/contacto">
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
