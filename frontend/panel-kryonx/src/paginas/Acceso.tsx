import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { api, sesion } from "../api/cliente";
import isotipoPequeno from "../assets/crafteech-isotipo-pequeno.webp";
import "./acceso/acceso.css";

/* El núcleo 3D (y Motion con él) se baja aparte y solo donde hay sitio para
   verlo: en móvil el acceso no descarga ni una línea de él. */
const NucleoDigital = lazy(() => import("./acceso/NucleoDigital"));

const CONSULTA_ESCRITORIO = "(min-width: 900px)";

function usarEscritorio(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const mq = window.matchMedia(CONSULTA_ESCRITORIO);
      mq.addEventListener("change", aviso);
      return () => mq.removeEventListener("change", aviso);
    },
    () => window.matchMedia(CONSULTA_ESCRITORIO).matches,
    () => false
  );
}

const EXPRESION_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Lo mismo que exige el backend (RESET_REENVIO_SEGUNDOS) entre dos envíos. */
const ESPERA_REENVIO = 60;

/**
 * En qué pantalla está el formulario.
 *
 * - `credenciales` y `otp`: el login de siempre, en dos pasos.
 * - `r-correo` → `r-codigo` → `r-clave` → `r-listo`: «¿Olvidaste tu
 *   contraseña?», el mismo flujo del panel de negocio contra los mismos
 *   endpoints (`/auth/password-reset/…`).
 */
type Pantalla = "credenciales" | "otp" | "r-correo" | "r-codigo" | "r-clave" | "r-listo";

type Campos = {
  email?: string;
  password?: string;
  codigo?: string;
  claveNueva?: string;
  claveConfirmar?: string;
};

const TITULOS: Record<Exclude<Pantalla, "credenciales">, string> = {
  otp: "Verifica tu identidad.",
  "r-correo": "Recupera tu acceso.",
  "r-codigo": "Revisa tu correo.",
  "r-clave": "Crea una contraseña nueva.",
  "r-listo": "Contraseña actualizada.",
};

/** El nombre en texto —nítido a cualquier tamaño y legible por lectores de
    pantalla— con las dos «ee» en verde eléctrico. */
function Nombre() {
  return (
    <span className="cc-nombre" aria-label="CrafTeech">
      <span aria-hidden="true">
        CrafT<b>ee</b>ch
      </span>
    </span>
  );
}

/**
 * Entrar a Crafteech Root, el centro de mando de la plataforma.
 *
 * El login es el de siempre, en dos pasos: correo y contraseña, y después el
 * código que llega por correo. Desde aquí también se restablece la contraseña
 * con un código enviado al correo; las reglas (vigencia, intentos, reenvío,
 * no delatar qué correos existen) las pone el backend.
 *
 * No hay registro: las cuentas de la plataforma las crea otro administrador.
 */
