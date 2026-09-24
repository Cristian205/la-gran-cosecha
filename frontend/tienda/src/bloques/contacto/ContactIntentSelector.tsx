"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Phone, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useEnvoltorio, useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { useCart } from "@/estado/carrito";
import { telHref, whatsappHref } from "@/lib/utiles";
import { TipografiaEditorial } from "../campanas/comunes";
import { ContactMobileBar } from "./ContactMobileBar";
import { ENLACE_DE, intencionDelEnlace, type Intencion } from "./intenciones";
import { CONVERSACION, COTIZACION, PRODUCTO_ESPECIAL, Solicitud } from "./Solicitud";

/**
 * "¿Cómo podemos ayudarte?": la página empieza preguntando, no pidiendo datos.
 *
 * Cuatro caminos grandes —hacer un pedido, cotizar, buscar un producto que
 * no aparece, hablar con alguien— y, al elegir uno, SOLO lo que ese camino
 * necesita:
 *
 *   pedido      no es un formulario: lleva a la tienda (o al pedido en curso)
 *   cotizacion  QuoteForm: el pedido grande, con cantidad y fecha
 *   producto    SpecialRequestForm: lo que no está en el catálogo
 *   hablar      WhatsApp o llamada directa, y un mensaje corto
 *
 * # Enlaces
 *
 * Cualquier enlace a `#cotizar`, `#buscar-producto`, `#hacer-pedido` o
 * `#hablar` —en esta página o desde otra (`/contacto#cotizar`)— abre su
 * camino aquí. Se escuchan los clics en captura porque el `Link` de Next
 * navega con `pushState` y no dispara `hashchange`.
 *
 * El id `contacto-form` se conserva: la búsqueda global lleva hasta aquí con
 * `?resaltar=contacto-form`.
 */
export interface OpcionIntencion {
  clave: Intencion;
  titulo?: string;
  texto?: string;
  /** El verbo del camino: "Hacer mi pedido". */
  accion?: string;
  /** Archivo de `/public/icons3d`. */
  icono?: string;
  panel_titulo?: string;
  panel_texto?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  texto?: string;
  opciones?: OpcionIntencion[];
  /** La barra inferior [Pedido] [WhatsApp] en móvil. */
  barra_movil?: boolean;
}

const ICONO_DE: Record<Intencion, string> = {
  pedido: "canasta.png",
  cotizacion: "lista.png",
  producto: "buscar.png",
  hablar: "soporte.png",
};

