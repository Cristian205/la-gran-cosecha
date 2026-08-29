"use client";

import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { enviarMensajeContacto } from "@/lib/datos";
const aguacate = "/img/aguacate.webp";
const camion = "/img/camion.webp";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { useResaltarAlLlegar } from "@/hooks/useResaltarAlLlegar";
import { telHref, whatsappHref } from "@/lib/utiles";

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

  // WhatsApp es la vía directa; si no hay número configurado, el CTA baja al
  // formulario de esta misma página en vez de apuntar a ningún sitio.
  const hrefHablar = config.whatsapp_numero
    ? whatsappHref(
        config.whatsapp_numero,
        "Hola, tengo una consulta sobre sus productos."
      )
    : "#contacto-form";

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
      <section className="hero-contacto">
        {/* Hojas de fondo: marca de agua, no ilustración. Van en SVG para no
            sumar un archivo más por un adorno de cuatro trazos. */}
        <svg className="hero-contacto-deco" viewBox="0 0 1200 300" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="7">
            <path d="M120 60c70-30 150-10 170 60-70 30-150 10-170-60Zm0 0c60 40 90 90 90 140" />
            <path d="M1040 40c-70-20-140 10-150 80 70 20 140-10 150-80Zm0 0c-55 45-80 100-75 155" />
            <ellipse cx="330" cy="205" rx="46" ry="30" transform="rotate(-25 330 205)" />
            <ellipse cx="900" cy="230" rx="40" ry="26" transform="rotate(18 900 230)" />
          </g>
        </svg>

        <img className="hero-contacto-aguacate" src={aguacate} alt="" aria-hidden="true" decoding="async" />

        <div className="hero-contacto-cuerpo">
          <span className="etiqueta glass-dark">
            <Mail size={15} /> Estamos para ayudarte
          </span>
          <h1>Contáctanos</h1>
          <p>
            ¿Tienes preguntas sobre nuestros productos o quieres hacer un pedido
            especial? Escríbenos, con gusto te atendemos.
          </p>
          <a
            className="hero-contacto-cta"
            href={hrefHablar}
            {...(config.whatsapp_numero
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {config.whatsapp_numero && <WhatsAppIcon size={18} />}
            Habla con nosotros
          </a>
        </div>

        <img className="hero-contacto-camion" src={camion} alt="" aria-hidden="true" decoding="async" />
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
