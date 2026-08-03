import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { ForzarCambioPasswordPage } from "../pages/ForzarCambioPasswordPage";
import { tienePermiso } from "../utils";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, cargando, setUsuario } = useAuth();

  if (cargando) {
    return <div className="pantalla-carga">Cargando…</div>;
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  if (usuario.debe_cambiar_password) {
    return (
      <ForzarCambioPasswordPage
        onCompletado={() => setUsuario({ ...usuario, debe_cambiar_password: false })}
      />
    );
  }
  return <>{children}</>;
}

/** Oculta una página (redirige al Dashboard) si el usuario no tiene el permiso "Ver X" del módulo. */
export function RequierePermiso({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { usuario } = useAuth();
  if (!tienePermiso(usuario, permiso)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
