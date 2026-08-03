import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginPaso1, verificarOtp } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { extraerMensajeError } from "../utils";
import logo from "../assets/logo_la_gran_cosecha.webp";
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
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [ticket, setTicket] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usuarioPendiente, setUsuarioPendiente] = useState<Usuario | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      const resp = await verificarOtp(ticket, codigo);
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
    if (limpio && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function manejarTeclaOtp(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function pegarOtp(e: React.ClipboardEvent<HTMLInputElement>) {
    const pegado = e.clipboardData.getData("text").trim();
    if (pegado.length === OTP_LENGTH && /^\d+$/.test(pegado)) {
      e.preventDefault();
      const digitos = pegado.split("");
      setOtpDigits(digitos);
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

  return (
    <div className="login-page">
      <div className="split-screen">
        <section className="left-panel">
          <span className="blob b1" />
          <span className="blob b2" />
          <div className="content-wrapper">
            <div className="brand-identity">
              <div className="logo-box">
                <img src={logo} alt="Logo La Gran Cosecha" className="logo" />
              </div>
              <div className="divider"></div>
              <span className="system-name">
                Control de calidad <span>administrativo</span>
              </span>
            </div>

            <div className="legal-notice">
              <p>© 2026 La gran cosecha Corp. Sistema de acceso restringido para personal autorizado.</p>
            </div>
          </div>
        </section>

        <section className="right-panel">
          <div className="login-container">
            {error && <div className="error-box">{error}</div>}
            {aviso && paso === 2 && <div className="ok-box">{aviso}</div>}

            {paso === 1 ? (
              <div id="login-fields">
                <header className="form-header">
                  <h1>Identificación</h1>
                  <p>Inicie sesión para acceder al panel de control.</p>
                </header>

                <form onSubmit={enviarCredenciales} noValidate>
                  <div className="input-container">
                    <label htmlFor="user">Correo Electrónico</label>
                    <input
                      type="email"
                      id="user"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@cosecha.com"
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="input-container">
                    <label htmlFor="pass">Clave de Seguridad</label>
                    <input
                      type="password"
                      id="pass"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  <button type="submit" className="btn-submit" disabled={cargando}>
                    <span className="text">{cargando ? "Verificando…" : "Entrar al Sistema"}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div id="verification-step" className="fade-in">
                <header className="form-header">
                  <h1>Verificación</h1>
                  <p>Hemos enviado un código de acceso a su correo vinculado.</p>
                </header>

                <form onSubmit={enviarOtp}>
                  <div className="input-container otp-wrapper">
                    <label>Código de Seguridad (6 dígitos)</label>
                    <div className="otp-inputs">
                      {otpDigits.map((digito, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpRefs.current[index] = el;
                          }}
                          type="text"
                          maxLength={1}
                          className="otp-field"
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
                  </div>

                  <button type="submit" id="btn-verify" className="btn-submit" disabled={cargando}>
                    {cargando ? "Validando…" : "Confirmar Identidad"}
                  </button>

                  <p className="resend-text">
                    ¿No recibiste el código?{" "}
                    <a
                      onClick={() => {
                        setPaso(1);
                        setOtpDigits(Array(OTP_LENGTH).fill(""));
                        setError(null);
                        setAviso(null);
                      }}
                    >
                      Reintentar desde el inicio
                    </a>
                  </p>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
