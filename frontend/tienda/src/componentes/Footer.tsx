"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Plus,
} from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { obtenerCategorias } from "@/lib/datos";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { ENLACES } from "@/lib/navegacion";
import type { Categoria } from "@/lib/tipos";
import { telHref, whatsappHref } from "@/lib/utiles";
import { TikTokIcon } from "@/componentes/icons/TikTokIcon";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";

/** Cuántas categorías caben en la columna "Compra" sin volverla un índice. */
const MAX_CATEGORIAS_FOOTER = 4;

/**
 * Columna del pie: lista abierta en escritorio y acordeón en móvil, donde
 * apilar todas las columnas abiertas hacía un pie larguísimo justo encima del
 * carrito y la barra de navegación. El panel siempre está en el DOM; quién lo
 * muestra es el CSS según el ancho, así el escritorio nunca depende del estado.
 */
function ColumnaFooter({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();

  return (
    <div className="footer-col">
      <h4>{titulo}</h4>
      <button
        type="button"
        className="footer-col-toggle"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((v) => !v)}
      >
        <span>{titulo}</span>
        <Plus size={18} className={abierto ? "girado" : ""} aria-hidden="true" />
      </button>
      <div id={idPanel} className={`footer-col-panel ${abierto ? "abierto" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export function Footer() {
  const { config } = useSiteConfig();
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    // Comparte la petición cacheada con la tienda y el buscador (api/catalog).
    obtenerCategorias().then(setCategorias).catch(() => undefined);
  }, []);

  const hayRedes = Boolean(
    config.instagram_url || config.facebook_url || config.tiktok_url
  );
  const hrefWhatsapp = config.whatsapp_numero
    ? whatsappHref(
        config.whatsapp_numero,
        "Hola, quiero hacer un pedido con La Gran Cosecha."
      )
    : null;

  return (
    <footer className="footer">
      {/* Última oportunidad de conversión antes de cerrar la página. */}
      <section className="footer-cta">
        <div className="footer-cta-inner">
          <div>
            <h2>¿Listo para hacer tu pedido?</h2>
            <p>Productos frescos directamente para tu negocio, en minutos.</p>
          </div>
          <div className="footer-cta-acciones">
            <Link href="/tienda" className="btn btn-ambar">
              Explorar productos <ArrowRight size={17} />
            </Link>
            {hrefWhatsapp && (
              <a
                className="btn btn-whatsapp"
                href={hrefWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={18} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="footer-top">
        <div className="footer-marca-col">
          <div className="footer-marca">
            <span className="logo-circ" style={{ width: 36, height: 36 }}>
              {config.logo_url ? (
                <img
                  src={config.logo_url}
                  alt="La Gran Cosecha"
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }}
                />
              ) : (
                "🌾"
              )}
            </span>
            La Gran Cosecha
          </div>
          <p className="footer-lema">
            Del campo a tu negocio. Productos frescos para que nunca falte lo
            esencial.
          </p>
          <Link href="/tienda" className="footer-btn-tienda">
            Explorar tienda <ArrowRight size={15} />
          </Link>
          {hayRedes && (
            <div className="footer-redes">
              {config.instagram_url && (
                <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram size={17} />
                </a>
              )}
              {config.facebook_url && (
                <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook size={17} />
                </a>
              )}
              {config.tiktok_url && (
                <a href={config.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                  <TikTokIcon size={16} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Ayuda: en móvil va justo tras la marca (orden CSS), no al final. */}
        <div className="footer-col footer-ayuda">
          <h4>¿Necesitas ayuda?</h4>
          <p className="footer-ayuda-texto">
            Escríbenos y te acompañamos con tu pedido.
          </p>
          {hrefWhatsapp && (
            <a
              className="footer-btn-wsp"
              href={hrefWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={17} /> Hablar por WhatsApp
            </a>
          )}
          <div className="footer-col-panel abierto">
            {config.telefono && (
              <a href={telHref(config.telefono)}>
                <Phone size={15} /> {config.telefono}
              </a>
            )}
            {config.email && (
              <a href={`mailto:${config.email}`}>
                <Mail size={15} /> {config.email}
              </a>
            )}
            {config.ciudad && (
              <span className="linea-contacto">
                <MapPin size={15} /> {config.ciudad}
              </span>
            )}
            {config.horario && (
              <span className="linea-contacto">
                <Clock size={15} /> {config.horario}
              </span>
            )}
          </div>
        </div>

        {/* Solo categorías reales del catálogo: nada de enlaces inventados. */}
        <ColumnaFooter titulo="Compra">
          <Link href="/tienda">Todos los productos</Link>
          {categorias.slice(0, MAX_CATEGORIAS_FOOTER).map((c) => (
            <Link key={c.id} href={`/tienda?categoria=${c.id}`}>
              {c.nombre_categoria}
            </Link>
          ))}
          <Link href="/tienda/pedido">Mi pedido</Link>
        </ColumnaFooter>

        <ColumnaFooter titulo="Navegación">
          {ENLACES.map((e) => (
            <Link key={e.to} href={e.to}>
              {e.label}
            </Link>
          ))}
        </ColumnaFooter>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} La Gran Cosecha · Todos los derechos
        reservados
      </div>
    </footer>
  );
}
