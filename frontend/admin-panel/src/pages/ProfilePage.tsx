import { Mail, ShieldCheck, Clock, CalendarPlus } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { formatoFecha } from "../utils";

function iniciales(nombre?: string): string {
  if (!nombre) return "?";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function ProfilePage() {
  const { usuario } = useAuth();

  return (
    <>
      <div className="topbar">
        <h1>Perfil</h1>
      </div>

      <div className="contenido">
        <div className="panel">
          <div className="cabecera-perfil">
            <span className="avatar grande">{iniciales(usuario?.nombre_usuario)}</span>
            <div>
              <h2>{usuario?.nombre_usuario}</h2>
              <span className={`badge ${usuario?.is_active ? "activo" : "inactivo"}`}>
                {usuario?.is_active ? "Cuenta activa" : "Cuenta inactiva"}
              </span>
            </div>
          </div>

          <div className="perfil-datos">
            <div className="perfil-dato">
              <span className="icono">
                <Mail size={18} />
              </span>
              <div>
                <div className="label">Correo electrónico</div>
                <div className="valor">{usuario?.email_usuario}</div>
              </div>
            </div>

            <div className="perfil-dato">
              <span className="icono">
                <ShieldCheck size={18} />
              </span>
              <div>
                <div className="label">Rol</div>
                <div className="valor">{usuario?.rol_usuario}</div>
              </div>
            </div>

            <div className="perfil-dato">
              <span className="icono">
                <Clock size={18} />
              </span>
              <div>
                <div className="label">Último acceso</div>
                <div className="valor">
                  {formatoFecha(usuario?.ultimo_login_exitoso ?? null)}
                </div>
              </div>
            </div>

            <div className="perfil-dato">
              <span className="icono">
                <CalendarPlus size={18} />
              </span>
              <div>
                <div className="label">Cuenta creada</div>
                <div className="valor">
                  {formatoFecha(usuario?.fecha_creacion ?? null)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
