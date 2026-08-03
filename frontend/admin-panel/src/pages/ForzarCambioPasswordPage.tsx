import { useState } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { cambiarPassword } from "../api/auth";
import { extraerMensajeError } from "../utils";

interface Props {
  onCompletado: () => void;
}

export function ForzarCambioPasswordPage({ onCompletado }: Props) {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordActual || !passwordNueva) {
      setError("Completa todos los campos.");
      return;
    }
    if (passwordNueva !== passwordConfirmar) {
      setError("La confirmación no coincide con la contraseña nueva.");
      return;
    }

    setGuardando(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      onCompletado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-carga" style={{ background: "var(--fondo)" }}>
      <div className="panel" style={{ width: "min(420px, 92vw)", margin: "0 auto" }}>
        <div className="cabecera">
          <h2>
            <ShieldAlert size={18} style={{ verticalAlign: "-3px", marginRight: ".4rem" }} />
            Cambia tu contraseña
          </h2>
        </div>
        <form onSubmit={guardar} style={{ padding: "1.2rem" }}>
          <p style={{ color: "var(--gris)", marginTop: 0, fontSize: ".9rem" }}>
            Por seguridad, debes establecer tu propia contraseña antes de continuar.
          </p>
          {error && <div className="error-box">{error}</div>}
          <div className="campo">
            <label>Contraseña actual (temporal) *</label>
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
          <button type="submit" className="btn primario" disabled={guardando} style={{ width: "100%" }}>
            <KeyRound size={16} /> {guardando ? "Guardando…" : "Cambiar contraseña y entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
