import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { pilaFuente, radioPx } from "../api/apariencia";
import { cambiarNegocio as apiCambiarNegocio, cerrarSesion as apiLogout, obtenerPerfil } from "../api/auth";
import { tokenStore } from "../api/client";
import { obtenerSiteConfig } from "../api/content";
import type { Negocio, Usuario } from "../types";

interface Marca {
  nombreEmpresa: string;
  logoUrl: string | null;
  /** El color de la empresa; solo tiñe su propio distintivo en el sidebar. */
  color: string;
}

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  marca: Marca | null;
  /** Los negocios en los que trabaja quien tiene la sesión abierta. */
  negocios: Negocio[];
  negocioActivo: Negocio | null;
  cambiandoNegocio: boolean;
  setUsuario: (u: Usuario | null) => void;
  cambiarNegocio: (slug: string) => Promise<void>;
  logout: () => void;
  refrescarMarca: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Pinta el panel con el tema del negocio, en `document.documentElement` para
 * que le llegue a todo de una sola vez.
 *
 * `--verde`/los anillos de foco/las insignias siguen fijos a propósito: el
 * panel es una herramienta de trabajo con sus contrastes ya revisados, y
 * teñir eso del color exacto de una boutique es donde el contraste con su
 * propio texto puede fallar (mismo criterio que la caja del POS, ver
 * `apps/pos/aspecto.py`). Tipografía y forma de botón no cargan ese riesgo
 * —ningún tamaño de fuente ni radio rompe la legibilidad— así que sí viajan
 * enteras, con el mismo criterio que ya usa la tienda: `radio_boton` es la
 * forma de los BOTONES, no de las tarjetas o paneles, y aplicarlo al radio
 * general dejaría cada panel ovalado si el negocio eligiera "redondeado".
 */
function aplicarVariablesDelTema(
  color: string,
  fuente: string,
  radioBoton: string,
  panelVariables?: Record<string, string>
) {
  const raiz = document.documentElement.style;
  raiz.setProperty("--marca-negocio", color);
  raiz.setProperty("--fuente-panel", pilaFuente(fuente));
  raiz.setProperty("--radio-boton", `${radioPx(radioBoton)}px`);
  for (const [variable, valor] of Object.entries(panelVariables ?? {})) {
    raiz.setProperty(variable, valor);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [cambiandoNegocio, setCambiandoNegocio] = useState(false);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setCargando(false);
      return;
    }
    obtenerPerfil()
      .then(setUsuario)
      .catch(() => tokenStore.clear())
      .finally(() => setCargando(false));
  }, []);

  const refrescarMarca = () => {
    obtenerSiteConfig()
      .then((c) => {
        const color = /^#[0-9a-f]{6}$/i.test(c.color_primario) ? c.color_primario : "#16a34a";
        setMarca({ nombreEmpresa: c.nombre_empresa, logoUrl: c.logo_url, color });
        aplicarVariablesDelTema(color, c.fuente, c.radio_boton, c.panel_variables);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refrescarMarca();
  }, []);

  const logout = () => {
    apiLogout();
    setUsuario(null);
  };

  const negocios = usuario?.negocios ?? [];
  const negocioActivo = negocios.find((n) => n.activo) ?? null;

  /**
   * Cambia de negocio y recarga la página.
   *
   * La recarga es deliberada: casi toda la pantalla —catálogo, pedidos,
   * clientes, marca— pertenece al negocio anterior, y vaciar cada caché a mano
   * dejaría antes o después algún dato del negocio equivocado a la vista.
   */
  const cambiarNegocio = async (slug: string) => {
    if (slug === negocioActivo?.slug) return;
    setCambiandoNegocio(true);
    try {
      await apiCambiarNegocio(slug);
      window.location.assign("/");
    } finally {
      setCambiandoNegocio(false);
    }
  };

  const value = useMemo(
    () => ({
      usuario,
      cargando,
      marca,
      negocios,
      negocioActivo,
      cambiandoNegocio,
      setUsuario,
      cambiarNegocio,
      logout,
      refrescarMarca,
    }),
    [usuario, cargando, marca, cambiandoNegocio]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
