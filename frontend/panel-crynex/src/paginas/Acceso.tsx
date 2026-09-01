import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { api, sesion } from "../api/cliente";
import { Boton } from "../ui/basicos";
import logoCrynex from "../assets/logo-crynex-inverso.webp";

/**
 * Entrar al Control Center.
 *
 * Mismo login en dos pasos que el panel de negocio: correo y contraseña, y
 * después el código que llega por correo. Se reutiliza tal cual en vez de
 * inventar otro; lo que cambia es a dónde se entra, no cómo se comprueba quién
 * eres.
 *
 * Es la única pantalla de la plataforma que ve alguien que todavía no ha
 * entrado, así que es la única donde el fondo hace trabajo de marca. Dentro,
 * el mismo tratamiento robaría atención a los datos.
 */
export function Acceso({ alEntrar }: { alEntrar: () => void }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ayudaClave, setAyudaClave] = useState(false);

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
      {/* Decorativas y en el DOM y no en el CSS del contenedor porque son dos
          capas con posiciones distintas; `aria-hidden` las saca del árbol de
          accesibilidad, que es todo lo que un lector de pantalla necesita
          saber de ellas. */}
      <span className="acceso__ondas acceso__ondas--izquierda" aria-hidden="true" />
      <span className="acceso__ondas acceso__ondas--derecha" aria-hidden="true" />

      <form
        className="acceso__tarjeta"
        onSubmit={paso === 1 ? enviarCredenciales : enviarCodigo}
      >
        {/* La variante inversa, no el logo original: su azul marino tiene
            contraste 1:1 contra este fondo y no se vería. El `alt` queda vacío
            porque el título que sigue ya dice dónde estás. */}
        <img className="acceso__logo" src={logoCrynex} alt="" width={698} height={556} />

        <h1>Control Center</h1>
        <p className="acceso__lema">
          {paso === 1
            ? "Administración de la plataforma."
            : `Enviamos un código de seis dígitos a ${email}.`}
        </p>

        {paso === 1 ? (
          <>
            <label className="campo">
              <span className="campo__etiqueta">Correo electrónico</span>
              <span className="campo-icono">
                <Mail size={16} aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ingresa tu correo electrónico"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </span>
            </label>

            <label className="campo">
              <span className="campo__etiqueta">Contraseña</span>
              <span className="campo-icono">
                <Lock size={16} aria-hidden="true" />
                <input
                  type={verClave ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="campo-icono__accion"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? "Ocultar la contraseña" : "Mostrar la contraseña"}
                >
                  {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {/* No es un enlace: no hay flujo de restablecimiento en la API, y
                un enlace que no lleva a ninguna parte enseña a desconfiar de
                los demás. Dice lo único que hoy es cierto. */}
            <div className="acceso__olvido">
              <button type="button" onClick={() => setAyudaClave((v) => !v)}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            {ayudaClave && (
              <p className="acceso__nota">
                Todavía no hay restablecimiento automático. Pídele a otro
                administrador de Crynex que te asigne una contraseña nueva; el
                sistema te obligará a cambiarla al entrar.
              </p>
            )}
          </>
        ) : (
          <label className="campo">
            <span className="campo__etiqueta">Código de verificación</span>
            <span className="campo-icono">
              <KeyRound size={16} aria-hidden="true" />
              <input
                className="acceso__codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="······"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                required
                autoFocus
              />
            </span>
          </label>
        )}

        {error && (
          <p className="aviso aviso--malo" role="alert">
            {error}
          </p>
        )}

        <Boton
          variante="primario"
          type="submit"
          cargando={enviando}
          className="acceso__enviar"
        >
          {paso === 1 ? "Continuar" : "Entrar"}
          {!enviando && <ArrowRight size={16} />}
        </Boton>

        {paso === 2 && (
          <button
            type="button"
            className="acceso__volver"
            onClick={() => {
              setPaso(1);
              setCodigo("");
              setError(null);
            }}
          >
            Usar otro correo
          </button>
        )}

        <p className="acceso__sello">
          <ShieldCheck size={14} aria-hidden="true" />
          Acceso seguro
        </p>
      </form>

      <p className="acceso__pie">
        © {new Date().getFullYear()} CryneX. Todos los derechos reservados.
      </p>
    </main>
  );
}
