"use client";

import Link from "next/link";
import { forwardRef, useEffect, useState } from "react";
import {
  BadgeCheck,
  Boxes,
  CalendarClock,
  Check,
  ClipboardList,
  Hash,
  Inbox,
  Layers,
  PackageCheck,
  PackageOpen,
  Receipt,
  RefreshCw,
  SearchCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { historialCliente } from "@/lib/datos";
import type { RespuestaPedido, SeguimientoPedido } from "@/lib/tipos";
import { formatoPrecio, whatsappHref } from "@/lib/utiles";
import { textoReferencias, textoUnidades } from "./PasoRevision";

/**
 * La pantalla de «pedido registrado», después de enviarlo.
 *
 * Todo lo que muestra sale de la RESPUESTA de Django al registrar el pedido
 * —número, fecha, referencias, unidades, total y paso—, no del carrito: el
 * carrito es lo que se quiso pedir y esto es lo que quedó guardado. Lo que el
 * servidor no mande (un backend anterior) simplemente no se pinta: nunca se
 * rellena con una estimación.
 *
 * El seguimiento es el paso real (`orders/seguimiento.py`). En las tiendas que
 * identifican por cédula se vuelve a consultar el historial —el mismo endpoint
 * de «Mis pedidos»— cada minuto mientras la pestaña está a la vista, así que
 * lo que cambia el panel aparece aquí sin recargar. Por nombre no hay forma
 * segura de preguntar por un pedido ajeno a la sesión, así que se muestra el
 * paso con el que se registró y no se promete actualización.
 */

const PASOS: { etiqueta: string; detalle: string; Icono: LucideIcon }[] = [
  { etiqueta: "Recibido", detalle: "Tu pedido llegó a nuestro sistema.", Icono: Inbox },
  { etiqueta: "En revisión", detalle: "Revisamos productos y cantidades.", Icono: SearchCheck },
  { etiqueta: "Confirmado", detalle: "Validamos tu pedido y su valor.", Icono: BadgeCheck },
  { etiqueta: "En preparación", detalle: "Alistamos tus productos para el despacho.", Icono: PackageOpen },
  { etiqueta: "Despachado", detalle: "Tu pedido va en camino.", Icono: Truck },
  { etiqueta: "Entregado", detalle: "Pedido entregado. ¡Gracias por tu compra!", Icono: PackageCheck },
];
const ULTIMO_PASO = PASOS.length - 1;
const CADA_CUANTO_MS = 60_000;

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const HORA = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });

interface Props {
  pedido: RespuestaPedido;
  /** Para el saludo y el mensaje de WhatsApp. */
  nombre: string;
  /** Solo en tiendas por cédula: con ella se consulta el estado al día. */
  cedula: string | null;
}

/** El mensaje de WhatsApp, siempre con el número del pedido. */
function mensajeDeConsulta(plantilla: string | undefined, id: number, nombre: string, total: string): string {
  if (plantilla && plantilla.includes("{pedido_id}")) {
    return plantilla.replace("{nombre}", nombre).replace("{pedido_id}", String(id)).replace("{total}", total);
  }
  return `Hola, soy ${nombre}. Quiero consultar por mi pedido #${id}.`;
}

