import { lazy, Suspense, useId, useState, useSyncExternalStore } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
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
 * El flujo es el de siempre, en dos pasos: correo y contraseña, y después el
 * código que llega por correo. Esta pantalla solo cambia cómo se ve; lo que se
 * pregunta al servidor y lo que se guarda al entrar es exactamente lo anterior.
 *
 * No hay enlace de restablecimiento ni registro: la API no los ofrece, y un
 * enlace que no lleva a ninguna parte enseña a desconfiar de los demás.
 */
export function Acceso({ alEntrar }: { alEntrar: () => void }) {
  const escritorio = usarEscritorio();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<{ email?: string; password?: string; codigo?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [ayudaClave, setAyudaClave] = useState(false);
  const idAyuda = useId();

  async function enviarCredenciales(e: React.FormEvent) {
    e.preventDefault();
    // Revisión de forma antes de molestar al servidor; las credenciales las
    // sigue juzgando el backend.
    const faltan: typeof campos = {};
    if (!email.trim()) faltan.email = "Escribe tu correo electrónico.";
    else if (!EXPRESION_CORREO.test(email.trim())) faltan.email = "Revisa el formato del correo.";
    if (!password) faltan.password = "Escribe tu contraseña.";
    setCampos(faltan);
    if (faltan.email || faltan.password) {
      document.getElementById(faltan.email ? "cc-email" : "cc-clave")?.focus();
      return;
    }
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
    if (codigo.trim().length < 6) {
      setCampos({ codigo: "Escribe el código de seis dígitos." });
      document.getElementById("cc-codigo")?.focus();
      return;
    }
    setCampos({});
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<{ access: string; refresh: string }>(
        "/auth/verify-otp/",
        { otp_ticket: ticket, otp_token: codigo }
      );
      sesion.guardar(r.access, r.refresh);

      // Tener sesión no es lo mismo que poder administrar la plataforma: se
      // comprueba aquí para dar un mensaje claro en vez de un panel vacío lleno
      // de 403.
      try {
        await api.get("/platform/resumen/");
      } catch {
        sesion.cerrar();
        setError("Tu cuenta no administra Crafteech Root. Entra por el panel de tu negocio.");
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

  const limpiar = (campo: keyof typeof campos) => setCampos((c) => ({ ...c, [campo]: undefined }));

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
        <form className="cc-form" onSubmit={paso === 1 ? enviarCredenciales : enviarCodigo} noValidate>
          {/* En móvil el panel gráfico no existe: el encabezado compacto lo
              reemplaza con el isotipo y el nombre. */}
          <div className="cc-form__marca">
            <img src={isotipoPequeno} alt="" width={144} height={118} />
            <Nombre />
          </div>

          <h1>
            {paso === 1 ? (
              <>
                Bienvenido a CrafT<span className="cc-verde">ee</span>ch.
              </>
            ) : (
              "Verifica tu identidad."
            )}
          </h1>
          <p className="cc-form__lema" aria-live="polite">
            {paso === 1
              ? "Accede a la administración central de Crafteech."
              : `Enviamos un código de seis dígitos a ${email}.`}
          </p>

          {error && (
            <p className="cc-error" role="alert">
              {error}
            </p>
          )}

          {paso === 1 ? (
            <>
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

              <div className={`cc-campo ${campos.password ? "cc-campo--error" : ""}`}>
                <label htmlFor="cc-clave">Contraseña</label>
                <span className="cc-entrada">
                  <Lock size={17} aria-hidden="true" />
                  <input
                    id="cc-clave"
                    type={verClave ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      limpiar("password");
                    }}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                    aria-invalid={Boolean(campos.password)}
                    aria-describedby={campos.password ? "cc-clave-error" : undefined}
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
                {campos.password && (
                  <span className="cc-campo__error" id="cc-clave-error">
                    {campos.password}
                  </span>
                )}
              </div>

              <div className="cc-olvido">
                <button
                  type="button"
                  onClick={() => setAyudaClave((v) => !v)}
                  aria-expanded={ayudaClave}
                  aria-controls={idAyuda}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              {ayudaClave && (
                <p className="cc-nota" id={idAyuda}>
                  Todavía no hay restablecimiento automático. Pídele a otro administrador
                  que te asigne una contraseña nueva; el sistema te obligará a cambiarla al
                  entrar.
                </p>
              )}
            </>
          ) : (
            <div className={`cc-campo ${campos.codigo ? "cc-campo--error" : ""}`}>
              <label htmlFor="cc-codigo">Código de verificación</label>
              <span className="cc-entrada">
                <KeyRound size={17} aria-hidden="true" />
                <input
                  id="cc-codigo"
                  className="cc-entrada__codigo"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
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
          )}

          <button type="submit" className="cc-enviar" disabled={enviando}>
            <span>
              {enviando
                ? paso === 1
                  ? "Verificando…"
                  : "Validando…"
                : paso === 1
                  ? "Acceder al sistema"
                  : "Entrar"}
            </span>
            {enviando ? (
              <Loader2 size={18} className="girando" aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
          </button>

          {paso === 2 && (
            <button
              type="button"
              className="cc-volver"
              onClick={() => {
                setPaso(1);
                setCodigo("");
                setError(null);
                setCampos({});
              }}
            >
              Usar otro correo
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
