"use client";

import { Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { useResaltarAlLlegar } from "@/hooks/useResaltarAlLlegar";
import { telHref, whatsappHref } from "@/lib/utiles";
import { TipografiaEditorial } from "../campanas/comunes";
import { numeroLegible } from "./WhatsAppCTA";

/**
 * "Habla con nosotros": cada dato es una acción, no una línea de una lista.
 *
 * Todo sale de la configuración del negocio (`SiteConfig`) —el mismo
 * teléfono, correo y ciudad que usa el resto de la tienda—, así que cambiarlo
 * en el panel lo cambia aquí. Lo que no está configurado no se pinta: sin
 * horario definido no hay tarjeta de horario.
 *
 * Los ids `contacto-whatsapp`, `contacto-telefono`, `contacto-correo`,
 * `contacto-ubicacion` y `contacto-horario` son los destinos de la búsqueda
 * global (`?resaltar=`), igual que en la página anterior.
 */
interface Props {
  kicker?: string;
  titulo?: string;
  whatsapp_mensaje?: string;
  correo_asunto?: string;
}

export function ContactInfo({
  kicker = "",
  titulo = "Habla con nosotros",
  whatsapp_mensaje = "Hola, quiero más información.",
  correo_asunto = "Solicitud desde la tienda",
}: Props) {
  const { config } = useSiteConfig();
  useResaltarAlLlegar(config);

  const digitos = (s: string) => s.replace(/\D/g, "");
  // Si el teléfono es el mismo número de WhatsApp, va en la misma tarjeta
  // (escribir o llamar) en vez de repetirse en dos.
  const mismoNumero =
    Boolean(config.telefono && config.whatsapp_numero) &&
    digitos(config.whatsapp_numero).endsWith(digitos(config.telefono));
  const lugar = [config.direccion, config.ciudad].filter(Boolean).join(", ");
  const mapa = lugar ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}` : "";

  const metodos: ReactNode[] = [];
  if (config.whatsapp_numero) {
    metodos.push(
      <ContactMethod
        key="wa"
        id="contacto-whatsapp"
        icono={<WhatsAppIcon size={22} />}
        etiqueta="WhatsApp"
        valor={mismoNumero ? config.telefono : numeroLegible(config.whatsapp_numero)}
        idValor={mismoNumero ? "contacto-telefono" : undefined}
        acciones={[
          { texto: "Escribir por WhatsApp", href: whatsappHref(config.whatsapp_numero, whatsapp_mensaje), externo: true },
          ...(mismoNumero ? [{ texto: "Llamar", href: telHref(config.telefono) }] : []),
        ]}
        destacado
      />
    );
  }
  if (config.telefono && !mismoNumero) {
    metodos.push(
      <ContactMethod
        key="tel"
        id="contacto-telefono"
        Icono={Phone}
        etiqueta="Teléfono"
        valor={config.telefono}
        acciones={[{ texto: "Llamar", href: telHref(config.telefono) }]}
      />
    );
  }
  if (config.email) {
    metodos.push(
      <ContactMethod
        key="mail"
        id="contacto-correo"
        Icono={Mail}
        etiqueta="Correo"
        valor={config.email}
        acciones={[{ texto: "Enviar correo", href: `mailto:${config.email}?subject=${encodeURIComponent(correo_asunto)}` }]}
      />
    );
  }
  if (lugar) {
    metodos.push(
      <ContactMethod
        key="lugar"
        id="contacto-ubicacion"
        Icono={MapPin}
        etiqueta="Ubicación"
        valor={lugar}
        acciones={[{ texto: "Ver ubicación", href: mapa, externo: true }]}
      />
    );
  }
  if (config.horario) {
    metodos.push(
      <ContactMethod key="hora" id="contacto-horario" Icono={Clock} etiqueta="Horario de atención" valor={config.horario} acciones={[]} />
    );
  }

  if (metodos.length === 0) return null;

  return (
    <section className="ct-datos" aria-labelledby="ct-datos-titulo">
      <TipografiaEditorial />
      <div className="cmp-inner">
        <header className="ct-datos-cabecera">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2 id="ct-datos-titulo">{titulo}</h2>
        </header>
        <ul className="ct-datos-lista" style={{ "--n": metodos.length } as CSSProperties}>
          {metodos}
        </ul>
      </div>
    </section>
  );
}

interface Accion {
  texto: string;
  href: string;
  externo?: boolean;
}

/** Un canal: qué es, el dato y lo que se puede hacer con él. */
export function ContactMethod({
  id,
  Icono,
  icono,
  etiqueta,
  valor,
  acciones,
  destacado = false,
  idValor,
}: {
  id: string;
  /** Un segundo destino de `?resaltar=` cuando la tarjeta reúne dos canales. */
  idValor?: string;
  Icono?: LucideIcon;
  icono?: ReactNode;
  etiqueta: string;
  valor: string;
  acciones: Accion[];
  destacado?: boolean;
}) {
  return (
    <motion.li
      id={id}
      className={`ct-metodo ${destacado ? "ct-metodo--destacado" : ""}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="ct-metodo-icono" aria-hidden="true">
        {icono ?? (Icono && <Icono size={22} />)}
      </span>
      <span className="ct-metodo-etiqueta">{etiqueta}</span>
      <span id={idValor} className="ct-metodo-valor">
        {valor}
      </span>
      {acciones.length > 0 && (
        <span className="ct-metodo-acciones">
          {acciones.map((a) => (
            <a
              key={a.texto}
              href={a.href}
              {...(a.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {a.texto}
            </a>
          ))}
        </span>
      )}
    </motion.li>
  );
}