export const PedidoRegistrado = forwardRef<HTMLHeadingElement, Props>(function PedidoRegistrado(
  { pedido, nombre, cedula },
  tituloRef
) {
  const { config } = useSiteConfig();
  // Si el servidor no mandó el paso, lo único cierto es que se recibió.
  const [seguimiento, setSeguimiento] = useState<SeguimientoPedido>(
    pedido.seguimiento ?? { paso: 0, clave: "RECIBIDO", etiqueta: "Recibido" }
  );
  const [consultado, setConsultado] = useState<Date | null>(null);
  const sigueVivo = cedula !== null && seguimiento.paso < ULTIMO_PASO;

  useEffect(() => {
    if (!sigueVivo || !cedula) return;
    let cancelado = false;

    async function consultar() {
      if (document.visibilityState !== "visible") return;
      try {
        const historial = await historialCliente(cedula!);
        const propio = historial.pedidos.find((p) => p.id === pedido.pedido_id);
        if (!cancelado && propio?.seguimiento) {
          setSeguimiento(propio.seguimiento);
          setConsultado(new Date());
        }
      } catch {
        // Sin red o con el límite de consultas: se queda el último paso
        // conocido y se reintenta en la siguiente vuelta.
      }
    }

    const intervalo = setInterval(consultar, CADA_CUANTO_MS);
    // Al volver a la pestaña no se espera al siguiente minuto.
    document.addEventListener("visibilitychange", consultar);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [sigueVivo, cedula, pedido.pedido_id]);

  const id = pedido.pedido_id;
  const total = formatoPrecio(pedido.total);
  const fecha = pedido.fecha ? new Date(pedido.fecha) : null;
  const unidades = pedido.unidades !== undefined ? Number(pedido.unidades) : null;
  // El nombre enmascarado ya trae su punto («Juan P.»): sin esto, «Juan P..».
  const saludo = nombre.trim().replace(/\.+$/, "");
  const pasoActual = Math.min(Math.max(seguimiento.paso, 0), ULTIMO_PASO);

  return (
    <div className="contenedor pedreg">
      <header className="pedreg-cabecera">
        <div className="pedreg-check" aria-hidden="true">
          <Check size={40} strokeWidth={3} />
        </div>
        <h1 ref={tituloRef} tabIndex={-1} className="pedreg-titulo">
          ¡Tu pedido está registrado!
        </h1>
        <p className="pedreg-texto">
          Gracias{saludo ? `, ${saludo}` : ""}. Lo recibimos y nuestro equipo ya lo tiene en su lista.
          Te contactaremos si hay alguna novedad.
        </p>
        <p className="pedreg-numero">
          <span>Número de pedido</span>
          <strong>#{id}</strong>
        </p>
      </header>

      <div className="pedreg-rejilla">
        <section className="pedreg-tarjeta" aria-labelledby="pedreg-resumen">
          <h2 id="pedreg-resumen" className="pedreg-subtitulo">
            <Receipt size={18} aria-hidden="true" /> Resumen de tu compra
          </h2>
          <dl className="pedreg-datos">
            <div>
              <dt>
                <Hash size={15} aria-hidden="true" /> Pedido
              </dt>
              <dd>#{id}</dd>
            </div>
            {fecha && (
              <div>
                <dt>
                  <CalendarClock size={15} aria-hidden="true" /> Fecha y hora
                </dt>
                <dd>
                  <time dateTime={pedido.fecha}>{FECHA.format(fecha)}</time>
                </dd>
              </div>
            )}
            {pedido.referencias !== undefined && (
              <div>
                <dt>
                  <Layers size={15} aria-hidden="true" /> Referencias
                </dt>
                <dd>{textoReferencias(pedido.referencias)}</dd>
              </div>
            )}
            {unidades !== null && Number.isFinite(unidades) && (
              <div>
                <dt>
                  <Boxes size={15} aria-hidden="true" /> Cantidad total
                </dt>
                <dd>{textoUnidades(unidades)}</dd>
              </div>
            )}
          </dl>
          <div className="pedreg-total">
            <span>Valor estimado</span>
            <strong>{total}</strong>
          </div>
          <AvisoPrecios compacto />
        </section>

        <section className="pedreg-tarjeta" aria-labelledby="pedreg-seguimiento">
          <div className="pedreg-seguimiento-cab">
            <h2 id="pedreg-seguimiento" className="pedreg-subtitulo">
              <ClipboardList size={18} aria-hidden="true" /> Seguimiento
            </h2>
            <span className="pedreg-estado" aria-live="polite">
              {PASOS[pasoActual].etiqueta}
            </span>
          </div>
          <ol className="pedreg-linea">
            {PASOS.map(({ etiqueta, detalle, Icono }, i) => {
              const estado = i < pasoActual ? "hecho" : i === pasoActual ? "actual" : "pendiente";
              return (
                <li key={etiqueta} className={`pedreg-paso pedreg-paso--${estado}`} aria-current={estado === "actual" ? "step" : undefined}>
                  <span className="pedreg-paso-icono" aria-hidden="true">
                    {estado === "hecho" ? <Check size={16} strokeWidth={3} /> : <Icono size={16} />}
                  </span>
                  <span className="pedreg-paso-texto">
                    <b>{etiqueta}</b>
                    {estado === "actual" && <small>{detalle}</small>}
                    <span className="sr-only">
                      {estado === "hecho" ? " (completado)" : estado === "pendiente" ? " (pendiente)" : " (estado actual)"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          {sigueVivo ? (
            <p className="pedreg-nota">
              <RefreshCw size={13} aria-hidden="true" />
              <span>
                Se actualiza solo mientras tengas esta página abierta
                {consultado && <> · revisado a las {HORA.format(consultado)}</>}
              </span>
            </p>
          ) : cedula === null && pasoActual < ULTIMO_PASO && config.whatsapp_numero ? (
            <p className="pedreg-nota">
              <span>¿Quieres saber cómo va? Escríbenos por WhatsApp con tu número de pedido.</span>
            </p>
          ) : null}
        </section>
      </div>

      <nav className="pedreg-acciones" aria-label="Qué hacer ahora">
        {config.whatsapp_numero && (
          <a
            className="btn btn-whatsapp"
            href={whatsappHref(
              config.whatsapp_numero,
              mensajeDeConsulta(config.whatsapp_mensaje_pedido, id, nombre, total)
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon size={18} /> Consultar por WhatsApp
          </a>
        )}
        {cedula !== null && (
          <Link className="btn btn-outline" href="/tienda/mis-pedidos">
            <ClipboardList size={18} aria-hidden="true" /> Ver mis pedidos
          </Link>
        )}
        <Link className="btn btn-verde" href="/tienda">
          <Store size={18} aria-hidden="true" /> Volver a la tienda
        </Link>
      </nav>
    </div>
  );
});
