import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  guardarPasswordRestablecida,
  loginPaso1,
  solicitarRestablecimiento,
  verificarCodigoRestablecimiento,
  verificarOtp,
} from "../api/auth";
import { cargarMarca, type MarcaNegocio } from "../api/marca";
import { useAuth } from "../auth/AuthContext";
import { extraerMensajeError } from "../utils";
import { ForzarCambioPasswordPage } from "./ForzarCambioPasswordPage";
import type { Usuario } from "../types";
import "./LoginPage.css";

const OTP_LENGTH = 6;
/** Lo mismo que exige el backend (RESET_REENVIO_SEGUNDOS) entre dos envíos. */
const ESPERA_REENVIO = 60;

/** «¿Olvidó su contraseña?»: correo → código → contraseña nueva → listo. */
type PasoRecuperar = "correo" | "codigo" | "clave" | "listo";

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
  const [recuperar, setRecuperar] = useState<PasoRecuperar | null>(null);
  const [resetTicket, setResetTicket] = useState("");
  const [cambioTicket, setCambioTicket] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [claveConfirmar, setClaveConfirmar] = useState("");
  const [reenvioEn, setReenvioEn] = useState(0);
  const [usuarioPendiente, setUsuarioPendiente] = useState<Usuario | null>(null);
  const [marca, setMarca] = useState<MarcaNegocio | null>(null);
  const [camposError, setCamposError] = useState<{ email?: string; password?: string }>({});

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // La identidad del negocio la resuelve el backend por el host. Si falla, la
  // pantalla se pinta igual con su verde por defecto: no poder entrar porque
  // no cargó un logo sería absurdo.
  useEffect(() => {
    cargarMarca().then(setMarca).catch(() => undefined);
  }, []);

  // Cuenta regresiva para «Reenviar código».
  useEffect(() => {
    if (reenvioEn <= 0) return;
    const t = setTimeout(() => setReenvioEn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioEn]);

  // ---------- Restablecer la contraseña ----------

  function abrirRecuperar() {
    setRecuperar("correo");
    setError(null);
    setAviso(null);
  }

  function volverAlLogin(mensaje: string | null = null) {
    setRecuperar(null);
    setPaso(1);
    setError(null);
    setAviso(mensaje);
    setPassword("");
    setClaveNueva("");
    setClaveConfirmar("");
    setOtpDigits(Array(OTP_LENGTH).fill(""));
  }

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) {
      setError("Escriba el correo de su cuenta.");
      return;
    }
    setError(null);
    setCargando(true);
    try {
      const resp = await solicitarRestablecimiento(email.trim());
      setResetTicket(resp.reset_ticket);
      setAviso(resp.message);
      setRecuperar("codigo");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setReenvioEn(ESPERA_REENVIO);
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo enviar el código. Inténtelo de nuevo."));
    } finally {
      setCargando(false);
    }
  }

  async function comprobarCodigoReset(codigo: string) {
    setError(null);
    setCargando(true);
    try {
      const resp = await verificarCodigoRestablecimiento(resetTicket, codigo);
      setCambioTicket(resp.cambio_ticket);
      setRecuperar("clave");
    } catch (err) {
      setError(extraerMensajeError(err, "El código es incorrecto o ya venció."));
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setCargando(false);
    }
  }

  async function guardarClaveNueva(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (claveNueva.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (claveNueva !== claveConfirmar) {
      setError("La confirmación no coincide con la contraseña nueva.");
      return;
    }
    setCargando(true);
    try {
      await guardarPasswordRestablecida(cambioTicket, claveNueva);
      setRecuperar("listo");
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar la contraseña."));
    } finally {
      setCargando(false);
    }
  }

  /** Las casillas del código sirven a los dos flujos: login y restablecer. */
  function completarCodigo(codigo: string) {
    if (recuperar === "codigo") comprobarCodigoReset(codigo);
    else confirmarOtp(codigo);
  }

  async function enviarCredenciales(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Validación de forma antes de molestar al servidor; las reglas reales
    // (credenciales, bloqueos) siguen siendo del backend.
    const faltan: { email?: string; password?: string } = {};
    if (!email.trim()) faltan.email = "Escriba su correo electrónico.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) faltan.email = "Revise el formato del correo.";
    if (!password) faltan.password = "Escriba su contraseña.";
    setCamposError(faltan);
    if (faltan.email || faltan.password) {
      document.getElementById(faltan.email ? "acceso-email" : "acceso-clave")?.focus();
      return;
    }
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
    completarCodigo(codigo);
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
      completarCodigo(pegado);
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
    <div className="acceso">
      {/* ---------------------------------------------------- panel de marca */}
      <section className="acceso__marca">
        {/* Foto editorial propia (ya optimizada, ~85 KB). Es decorativa. */}
        <img
          className="acceso__foto"
          src="/img/login-cosecha.webp"
          alt=""
          aria-hidden="true"
          width={1024}
          height={881}
          fetchPriority="high"
        />
        <span className="acceso__velo" aria-hidden="true" />

        <div className="acceso__marca-cuerpo">
          {marca?.logo ? (
            <div className="acceso__logo-caja">
              <img src={marca.logo} alt={nombre || "Logo del negocio"} />
            </div>
          ) : (
            nombre && <p className="acceso__negocio">{nombre}</p>
          )}

          <p className="acceso__etiqueta">Plataforma de gestión comercial</p>
          <h1 className="acceso__titulo">Todo tu negocio, en orden.</h1>
          <p className="acceso__lema">
            Administra tus productos, pedidos y clientes desde un solo lugar.
          </p>
        </div>

        <p className="acceso__pie">
          © {new Date().getFullYear()} {nombre || "Panel administrativo"}
        </p>
      </section>

      {/* --------------------------------------------------------- formulario */}
      <section className="acceso__panel">
        <div className="acceso__tarjeta">
          <p className="acceso__kicker">Acceso administrativo</p>
          <h2>{recuperar ? "Restablecer contraseña" : paso === 1 ? "Bienvenido de nuevo." : "Verificación"}</h2>
          <p className="acceso__intro" aria-live="polite">
            {recuperar === "correo"
              ? "Escriba el correo de su cuenta y le enviaremos un código para crear una contraseña nueva."
              : recuperar === "codigo"
                ? `${aviso ?? ""} Escriba el código de 6 dígitos que llegó a ${email.trim()}.`
                : recuperar === "clave"
                  ? "Código verificado. Elija su contraseña nueva."
                  : recuperar === "listo"
                    ? "Su contraseña se cambió. Le enviamos un aviso a su correo."
                    : paso === 1
                      ? aviso || "Ingresa tus credenciales para continuar."
                      : aviso || "Hemos enviado un código de acceso a su correo."}
          </p>

          {error && (
            <p className="acceso__error" role="alert">
              {error}
            </p>
          )}

          {recuperar === "correo" ? (
            <form onSubmit={pedirCodigo} noValidate>
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
              <button type="submit" className="acceso__enviar" disabled={cargando}>
                {cargando ? "Enviando…" : "Enviarme el código"}
                {!cargando && <ArrowRight size={18} />}
              </button>
              <button type="button" className="acceso__volver" onClick={() => volverAlLogin()}>
                Volver a iniciar sesión
              </button>
            </form>
          ) : recuperar === "clave" ? (
            <form onSubmit={guardarClaveNueva} noValidate>
              <label className="acceso__campo">
                <span className="acceso__rotulo">Contraseña nueva</span>
                <span className="acceso__entrada">
                  <Lock size={17} aria-hidden="true" />
                  <input
                    type={verClave ? "text" : "password"}
                    value={claveNueva}
                    onChange={(e) => setClaveNueva(e.target.value)}
                    autoComplete="new-password"
                    aria-describedby="acceso-reglas-clave"
                    required
                    autoFocus
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
              <label className="acceso__campo">
                <span className="acceso__rotulo">Confirmar contraseña nueva</span>
                <span className="acceso__entrada">
                  <KeyRound size={17} aria-hidden="true" />
                  <input
                    type={verClave ? "text" : "password"}
                    value={claveConfirmar}
                    onChange={(e) => setClaveConfirmar(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </span>
              </label>
              <p className="acceso__nota" id="acceso-reglas-clave">
                Al menos 8 caracteres, que no sean solo números ni una clave común, y distinta de su nombre o correo.
              </p>
              <button type="submit" className="acceso__enviar" disabled={cargando}>
                {cargando ? "Guardando…" : "Guardar contraseña nueva"}
                {!cargando && <ArrowRight size={18} />}
              </button>
            </form>
          ) : recuperar === "listo" ? (
            <div className="acceso__listo">
              <CheckCircle2 size={44} aria-hidden="true" />
              <button
                type="button"
                className="acceso__enviar"
                onClick={() => volverAlLogin("Inicie sesión con su contraseña nueva.")}
                autoFocus
              >
                Iniciar sesión <ArrowRight size={18} />
              </button>
            </div>
          ) : paso === 1 && !recuperar ? (
            <form onSubmit={enviarCredenciales} noValidate>
              <label className={`acceso__campo ${camposError.email ? "acceso__campo--error" : ""}`}>
                <span className="acceso__rotulo">Correo electrónico</span>
                <span className="acceso__entrada">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    id="acceso-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (camposError.email) setCamposError((c) => ({ ...c, email: undefined }));
                    }}
                    placeholder="usuario@empresa.com"
                    autoComplete="username"
                    aria-invalid={Boolean(camposError.email)}
                    aria-describedby={camposError.email ? "acceso-email-error" : undefined}
                    required
                    autoFocus
                  />
                </span>
                {camposError.email && (
                  <span className="acceso__campo-error" id="acceso-email-error">
                    {camposError.email}
                  </span>
                )}
              </label>

              <label className={`acceso__campo ${camposError.password ? "acceso__campo--error" : ""}`}>
                <span className="acceso__rotulo">Contraseña</span>
                <span className="acceso__entrada">
                  <Lock size={17} aria-hidden="true" />
                  <input
                    id="acceso-clave"
                    type={verClave ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (camposError.password) setCamposError((c) => ({ ...c, password: undefined }));
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={Boolean(camposError.password)}
                    aria-describedby={camposError.password ? "acceso-clave-error" : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="acceso__ojo"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label={verClave ? "Ocultar la contraseña" : "Mostrar la contraseña"}
                  >
                    {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {camposError.password && (
                  <span className="acceso__campo-error" id="acceso-clave-error">
                    {camposError.password}
                  </span>
                )}
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

                <button type="button" className="acceso__olvido" onClick={abrirRecuperar}>
                  ¿Olvidó su contraseña?
                </button>
              </div>

              <button type="submit" className="acceso__enviar" disabled={cargando}>
                {cargando ? "Verificando…" : "Ingresar al sistema"}
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
                {cargando ? "Validando…" : recuperar === "codigo" ? "Verificar código" : "Confirmar identidad"}
                {!cargando && <ArrowRight size={18} />}
              </button>

              {recuperar === "codigo" && (
                <button
                  type="button"
                  className="acceso__olvido acceso__reenviar"
                  onClick={() => pedirCodigo()}
                  disabled={cargando || reenvioEn > 0}
                >
                  {reenvioEn > 0 ? `Reenviar código en ${reenvioEn} s` : "Reenviar código"}
                </button>
              )}

              <button
                type="button"
                className="acceso__volver"
                onClick={() => {
                  if (recuperar) {
                    volverAlLogin();
                    return;
                  }
                  setPaso(1);
                  setOtpDigits(Array(OTP_LENGTH).fill(""));
                  setError(null);
                  setAviso(null);
                }}
              >
                {recuperar ? "Volver a iniciar sesión" : "Volver al inicio"}
              </button>
            </form>
          )}

          <p className="acceso__aviso">
            <ShieldCheck size={16} aria-hidden="true" />
            Acceso exclusivo para personal autorizado.
          </p>

        </div>
      </section>
    </div>
  );
}
