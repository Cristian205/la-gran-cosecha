import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { obtenerSiteConfig } from "../api/content";
import { aplicarColorPrimario } from "../theming";
import type { SiteConfig } from "../types";

const VACIO: SiteConfig = {
  logo_url: null,
  color_primario: "",
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
        aplicarColorPrimario(c.color_primario);
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
