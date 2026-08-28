import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cambiarNegocio as apiCambiarNegocio, cerrarSesion as apiLogout, obtenerPerfil } from "../api/auth";
import { tokenStore } from "../api/client";
import { obtenerSiteConfig } from "../api/content";
import type { Negocio, Usuario } from "../types";

interface Marca {
  nombreEmpresa: string;
  logoUrl: string | null;
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
      .then((c) => setMarca({ nombreEmpresa: c.nombre_empresa, logoUrl: c.logo_url }))
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
