import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Headset,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { loginPaso1, verificarOtp } from "../api/auth";
import { cargarMarca, type MarcaNegocio } from "../api/marca";
import { useAuth } from "../auth/AuthContext";
import { extraerMensajeError } from "../utils";
import { ForzarCambioPasswordPage } from "./ForzarCambioPasswordPage";
import type { Usuario } from "../types";
import "./LoginPage.css";

const OTP_LENGTH = 6;

export function LoginPage() {
  const { setUsuario } = useAuth();
  const navigate = useNavigate();

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [ticket, setTicket] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ayudaClave, setAyudaClave] = useState(false);
  const [usuarioPendiente, setUsuarioPendiente] = useState<Usuario | null>(null);
  const [marca, setMarca] = useState<MarcaNegocio | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // La identidad del negocio la resuelve el backend por el host. Si falla, la
  // pantalla se pinta igual con su verde por defecto: no poder entrar porque
  // no cargó un logo sería absurdo.
  useEffect(() => {
    cargarMarca().then(setMarca).catch(() => undefined);
  }, []);

  async function enviarCredenciales(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resp = await loginPaso1(email, password);
      setTicket(resp.otp_ticket);
      setPaso(2);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setAviso(resp.message || "Enviamos un código de verificación a tu correo.");
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo iniciar sesión."));
    } finally {
      setCargando(false);
    }
  }

  async function confirmarOtp(codigo: string) {
    setError(null);
    setCargando(true);
    try {
      const resp = await verificarOtp(ticket, codigo, recordar);
      setUsuario(resp.user);
      if (resp.user.debe_cambiar_password) {
        setUsuarioPendiente(resp.user);
        setPaso(3);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(extraerMensajeError(err, "Código incorrecto o expirado."));
    } finally {
      setCargando(false);
    }
  }

  function enviarOtp(e: React.FormEvent) {
    e.preventDefault();
    const codigo = otpDigits.join("");
    if (codigo.length !== OTP_LENGTH) {
      setError("Debe ingresar los 6 dígitos.");
      return;
    }
    confirmarOtp(codigo);
  }

  function cambiarDigito(index: number, valor: string) {
    const limpio = valor.replace(/[^0-9]/g, "").slice(-1);
    setOtpDigits((prev) => {
      const siguiente = [...prev];
      siguiente[index] = limpio;
      return siguiente;
    });
    if (limpio && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function manejarTeclaOtp(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function pegarOtp(e: React.ClipboardEvent) {
    const pegado = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    if (pegado.length === OTP_LENGTH) {
      e.preventDefault();
      setOtpDigits(pegado.split(""));
      otpRefs.current[OTP_LENGTH - 1]?.focus();
      confirmarOtp(pegado);
    }
  }

  if (paso === 3 && usuarioPendiente) {
    return (
      <ForzarCambioPasswordPage
        onCompletado={() => {
          setUsuario({ ...usuarioPendiente, debe_cambiar_password: false });
          navigate("/");
        }}
      />
    );
  }

  const nombre = marca?.nombre?.trim() || "";

  return (
    <div
      className="acceso"
      // El color del negocio entra como variable y no como estilo suelto: de
      // aquí lo heredan el botón, los iconos y los focos sin repetirlo.
      style={marca ? ({ "--marca": marca.color } as React.CSSProperties) : undefined}
    >
      {/* ---------------------------------------------------- panel de marca */}
      <section className="acceso__marca">
        {marca?.fondo && (
          // La foto es del propio negocio (su primer banner). Va muy velada y
          // desenfocada: aporta textura, no información, y así el texto que
          // los banners llevan encima no compite con el formulario.
          <img className="acceso__foto" src={marca.fondo} alt="" aria-hidden="true" />
        )}
        <span className="acceso__velo" aria-hidden="true" />
        <span className="acceso__curva" aria-hidden="true" />
        <span className="acceso__puntos acceso__puntos--alto" aria-hidden="true" />
        <span className="acceso__puntos acceso__puntos--bajo" aria-hidden="true" />

        <div className="acceso__marca-cuerpo">
          <span className="acceso__hilo" aria-hidden="true" />

          {marca?.logo ? (
            <div className="acceso__logo-caja">
              <img src={marca.logo} alt={nombre || "Logo del negocio"} />
            </div>
          ) : (
            nombre && <p className="acceso__negocio">{nombre}</p>
          )}

          <h1 className="acceso__titulo">
            Control de calidad
            <span>Administrativo</span>
          </h1>

          <hr className="acceso__regla" />

          <p className="acceso__lema">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              Sistema integral para la gestión y supervisión de procesos de
              calidad. Información segura, decisiones confiables.
            </span>
          </p>
        </div>

        <footer className="acceso__pie">
          <span className="acceso__sello" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <span>
            <strong>
              © {new Date().getFullYear()} {nombre || "Panel administrativo"}
            </strong>
            Sistema de acceso restringido para personal autorizado.
          </span>
        </footer>
      </section>

      {/* --------------------------------------------------------- formulario */}
      <section className="acceso__panel">
        <div className="acceso__tarjeta">
          <span className="acceso__escudo" aria-hidden="true">
            <ShieldCheck size={24} />
          </span>

          <h2>{paso === 1 ? "Identificación" : "Verificación"}</h2>
          <span className="acceso__subrayado" aria-hidden="true" />
          <p className="acceso__intro">
            {paso === 1
              ? "Inicie sesión para acceder al panel de control."
              : aviso || "Hemos enviado un código de acceso a su correo."}
          </p>

          {error && (
            <p className="acceso__error" role="alert">
              {error}
            </p>
          )}

          {paso === 1 ? (
            <form onSubmit={enviarCredenciales} noValidate>
              <label className="acceso__campo">
                <span className="acceso__rotulo">Correo electrónico</span>
                <span className="acceso__entrada">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </span>
              </label>

              <label className="acceso__campo">
                <span className="acceso__rotulo">Clave de seguridad</span>
                <span className="acceso__entrada">
                  <Lock size={17} aria-hidden="true" />
                  <input
                    type={verClave ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="acceso__ojo"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label={verClave ? "Ocultar la clave" : "Mostrar la clave"}
                  >
                    {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <div className="acceso__opciones">
                <label className="acceso__recordar">
                  <input
                    type="checkbox"
                    checked={recordar}
                    onChange={(e) => setRecordar(e.target.checked)}
                  />
                  <span>Recordar sesión</span>
                </label>

                {/* No es un enlace: la API no tiene restablecimiento, y un
                    enlace que no lleva a ninguna parte enseña a desconfiar de
                    los demás. Dice lo único que hoy es cierto. */}
                <button
                  type="button"
                  className="acceso__olvido"
                  onClick={() => setAyudaClave((v) => !v)}
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>

              {ayudaClave && (
                <p className="acceso__nota">
                  Todavía no hay restablecimiento automático. Pídale a un
                  administrador de su empresa que le asigne una clave nueva; el
                  sistema le obligará a cambiarla al entrar.
                </p>
              )}

              <button type="submit" className="acceso__enviar" disabled={cargando}>
                {cargando ? "Verificando…" : "Entrar al sistema"}
                {!cargando && <ArrowRight size={18} />}
              </button>
            </form>
          ) : (
            <form onSubmit={enviarOtp}>
              <fieldset className="acceso__campo acceso__campo--otp">
                <legend>Código de seguridad</legend>
                <div className="acceso__otp">
                  {otpDigits.map((digito, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      maxLength={1}
                      inputMode="numeric"
                      pattern="\d*"
                      aria-label={`Dígito ${index + 1}`}
                      value={digito}
                      onChange={(e) => cambiarDigito(index, e.target.value)}
                      onKeyDown={(e) => manejarTeclaOtp(index, e)}
                      onPaste={pegarOtp}
                    />
                  ))}
                </div>
              </fieldset>

              <button type="submit" className="acceso__enviar" disabled={cargando}>
                {cargando ? "Validando…" : "Confirmar identidad"}
                {!cargando && <ArrowRight size={18} />}
              </button>

              <button
                type="button"
                className="acceso__volver"
                onClick={() => {
                  setPaso(1);
                  setOtpDigits(Array(OTP_LENGTH).fill(""));
                  setError(null);
                  setAviso(null);
                }}
              >
                Volver al inicio
              </button>
            </form>
          )}

          <p className="acceso__separador">
            <span>o</span>
          </p>

          <p className="acceso__ayuda">
            <Headset size={20} aria-hidden="true" />
            <span>
              <strong>¿Necesitas ayuda?</strong>
              Contacta al administrador del sistema.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
