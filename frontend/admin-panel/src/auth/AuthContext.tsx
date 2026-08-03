import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cerrarSesion as apiLogout, obtenerPerfil } from "../api/auth";
import { tokenStore } from "../api/client";
import { obtenerSiteConfig } from "../api/content";
import type { Usuario } from "../types";

interface Marca {
  nombreEmpresa: string;
  logoUrl: string | null;
}

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  marca: Marca | null;
  setUsuario: (u: Usuario | null) => void;
  logout: () => void;
  refrescarMarca: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [marca, setMarca] = useState<Marca | null>(null);

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

  const value = useMemo(
    () => ({ usuario, cargando, marca, setUsuario, logout, refrescarMarca }),
    [usuario, cargando, marca]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