export function Acceso({ alEntrar }: { alEntrar: () => void }) {
  const escritorio = usarEscritorio();
  const [pantalla, setPantalla] = useState<Pantalla>("credenciales");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ticket, setTicket] = useState("");
  const [resetTicket, setResetTicket] = useState("");
  const [cambioTicket, setCambioTicket] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [claveConfirmar, setClaveConfirmar] = useState("");
  const [reenvioEn, setReenvioEn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos>({});
  const [enviando, setEnviando] = useState(false);

  // Cuenta regresiva para «Reenviar código».
  useEffect(() => {
    if (reenvioEn <= 0) return;
    const t = setTimeout(() => setReenvioEn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioEn]);

  function irA(destino: Pantalla) {
    setPantalla(destino);
    setError(null);
    setCampos({});
  }

  function enfocar(id: string) {
    // Tras cambiar de pantalla el campo aún no existe: se espera al pintado.
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  /** Revisa el correo; devuelve false (y lo marca) si no sirve. */
  function correoValido(): boolean {
    const motivo = !email.trim()
      ? "Escribe tu correo electrónico."
      : !EXPRESION_CORREO.test(email.trim())
        ? "Revisa el formato del correo."
        : undefined;
    if (motivo) {
      setCampos({ email: motivo });
      enfocar("cc-email");
      return false;
    }
    return true;
  }

  function codigoValido(): boolean {
    if (!/^\d{6}$/.test(codigo.trim())) {
      setCampos({ codigo: "Escribe el código de seis dígitos." });
      enfocar("cc-codigo");
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- login

  async function enviarCredenciales() {
    // Revisión de forma antes de molestar al servidor; las credenciales las
    // sigue juzgando el backend.
    const faltaClave = !password;
    if (!correoValido()) return;
    if (faltaClave) {
      setCampos({ password: "Escribe tu contraseña." });
      enfocar("cc-clave");
      return;
    }
    const r = await api.post<{ otp_ticket: string }>("/auth/login/", {
      email_usuario: email.trim(),
      password,
    });
    setTicket(r.otp_ticket);
    setCodigo("");
    setAviso(null);
    irA("otp");
  }

  async function enviarCodigo() {
    if (!codigoValido()) return;
    const r = await api.post<{ access: string; refresh: string }>("/auth/verify-otp/", {
      otp_ticket: ticket,
      otp_token: codigo.trim(),
    });
    sesion.guardar(r.access, r.refresh);

    // Tener sesión no es lo mismo que poder administrar la plataforma: se
    // comprueba aquí para dar un mensaje claro en vez de un panel vacío lleno
    // de 403.
    try {
      await api.get("/platform/resumen/");
    } catch {
      sesion.cerrar();
      irA("credenciales");
      setError("Tu cuenta no administra Crafteech Root. Entra por el panel de tu negocio.");
      return;
    }
    alEntrar();
  }

  // ------------------------------------------------- restablecer contraseña

  function abrirRecuperar() {
    setAviso(null);
    setPassword("");
    irA("r-correo");
    enfocar("cc-email");
  }

  function volverAlLogin(mensaje: string | null = null) {
    setCodigo("");
    setPassword("");
    setClaveNueva("");
    setClaveConfirmar("");
    setResetTicket("");
    setCambioTicket("");
    setAviso(mensaje);
    irA("credenciales");
    enfocar(mensaje ? "cc-clave" : "cc-email");
  }

  async function pedirCodigoReset() {
    if (!correoValido()) return;
    const r = await api.post<{ message: string; reset_ticket: string }>("/auth/password-reset/", {
      email_usuario: email.trim(),
    });
    setResetTicket(r.reset_ticket);
    // El backend responde lo mismo exista o no el correo: no delata cuentas.
    setAviso(r.message);
    setCodigo("");
    setReenvioEn(ESPERA_REENVIO);
    irA("r-codigo");
    enfocar("cc-codigo");
  }

  async function verificarCodigoReset() {
    if (!codigoValido()) return;
    try {
      const r = await api.post<{ cambio_ticket: string }>("/auth/password-reset/verificar/", {
        reset_ticket: resetTicket,
        codigo: codigo.trim(),
      });
      setCambioTicket(r.cambio_ticket);
      setAviso(null);
      irA("r-clave");
      enfocar("cc-clave-nueva");
    } catch (err) {
      setCodigo("");
      enfocar("cc-codigo");
      throw err;
    }
  }

  async function guardarClaveNueva() {
    const faltan: Campos = {};
    if (claveNueva.length < 8) faltan.claveNueva = "Usa al menos 8 caracteres.";
    if (claveConfirmar !== claveNueva) faltan.claveConfirmar = "No coincide con la contraseña nueva.";
    if (faltan.claveNueva || faltan.claveConfirmar) {
      setCampos(faltan);
      enfocar(faltan.claveNueva ? "cc-clave-nueva" : "cc-clave-confirmar");
      return;
    }
    // Las reglas completas (contraseñas comunes, parecidas al correo…) las
    // aplica el backend; su mensaje llega como error general.
    await api.post("/auth/password-reset/nueva/", {
      cambio_ticket: cambioTicket,
      password_nueva: claveNueva,
    });
    setClaveNueva("");
    setClaveConfirmar("");
    irA("r-listo");
  }

  async function reenviarCodigoReset() {
    if (reenvioEn > 0 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await pedirCodigoReset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  // ----------------------------------------------------------- formulario

  const ACCIONES: Record<Pantalla, () => Promise<void> | void> = {
    credenciales: enviarCredenciales,
    otp: enviarCodigo,
    "r-correo": pedirCodigoReset,
    "r-codigo": verificarCodigoReset,
    "r-clave": guardarClaveNueva,
    "r-listo": () => volverAlLogin("Ya puedes entrar con tu contraseña nueva."),
  };

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setCampos({});
    setError(null);
    setEnviando(true);
    try {
      await ACCIONES[pantalla]();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const limpiar = (campo: keyof Campos) => setCampos((c) => ({ ...c, [campo]: undefined }));

  const recuperando = pantalla.startsWith("r-");

  const lema: Record<Pantalla, string> = {
    credenciales: "Accede a la administración central de Crafteech.",
    otp: `Enviamos un código de seis dígitos a ${email.trim()}.`,
    "r-correo": "Escribe el correo de tu cuenta y te enviaremos un código para crear una contraseña nueva.",
    "r-codigo": `Si ${email.trim()} tiene una cuenta, te llegará un código de seis dígitos. Vence en pocos minutos.`,
    "r-clave": "Elige una contraseña que no uses en otros sitios. Al guardarla te avisaremos por correo.",
    "r-listo": "Tu contraseña se cambió. Entra con ella; te pediremos el código de verificación como siempre.",
  };

  const textoBoton: Record<Pantalla, [string, string]> = {
    credenciales: ["Acceder al sistema", "Verificando…"],
    otp: ["Entrar", "Validando…"],
    "r-correo": ["Enviar código", "Enviando…"],
    "r-codigo": ["Verificar código", "Verificando…"],
    "r-clave": ["Guardar contraseña", "Guardando…"],
    "r-listo": ["Volver al inicio de sesión", "…"],
  };

  const campoCorreo = (
    <div className={`cc-campo ${campos.email ? "cc-campo--error" : ""}`}>
      <label htmlFor="cc-email">Correo electrónico</label>
      <span className="cc-entrada">
        <Mail size={17} aria-hidden="true" />
        <input
          id="cc-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            limpiar("email");
          }}
          placeholder="tu@correo.com"
          autoComplete="username"
          aria-invalid={Boolean(campos.email)}
          aria-describedby={campos.email ? "cc-email-error" : undefined}
          autoFocus
        />
      </span>
      {campos.email && (
        <span className="cc-campo__error" id="cc-email-error">
          {campos.email}
        </span>
      )}
    </div>
  );

  const campoCodigo = (
    <div className={`cc-campo ${campos.codigo ? "cc-campo--error" : ""}`}>
      <label htmlFor="cc-codigo">{recuperando ? "Código de restablecimiento" : "Código de verificación"}</label>
      <span className="cc-entrada">
        <KeyRound size={17} aria-hidden="true" />
        <input
          id="cc-codigo"
          className="cc-entrada__codigo"
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.replace(/\D/g, ""));
            limpiar("codigo");
          }}
          placeholder="······"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          aria-invalid={Boolean(campos.codigo)}
          aria-describedby={campos.codigo ? "cc-codigo-error" : undefined}
          autoFocus
        />
      </span>
      {campos.codigo && (
        <span className="cc-campo__error" id="cc-codigo-error">
          {campos.codigo}
        </span>
      )}
    </div>
  );

  /** Campo de contraseña con su botón de mostrar/ocultar. */
  function campoClave(opciones: {
    id: string;
    etiqueta: string;
    valor: string;
    cambiar: (v: string) => void;
    campo: keyof Campos;
    autoComplete: string;
    placeholder: string;
    autoFocus?: boolean;
  }) {
    const mensaje = campos[opciones.campo];
    return (
      <div className={`cc-campo ${mensaje ? "cc-campo--error" : ""}`}>
        <label htmlFor={opciones.id}>{opciones.etiqueta}</label>
        <span className="cc-entrada">
          <Lock size={17} aria-hidden="true" />
          <input
            id={opciones.id}
            type={verClave ? "text" : "password"}
            value={opciones.valor}
            onChange={(e) => {
              opciones.cambiar(e.target.value);
              limpiar(opciones.campo);
            }}
            placeholder={opciones.placeholder}
            autoComplete={opciones.autoComplete}
            aria-invalid={Boolean(mensaje)}
            aria-describedby={mensaje ? `${opciones.id}-error` : undefined}
            autoFocus={opciones.autoFocus}
          />
          <button
            type="button"
            className="cc-entrada__ojo"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            aria-pressed={verClave}
          >
            {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
        {mensaje && (
          <span className="cc-campo__error" id={`${opciones.id}-error`}>
            {mensaje}
          </span>
        )}
      </div>
    );
  }

  return (
    <main className="cc">
      {/* ------------------------------------------------ panel: Digital Core */}
      <section className="cc-nucleo" aria-label="Centro de mando de Crafteech">
        <span className="cc-nucleo__rejilla" aria-hidden="true" />
        <span className="cc-nucleo__luz" aria-hidden="true" />

        <header className="cc-nucleo__cabecera">
          <img src={isotipoPequeno} alt="" width={144} height={118} className="cc-nucleo__isotipo" />
          <Nombre />
        </header>

        {escritorio && (
          <div className="cc-nucleo__escena">
            <Suspense fallback={null}>
              <NucleoDigital />
            </Suspense>
          </div>
        )}

        <div className="cc-nucleo__texto">
          <h2>
            El núcleo de tu <em>ecosistema digital.</em>
          </h2>
          <p>Un solo centro. Todas tus soluciones digitales conectadas.</p>
        </div>

        <footer className="cc-nucleo__pie">
          <span>CENTRO DE CONTROL MAESTRO</span>
          <span>DISEÑA · CONSTRUYE · CONECTA · ESCALA</span>
        </footer>
      </section>

      {/* ---------------------------------------------- panel: Access Control */}
      <section className="cc-acceso">
        <form className="cc-form" onSubmit={alEnviar} noValidate>
          {/* En móvil el panel gráfico no existe: el encabezado compacto lo
              reemplaza con el isotipo y el nombre. */}
          <div className="cc-form__marca">
            <img src={isotipoPequeno} alt="" width={144} height={118} />
            <Nombre />
          </div>

          {pantalla === "r-listo" && (
            <CheckCircle2 className="cc-listo" size={44} aria-hidden="true" />
          )}

          <h1>
            {pantalla === "credenciales" ? (
              <>
                Bienvenido a CrafT<span className="cc-verde">ee</span>ch.
              </>
            ) : (
              TITULOS[pantalla]
            )}
          </h1>
          <p className="cc-form__lema" aria-live="polite">
            {lema[pantalla]}
          </p>

          {error && (
            <p className="cc-error" role="alert">
              {error}
            </p>
          )}
          {aviso && !error && (
            <p className="cc-aviso" role="status">
              {aviso}
            </p>
          )}

          {pantalla === "credenciales" && (
            <>
              {campoCorreo}
              {campoClave({
                id: "cc-clave",
                etiqueta: "Contraseña",
                valor: password,
                cambiar: setPassword,
                campo: "password",
                autoComplete: "current-password",
                placeholder: "Tu contraseña",
              })}
              <div className="cc-olvido">
                <button type="button" onClick={abrirRecuperar}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </>
          )}

          {pantalla === "otp" && campoCodigo}

          {pantalla === "r-correo" && campoCorreo}

          {pantalla === "r-codigo" && (
            <>
              {campoCodigo}
              <div className="cc-olvido">
                <button type="button" onClick={reenviarCodigoReset} disabled={reenvioEn > 0 || enviando}>
                  {reenvioEn > 0 ? `Reenviar código en ${reenvioEn} s` : "Reenviar código"}
                </button>
              </div>
            </>
          )}

          {pantalla === "r-clave" && (
            <>
              {campoClave({
                id: "cc-clave-nueva",
                etiqueta: "Contraseña nueva",
                valor: claveNueva,
                cambiar: setClaveNueva,
                campo: "claveNueva",
                autoComplete: "new-password",
                placeholder: "Mínimo 8 caracteres",
                autoFocus: true,
              })}
              {campoClave({
                id: "cc-clave-confirmar",
                etiqueta: "Confirma la contraseña",
                valor: claveConfirmar,
                cambiar: setClaveConfirmar,
                campo: "claveConfirmar",
                autoComplete: "new-password",
                placeholder: "Escríbela de nuevo",
              })}
            </>
          )}

          <button type="submit" className="cc-enviar" disabled={enviando}>
            <span>{textoBoton[pantalla][enviando ? 1 : 0]}</span>
            {enviando ? (
              <Loader2 size={18} className="girando" aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
          </button>

          {pantalla === "otp" && (
            <button type="button" className="cc-volver" onClick={() => volverAlLogin()}>
              Usar otro correo
            </button>
          )}
          {(pantalla === "r-correo" || pantalla === "r-codigo" || pantalla === "r-clave") && (
            <button type="button" className="cc-volver" onClick={() => volverAlLogin()}>
              Volver al inicio de sesión
            </button>
          )}

          <p className="cc-sello">
            <ShieldCheck size={15} aria-hidden="true" />
            Acceso restringido · Crafteech Root
          </p>
        </form>
      </section>
    </main>
  );
}
