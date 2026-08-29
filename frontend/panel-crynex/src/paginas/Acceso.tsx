import { useState } from "react";
import { api, sesion } from "../api/cliente";

/**
 * Entrar al panel de Crynex.
 *
 * Mismo login en dos pasos que el panel de negocio: correo y contraseña, y
 * después el código que llega por correo. Se reutiliza tal cual en vez de
 * inventar otro; lo que cambia es a dónde se entra, no cómo se comprueba
 * quién eres.
 */
export function Acceso({ alEntrar }: { alEntrar: () => void }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarCredenciales(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<{ otp_ticket: string }>("/auth/login/", {
        email_usuario: email,
        password,
      });
      setTicket(r.otp_ticket);
      setPaso(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<{ access: string; refresh: string }>(
        "/auth/verify-otp/",
        { otp_ticket: ticket, otp_token: codigo }
      );
      sesion.guardar(r.access, r.refresh);

      // Tener sesión no es lo mismo que poder administrar Crynex: se comprueba
      // aquí para dar un mensaje claro en vez de un panel vacío lleno de 403.
      try {
        await api.get("/platform/resumen/");
      } catch {
        sesion.cerrar();
        setError("Tu cuenta no administra Crynex. Entra por el panel de tu negocio.");
        setPaso(1);
        return;
      }
      alEntrar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="acceso">
      <form
        className="acceso-tarjeta"
        onSubmit={paso === 1 ? enviarCredenciales : enviarCodigo}
      >
        <span className="marca">Crynex</span>
        <h1>Administración de la plataforma</h1>

        {paso === 1 ? (
          <>
            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
          </>
        ) : (
          <label>
            Código enviado a tu correo
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              required
              autoFocus
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? "Un momento…" : paso === 1 ? "Continuar" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
