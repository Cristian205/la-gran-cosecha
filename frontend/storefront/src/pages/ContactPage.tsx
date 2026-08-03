import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { enviarMensajeContacto } from "../api/contact";
import { WhatsAppIcon } from "../components/icons/WhatsAppIcon";
import { useSiteConfig } from "../context/SiteConfigContext";
import { useResaltarAlLlegar } from "../hooks/useResaltarAlLlegar";
import { telHref, whatsappHref } from "../utils";

export function ContactPage() {
  const { config } = useSiteConfig();
  useResaltarAlLlegar(config);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !email.trim() || !mensaje.trim()) {
      setError("Por favor completa nombre, correo y mensaje.");
      return;
    }

    setEnviando(true);
    try {
      await enviarMensajeContacto({
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        mensaje: mensaje.trim(),
      });
      setEnviado(true);
      setNombre("");
      setEmail("");
      setTelefono("");
      setMensaje("");
    } catch {
      setError("No pudimos enviar tu mensaje. Intenta de nuevo o escríbenos por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <section className="pagina-hero">
        <span className="etiqueta glass-dark">
          <Mail size={16} /> Estamos para ayudarte
        </span>
        <h1>Contáctanos</h1>
        <p>
          ¿Tienes preguntas sobre nuestros productos o quieres hacer un pedido
          especial? Escríbenos, con gusto te atendemos.
        </p>
      </section>

      <div className="contenedor">
        <div className="contacto-grid">
          <div className="info-contacto">
            {config.telefono && (
              <div id="contacto-telefono" className="info-card glass">
                <span className="icono">
                  <Phone size={20} />
                </span>
                <div>
                  <h4>Teléfono</h4>
                  <a href={telHref(config.telefono)}>{config.telefono}</a>
                </div>
              </div>
            )}

            {config.whatsapp_numero && (
              <div id="contacto-whatsapp" className="info-card glass">
                <span className="icono">
                  <WhatsAppIcon size={20} />
                </span>
                <div>
                  <h4>WhatsApp</h4>
                  <a
                    href={whatsappHref(
                      config.whatsapp_numero,
                      "Hola, quiero más información sobre sus productos."
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Escríbenos directo
                  </a>
                </div>
              </div>
            )}

            {config.email && (
              <div id="contacto-correo" className="info-card glass">
                <span className="icono">
                  <Mail size={20} />
                </span>
                <div>
                  <h4>Correo</h4>
                  <a href={`mailto:${config.email}`}>{config.email}</a>
                </div>
              </div>
            )}

            {(config.direccion || config.ciudad) && (
              <div id="contacto-ubicacion" className="info-card glass">
                <span className="icono">
                  <MapPin size={20} />
                </span>
                <div>
                  <h4>Ubicación</h4>
                  {config.direccion && <p>{config.direccion}</p>}
                  {config.ciudad && <p>{config.ciudad}</p>}
                </div>
              </div>
            )}

            {config.horario && (
              <div id="contacto-horario" className="info-card glass">
                <span className="icono">
                  <Clock size={20} />
                </span>
                <div>
                  <h4>Horario de atención</h4>
                  <p>{config.horario}</p>
                </div>
              </div>
            )}
          </div>

          <div id="contacto-form" className="form-contacto glass">
            <h2>Envíanos un mensaje</h2>

            {enviado ? (
              <div className="ok-box">
                ¡Gracias por escribirnos! Tu mensaje fue enviado, te
                responderemos muy pronto.
              </div>
            ) : (
              <form onSubmit={enviar}>
                {error && <div className="error-box">{error}</div>}

                <div className="campo">
                  <label>Nombre *</label>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="campo">
                  <label>Correo electrónico *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                  />
                </div>
                <div className="campo">
                  <label>Teléfono</label>
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="campo">
                  <label>Mensaje *</label>
                  <textarea
                    rows={5}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Cuéntanos en qué podemos ayudarte"
                  />
                </div>

                <button className="btn btn-verde btn-block" disabled={enviando}>
                  <Send size={16} />
                  {enviando ? "Enviando…" : "Enviar mensaje"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
