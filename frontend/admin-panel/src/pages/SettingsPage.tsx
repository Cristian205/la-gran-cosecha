import { Building2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { cambiarPassword } from "../api/auth";
import { actualizarSiteConfig } from "../api/content";
import { useAuth } from "../auth/AuthContext";
import { MediaField } from "../components/MediaField";
import { NotificationPreferences } from "./NotificationPreferences";
import { SidebarLayoutSettings } from "./SidebarLayoutSettings";
import type { SiteConfig } from "../types";
import { extraerMensajeError } from "../utils";

export function SettingsPage() {
  const { marca, refrescarMarca } = useAuth();

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [errorMarca, setErrorMarca] = useState<string | null>(null);
  const [okMarca, setOkMarca] = useState(false);

  useEffect(() => {
    if (marca) setNombreEmpresa(marca.nombreEmpresa);
  }, [marca]);

  async function guardarMarca(e: React.FormEvent) {
    e.preventDefault();
    setErrorMarca(null);
    setOkMarca(false);
    setGuardandoMarca(true);
    try {
      const cambios: Partial<SiteConfig> = { nombre_empresa: nombreEmpresa };
      await actualizarSiteConfig(cambios, logo);
      setLogo(null);
      setOkMarca(true);
      refrescarMarca();
    } catch (err) {
      setErrorMarca(extraerMensajeError(err, "No se pudo guardar la identidad del panel."));
    } finally {
      setGuardandoMarca(false);
    }
  }

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
        <h1>Configuración</h1>
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
              {!marca ? (
                <div className="vacio">Cargando…</div>
              ) : (
                <form onSubmit={guardarMarca} style={{ padding: "1.2rem" }}>
                  {errorMarca && <div className="error-box">{errorMarca}</div>}
                  {okMarca && <div className="ok-box">Identidad actualizada correctamente.</div>}

                  <div style={{ marginBottom: "1rem" }}>
                    <MediaField
                      valor={logo}
                      urlActual={marca?.logoUrl ?? null}
                      onCambiar={setLogo}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      ayuda="Se muestra en el menú lateral del panel y en la tienda pública."
                    />
                  </div>

                  <div className="campo">
                    <label>Nombre de la empresa</label>
                    <input
                      value={nombreEmpresa}
                      onChange={(e) => setNombreEmpresa(e.target.value)}
                      placeholder="La Gran Cosecha"
                    />
                  </div>

                  <button className="btn primario" disabled={guardandoMarca}>
                    {guardandoMarca ? "Guardando…" : "Guardar cambios"}
                  </button>
                </form>
              )}
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
