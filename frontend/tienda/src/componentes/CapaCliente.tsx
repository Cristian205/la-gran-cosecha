"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CartDrawer } from "./CartDrawer";
import { MobileCartBar } from "./MobileCartBar";
import { WhatsAppButton } from "./WhatsAppButton";
import { BottomNav } from "./BottomNav";
import type { SiteConfig } from "@/lib/tipos";

/**
 * El envoltorio interactivo de la tienda.
 *
 * La configuración del negocio llega YA RESUELTA desde el servidor y aquí solo
 * se reparte. En la tienda anterior este contexto la pedía por su cuenta con
 * un efecto, lo que dejaba la primera pintura sin identidad; ahora el HTML sale
 * del servidor con los colores y los textos correctos y esto solo permite que
 * los componentes de cliente la consulten sin pasarla de mano en mano.
 */
const ContextoConfig = createContext<SiteConfig | null>(null);

/**
 * Conserva la forma `{ config, cargando }` que ya usaban los componentes.
 *
 * `cargando` es siempre false y se mantiene a propósito: la configuración
 * llega resuelta del servidor, pero cambiar la firma obligaría a tocar los
 * diez componentes que la consultan sin ganar nada.
 */
export function useSiteConfig(): { config: SiteConfig; cargando: boolean } {
  const config = useContext(ContextoConfig);
  if (!config) {
    throw new Error("useSiteConfig debe usarse dentro de CapaCliente");
  }
  return { config, cargando: false };
}

/**
 * Abre el carrito y comparte el texto buscado.
 *
 * En la tienda anterior este estado vivía en `App.tsx` y bajaba por
 * propiedades hasta la barra y el catálogo. Con el enrutado de Next ya no hay
 * un componente común que lo sostenga —cada ruta es su propio árbol—, así que
 * sube al contexto. La barra escribe y el catálogo lee.
 */
interface Envoltorio {
  abrirCarrito: () => void;
  busqueda: string;
  buscar: (valor: string) => void;
}

const ContextoEnvoltorio = createContext<Envoltorio | null>(null);

export function useEnvoltorio(): Envoltorio {
  const ctx = useContext(ContextoEnvoltorio);
  if (!ctx) throw new Error("useEnvoltorio debe usarse dentro de CapaCliente");
  return ctx;
}

export function CapaCliente({
  config,
  children,
}: {
  config: SiteConfig;
  children: ReactNode;
}) {
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  return (
    <ContextoConfig.Provider value={config}>
      <ContextoEnvoltorio.Provider
        value={{
          abrirCarrito: () => setCarritoAbierto(true),
          busqueda,
          buscar: setBusqueda,
        }}
      >
        {children}
        <BottomNav />
        <WhatsAppButton />
        <MobileCartBar onAbrir={() => setCarritoAbierto(true)} />
        {carritoAbierto && <CartDrawer onCerrar={() => setCarritoAbierto(false)} />}
      </ContextoEnvoltorio.Provider>
    </ContextoConfig.Provider>
  );
}
