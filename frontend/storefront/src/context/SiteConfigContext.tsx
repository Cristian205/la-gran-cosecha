import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { obtenerSiteConfig } from "../api/content";
import { aplicarTema } from "../theming";
import type { SiteConfig } from "../types";

const VACIO: SiteConfig = {
  logo_url: null,
  color_primario: "",
  color_primario_texto: "",
  color_secundario: "",
  color_secundario_texto: "",
  color_fondo: "",
  color_superficie: "",
  color_texto: "",
  fuente: "poppins",
  radio_boton: "redondeado",
  ancho_buscador: 420,
  espaciado_navbar: 0,
  whatsapp_numero: "",
  whatsapp_mensaje_pedido: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  horario: "",
  historia: "",
  mision: "",
  paso1_titulo: "Explora el catálogo",
  paso1_texto: "Filtra por categoría o busca directo lo que necesitas para tu negocio.",
  paso2_titulo: "Arma tu pedido",
  paso2_texto: "Elige presentación, unidad y cantidad — hasta fraccionada si el producto lo permite.",
  paso3_titulo: "Recibe tu entrega",
  paso3_texto: "Confirmamos contigo por WhatsApp y despachamos directo a tu negocio.",
  cotizacion_titulo: "¿Pedido grande o fuera de catálogo?",
  cotizacion_texto: "Cuéntanos qué necesitas y te confirmamos precio y disponibilidad en minutos.",
  cta_final_titulo: "Tu próximo pedido puede estar en camino hoy mismo",
  cta_final_texto: "Explora el catálogo completo y arma tu pedido en minutos.",
};

interface SiteConfigState {
  config: SiteConfig;
  cargando: boolean;
}

const SiteConfigContext = createContext<SiteConfigState>({ config: VACIO, cargando: true });

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(VACIO);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerSiteConfig()
      .then((c) => {
        setConfig(c);
        aplicarTema(c);
      })
      .catch(() => setConfig(VACIO))
      .finally(() => setCargando(false));
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, cargando }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
