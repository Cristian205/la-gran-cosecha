import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteConfig } from "../context/SiteConfigContext";
import { TikTokIcon } from "./icons/TikTokIcon";
import { telHref } from "../utils";

export function Footer() {
  const { config } = useSiteConfig();

  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
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
          <p style={{ fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 320 }}>
            Del campo a tu negocio. Productos frescos y un servicio ágil pensado
            para que tu tienda nunca se quede sin lo esencial.
          </p>
          {(config.instagram_url || config.facebook_url || config.tiktok_url) && (
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

        <div className="footer-col">
          <h4>Navegación</h4>
          <Link to="/">Inicio</Link>
          <Link to="/tienda">Tienda</Link>
          <Link to="/nosotros">Sobre nosotros</Link>
          <Link to="/contacto">Contáctanos</Link>
        </div>

        <div className="footer-col">
          {(config.telefono || config.email || config.ciudad || config.horario) && (
            <>
              <h4>Contacto</h4>
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
            </>
          )}
        </div>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} La Gran Cosecha. Todos los derechos reservados.
      </div>
    </footer>
  );
}
