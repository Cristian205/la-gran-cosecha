"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, SquarePlus, X } from "lucide-react";
import { useSiteConfig } from "./CapaCliente";

/**
 * Invita al cliente a instalar la tienda como app en su teléfono o su PC.
 *
 * Hay dos caminos, porque los navegadores no se ponen de acuerdo:
 *
 * - Chrome, Edge, Samsung Internet (Android y PC): avisan con el evento
 *   `beforeinstallprompt` cuando la tienda es instalable. Se guarda y el botón
 *   «Instalar» abre el diálogo nativo del navegador, un toque y listo.
 * - Safari en iPhone/iPad: no hay evento ni diálogo; la única vía es
 *   «Compartir → Agregar a inicio». Ahí el aviso explica esos dos pasos.
 *
 * Firefox de escritorio no instala apps web: no se muestra nada.
 *
 * Si el cliente lo cierra, no vuelve a aparecer en dos semanas: insistir en
 * cada visita lo convertiría en estorbo. Ya instalada (abierta desde el
 * ícono), nunca aparece.
 */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLAVE_DESCARTE = "kryonx_instalar_descartado";
const PAUSA_TRAS_DESCARTE = 14 * 24 * 60 * 60 * 1000;
const ESPERA_ANTES_DE_MOSTRAR = 4000;

function yaInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iOS no entiende `display-mode`: usa esta propiedad propia.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function esIOS(): boolean {
  const ua = navigator.userAgent;
  // Los iPad recientes se presentan como Mac; los delata la pantalla táctil.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function descartadoHacePoco(): boolean {
  try {
    const cuando = Number(localStorage.getItem(CLAVE_DESCARTE));
    return !!cuando && Date.now() - cuando < PAUSA_TRAS_DESCARTE;
  } catch {
    return false;
  }
}

export function InstalarApp() {
  const { config } = useSiteConfig();
  const pathname = usePathname();
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [modo, setModo] = useState<"nativo" | "ios" | null>(null);
  const [visible, setVisible] = useState(false);

  // El service worker es requisito para que el navegador ofrezca instalar.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (yaInstalada() || descartadoHacePoco()) return;

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const mostrarLuego = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setVisible(true), ESPERA_ANTES_DE_MOSTRAR);
    };

    const alPoderInstalar = (e: Event) => {
      e.preventDefault(); // Sin esto, Chrome pone su propia barra encima.
      setEvento(e as EventoInstalacion);
      setModo("nativo");
      mostrarLuego();
    };
    const alInstalar = () => {
      setVisible(false);
      setEvento(null);
    };

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);

    // Solo Safari de iOS: los otros navegadores del iPhone (Chrome, Firefox)
    // no ofrecen «Agregar a inicio» de la misma forma.
    if (esIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent)) {
      setModo("ios");
      mostrarLuego();
    }

    return () => {
      clearTimeout(temporizador);
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  // En el checkout el cliente está pagando: nada que lo distraiga.
  if (!visible || !modo || pathname === "/tienda/pedido") return null;

  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE_DESCARTE, String(Date.now()));
    } catch {
      /* sin almacenamiento: solo se cierra por ahora */
    }
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") setVisible(false);
    else cerrar();
  };

  const nombre = config.nombre_empresa || "la tienda";

  return (
    <aside className="instalar-app" role="dialog" aria-label={`Instalar la app de ${nombre}`}>
      {/* El mismo ícono que tendrá en el teléfono: así se reconoce después. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="instalar-app-logo" src="/icono-app/192" alt="" width={44} height={44} />      <div className="instalar-app-texto">
        <strong>Instala la app de {nombre}</strong>
        {modo === "ios" ? (
          <span>
            Toca <Share size={14} aria-label="Compartir" className="instalar-app-glifo" /> y luego{" "}
            <b>
              <SquarePlus size={14} aria-hidden className="instalar-app-glifo" /> Agregar a inicio
            </b>
            .
          </span>
        ) : (
          <span>Pide más rápido desde tu pantalla de inicio, sin buscar el enlace.</span>
        )}
      </div>
      {modo === "nativo" && evento && (
        <button type="button" className="instalar-app-boton" onClick={instalar}>
          Instalar
        </button>
      )}
      <button type="button" className="instalar-app-cerrar" onClick={cerrar} aria-label="Cerrar">
        <X size={18} />
      </button>
    </aside>
  );
}
