import { Building2, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cambiarPassword } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { NotificationPreferences } from "./NotificationPreferences";
import { SidebarLayoutSettings } from "./SidebarLayoutSettings";
import { rutaDe } from "./configuracion/rutas";
import { extraerMensajeError } from "../utils";

export function SettingsPage() {
  const { marca } = useAuth();

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (passwordNueva !== passwordConfirmar) {
      setError("La confirmación no coincide con la contraseña nueva.");
      return;
    }

    setGuardando(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      setOk(true);
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirmar("");
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Preferencias</h1>
      </div>

      <div className="contenido">
        <div className="config-grid">
          <div className="config-area-menu">
            <SidebarLayoutSettings />
          </div>

          <div className="config-area-identidad">
            <div className="panel">
              <div className="cabecera">
                <h2>
                  <Building2 size={18} style={{ verticalAlign: "-3px", marginRight: ".4rem" }} />
                  Identidad del panel
                </h2>
              </div>
              <div style={{ padding: "1.2rem" }}>
                <p className="form-nota" style={{ marginTop: 0 }}>
                  El nombre y el logo de {marca?.nombreEmpresa || "tu negocio"} se cambian en el centro de
                  configuración, junto con el resto de su identidad.
                </p>
                <Link className="btn secundario" to={rutaDe("negocio/identidad")}>
                  Ir a Identidad del negocio
                </Link>
              </div>
            </div>
          </div>

          <div className="config-area-notificaciones">
            <NotificationPreferences />
          </div>

          <div className="config-area-password">
            <div className="panel">
              <div className="cabecera">
                <h2>
                  <KeyRound size={18} style={{ verticalAlign: "-3px", marginRight: ".4rem" }} />
                  Cambiar contraseña
                </h2>
              </div>
              <div style={{ padding: "1.2rem" }}>
                {ok && <div className="ok-box">Contraseña actualizada correctamente.</div>}
                <form onSubmit={guardar}>
                  {error && <div className="error-box">{error}</div>}

                  <div className="campo">
                    <label>Contraseña actual *</label>
                    <input
                      type="password"
                      value={passwordActual}
                      onChange={(e) => setPasswordActual(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="campo">
                    <label>Contraseña nueva *</label>
                    <input
                      type="password"
                      value={passwordNueva}
                      onChange={(e) => setPasswordNueva(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="campo">
                    <label>Confirmar contraseña nueva *</label>
                    <input
                      type="password"
                      value={passwordConfirmar}
                      onChange={(e) => setPasswordConfirmar(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>

                  <button className="btn primario" disabled={guardando}>
                    {guardando ? "Guardando…" : "Guardar cambios"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