export function ContactIntentSelector({
  kicker = "",
  titulo = "¿Cómo podemos ayudarte?",
  texto = "",
  opciones = [],
  barra_movil = true,
}: Props) {
  const lista = opciones.filter((o) => o.clave && ENLACE_DE[o.clave] && o.titulo);
  const [activa, setActiva] = useState<Intencion | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const encabezadoPanel = useRef<HTMLHeadingElement>(null);
  const pendiente = useRef<"enlace" | "tarjeta" | null>(null);
  // Cuenta las elecciones: volver a pulsar "Cotizar" con la cotización ya
  // abierta no cambia `activa`, pero sí tiene que llevar la vista al panel.
  const [peticion, setPeticion] = useState(0);

  const elegir = useCallback((i: Intencion, origen: "enlace" | "tarjeta") => {
    pendiente.current = origen;
    setActiva(i);
    setPeticion((n) => n + 1);
  }, []);

  // Después de pintar el camino: desde un enlace se lleva la vista (y el
  // foco) al panel; desde una tarjeta solo se desplaza si el panel quedó
  // fuera de la pantalla, como pasa en móvil.
  useEffect(() => {
    const origen = pendiente.current;
    pendiente.current = null;
    if (!activa || !origen) return;
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el) return;
      const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const fuera = el.getBoundingClientRect().top > window.innerHeight * 0.7;
      if (origen === "enlace" || fuera) el.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
      if (origen === "enlace") encabezadoPanel.current?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(t);
  }, [activa, peticion]);

  useEffect(() => {
    const desdeUrl = intencionDelEnlace(window.location.hash);
    if (desdeUrl) {
      elegir(desdeUrl, "enlace");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    function alClic(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace) return;
      const url = new URL(enlace.href, window.location.href);
      if (url.pathname !== window.location.pathname) return;
      const i = intencionDelEnlace(url.hash);
      if (!i) return;
      e.preventDefault();
      e.stopPropagation();
      elegir(i, "enlace");
    }
    function alCambiarHash() {
      const i = intencionDelEnlace(window.location.hash);
      if (i) elegir(i, "enlace");
    }
    document.addEventListener("click", alClic, true);
    window.addEventListener("hashchange", alCambiarHash);
    return () => {
      document.removeEventListener("click", alClic, true);
      window.removeEventListener("hashchange", alCambiarHash);
    };
  }, [elegir]);

  if (lista.length === 0) return null;
  const opcion = lista.find((o) => o.clave === activa);

  return (
    <section id="contacto-form" className="ct-int" aria-labelledby="ct-int-titulo" data-activa={activa ?? undefined}>
      <TipografiaEditorial />
      <div className="cmp-inner">
        <header className="ct-int-cabecera">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2 id="ct-int-titulo">{titulo}</h2>
          {texto && <p>{texto}</p>}
        </header>

        <ul className="ct-int-caminos">
          {lista.map((o, i) => {
            const elegida = o.clave === activa;
            return (
              <li key={o.clave} style={{ "--i": i } as CSSProperties}>
                <button
                  type="button"
                  className={`ct-camino ${elegida ? "ct-camino--activo" : ""}`}
                  aria-expanded={elegida}
                  aria-controls="ct-int-panel"
                  onClick={() => elegir(o.clave, "tarjeta")}
                >
                  <span className="ct-camino-icono" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/icons3d/${o.icono || ICONO_DE[o.clave]}`} alt="" width={64} height={64} loading="lazy" decoding="async" />
                  </span>
                  <span className="ct-camino-titulo">{o.titulo}</span>
                  {o.texto && <span className="ct-camino-texto">{o.texto}</span>}
                  {o.accion && (
                    <span className="ct-camino-accion">
                      {o.accion} <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div ref={panel} id="ct-int-panel" className="ct-int-panel">
          <AnimatePresence mode="wait" initial={false}>
            {opcion && (
              <motion.div
                key={opcion.clave}
                className="ct-panel"
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="ct-panel-cabecera">
                  <h3 ref={encabezadoPanel} tabIndex={-1}>
                    {opcion.panel_titulo || opcion.titulo}
                  </h3>
                  {opcion.panel_texto && <p>{opcion.panel_texto}</p>}
                </div>
                <div className="ct-panel-cuerpo">
                  {opcion.clave === "pedido" && <CaminoPedido />}
                  {opcion.clave === "cotizacion" && <Solicitud def={COTIZACION} />}
                  {opcion.clave === "producto" && <Solicitud def={PRODUCTO_ESPECIAL} />}
                  {opcion.clave === "hablar" && <CaminoHablar />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {barra_movil && <ContactMobileBar />}
    </section>
  );
}

/**
 * "Ya sé qué necesito": no se le pide nada, se le lleva a comprar. Si ya
 * tiene productos en su pedido, lo primero es verlo; si el negocio no recibe
 * pedidos en línea, el camino es WhatsApp.
 */
function CaminoPedido() {
  const { config } = useSiteConfig();
  const { abrirCarrito } = useEnvoltorio();
  const lineas = useCart((s) => s.totalLineas());
  const enLinea = config.acepta_pedidos_online !== false;
  const wa = config.whatsapp_numero
    ? whatsappHref(config.whatsapp_numero, "Hola, quiero hacer un pedido. Esta es mi lista:")
    : "";

  if (!enLinea) {
    return (
      <div className="ct-pedido">
        <p className="ct-pedido-nota">Por ahora recibimos los pedidos directamente con el equipo.</p>
        <div className="ct-pedido-acciones">
          {wa && (
            <a className="cmp-btn cmp-btn--ambar" href={wa} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon size={18} /> <span>Enviar mi lista por WhatsApp</span>
            </a>
          )}
          <Link className="ct-enlace" href="/tienda">
            Ver productos <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-pedido">
      <ol className="ct-pedido-pasos">
        <li>
          <span>Busca</span> tus productos en la tienda.
        </li>
        <li>
          <span>Agrégalos</span> con la cantidad que necesitas.
        </li>
        <li>
          <span>Envía</span> tu pedido: te confirmamos el valor final antes de despachar.
        </li>
      </ol>
      <div className="ct-pedido-acciones">
        {lineas > 0 ? (
          <>
            <button type="button" className="cmp-btn cmp-btn--ambar" onClick={abrirCarrito}>
              <ShoppingBag size={18} aria-hidden="true" />
              <span>
                Ver mi pedido ({lineas} {lineas === 1 ? "producto" : "productos"})
              </span>
            </button>
            <Link className="ct-enlace" href="/tienda">
              Seguir agregando <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <Link className="cmp-btn cmp-btn--ambar" href="/tienda">
            <span>Hacer mi pedido</span> <ArrowRight size={17} aria-hidden="true" />
          </Link>
        )}
        {wa && (
          <a className="ct-enlace" href={wa} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={16} /> ¿Prefieres dictarnos la lista? Escríbela por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

/** "Quiero hablar con alguien": primero los canales directos, luego un mensaje. */
function CaminoHablar() {
  const { config } = useSiteConfig();
  return (
    <>
      {(config.whatsapp_numero || config.telefono) && (
        <div className="ct-directo">
          <p>¿Prefieres hablar directamente?</p>
          <div className="ct-directo-acciones">
            {config.whatsapp_numero && (
              <a
                className="cmp-btn cmp-btn--ambar"
                href={whatsappHref(
                  config.whatsapp_numero,
                  `Hola, tengo una pregunta para el equipo${config.nombre_empresa ? ` de ${config.nombre_empresa}` : ""}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={18} /> <span>Escribir por WhatsApp</span>
              </a>
            )}
            {config.telefono && (
              <a className="ct-enlace" href={telHref(config.telefono)}>
                <Phone size={16} aria-hidden="true" /> Llamar al {config.telefono}
              </a>
            )}
          </div>
          <p className="ct-directo-o">o déjanos tu mensaje</p>
        </div>
      )}
      <Solicitud def={CONVERSACION} />
    </>
  );
}
