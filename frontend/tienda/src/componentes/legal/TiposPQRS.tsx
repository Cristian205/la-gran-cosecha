"use client";

import { Clock, Mail, MessageSquareQuote } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { TIPOS_PQRS } from "@/lib/legal/pqrs";
import type { DatosLegales } from "@/lib/legal/tipos";
import { whatsappHref } from "@/lib/utiles";
import { Pendiente } from "./TextoLegal";

/**
 * Elegir el tipo de PQRS y enviarlo por un canal oficial con el mensaje ya
 * estructurado. Es el punto donde se conectará el formulario con radicado
 * cuando exista (ver `lib/legal/pqrs.ts`): la elección del tipo no cambia.
 */
export function TiposPQRS({ datos }: { datos: DatosLegales }) {
  const [elegido, setElegido] = useState(TIPOS_PQRS[0].id);
  const tipo = TIPOS_PQRS.find((t) => t.id === elegido) ?? TIPOS_PQRS[0];
  const nombre = datos.empresa.nombre_comercial ?? "la tienda";
  const { whatsapp, correo_atencion, correo_datos_personales } = datos.contacto;
  const correo = tipo.id === "datos-personales" ? correo_datos_personales : correo_atencion;

  const mensaje = [
    `Hola ${nombre}, quiero presentar: ${tipo.nombre}.`,
    "Nombre:",
    "Cédula o NIT:",
    ...(tipo.id === "pedido" || tipo.id === "reclamo" ? ["Número de pedido:"] : []),
    "Descripción:",
  ].join("\n");

  return (
    <div className="legal-pqrs">
      <div className="legal-pqrs-tipos" role="radiogroup" aria-label="Tipo de solicitud">
        {TIPOS_PQRS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={t.id === elegido}
            className={`legal-pqrs-tipo ${t.id === elegido ? "activo" : ""}`}
            onClick={() => setElegido(t.id)}
          >
            {t.nombre}
          </button>
        ))}
      </div>

      <div className="legal-pqrs-detalle" aria-live="polite">
        <p className="legal-pqrs-descripcion">{tipo.descripcion}</p>
        <p className="legal-pqrs-ejemplo">
          <MessageSquareQuote size={15} aria-hidden="true" /> Por ejemplo: «{tipo.ejemplo}»
        </p>
        <p className="legal-pqrs-plazo">
          <Clock size={15} aria-hidden="true" /> Tiempo de respuesta: <strong>{tipo.plazo}</strong>
        </p>

        <div className="legal-pqrs-acciones">
          {whatsapp && (
            <a className="btn btn-whatsapp" href={whatsappHref(whatsapp, mensaje)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon size={17} /> Enviar por WhatsApp
            </a>
          )}
          {correo ? (
            <a
              className="btn secundario"
              href={`mailto:${correo}?subject=${encodeURIComponent(`[PQRS] ${tipo.nombre}`)}&body=${encodeURIComponent(mensaje)}`}
            >
              <Mail size={17} /> Enviar por correo
            </a>
          ) : (
            <Pendiente ruta={tipo.id === "datos-personales" ? "contacto.correo_datos_personales" : "contacto.correo_atencion"} />
          )}
        </div>
      </div>
    </div>
  );
}
