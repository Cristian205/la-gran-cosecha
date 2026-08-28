import { Building2, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

/**
 * Pantalla para una sesión válida que ya no tiene ningún negocio.
 *
 * Ocurre de verdad desde que dar de baja a alguien o suspender un negocio
 * surte efecto de inmediato: la persona sigue con la sesión abierta y el token
 * sin caducar, pero no le queda nada que administrar. Sin esta pantalla vería
 * el panel entero en blanco, con errores en cada sección y sin ninguna pista
 * de qué ha pasado.
 */
export function SinNegocioPage() {
  const { usuario, logout } = useAuth();

  return (
    <div className="sin-negocio">
      <div className="sin-negocio-tarjeta">
        <span className="sin-negocio-icono">
          <Building2 size={26} />
        </span>

        <h1>Tu cuenta no está en ningún negocio</h1>

        <p>
          Iniciaste sesión como <strong>{usuario?.email_usuario}</strong>, pero
          ahora mismo no tienes acceso a ningún negocio. Puede que te hayan dado
          de baja, o que el negocio esté suspendido.
        </p>

        <p className="sin-negocio-ayuda">
          Habla con quien administra el negocio para que te dé acceso de nuevo.
        </p>

        <button type="button" className="btn-secundario" onClick={logout}>
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
