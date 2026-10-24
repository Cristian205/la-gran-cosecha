import {
  AlertCircle,
  ArrowRightLeft,
  Building2,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  KeyRound,
  Mail,
  PanelsTopLeft,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { actualizarNombre } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "../components/Modal";
import { extraerMensajeError, formatoFecha } from "../utils";
import { alertaExito } from "../utils/alertas";

/** El rol de la pertenencia es el que decide el acceso; `rol_usuario` solo es
 *  la etiqueta heredada del panel de un solo negocio. */
const ETIQUETAS_ROL: Record<string, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  STAFF: "Personal",
};

const NOMBRE_MAXIMO = 150;

function iniciales(nombre?: string): string {
  if (!nombre) return "?";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** La fecha completa, sin que «p. m.» se parta en dos renglones en una tarjeta angosta. */
function fecha(iso: string | null | undefined): string {
  const NBSP = String.fromCharCode(160); // espacio que no se parte
  return formatoFecha(iso ?? null).replace(/\s([ap]\.)\s(m\.)/g, `${NBSP}$1${NBSP}$2`);
}

function etiquetaRol(rol: string | null | undefined, respaldo?: string): string {
  return ETIQUETAS_ROL[rol ?? ""] ?? respaldo ?? "—";
}

/** Lo mismo que valida el backend (PreferenciasSerializer): así el error se ve
 *  al escribir y no solo al guardar. */
function validarNombre(nombre: string): string | null {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (limpio.length < 2) return "Escribe tu nombre completo.";
  if (limpio.length > NOMBRE_MAXIMO) return `Máximo ${NOMBRE_MAXIMO} caracteres.`;
  return null;
}

function Dato({ icono, etiqueta, children, nota }: { icono: ReactNode; etiqueta: string; children: ReactNode; nota?: ReactNode }) {
  return (
    <div className="perfil-tarjeta">
      <span className="perfil-tarjeta-icono" aria-hidden="true">
        {icono}
      </span>
      <div className="perfil-tarjeta-texto">
        <dt>{etiqueta}</dt>
        <dd>{children}</dd>
        {nota && <dd className="perfil-tarjeta-nota">{nota}</dd>}
      </div>
    </div>
  );
}

function EditarPerfil({ onCerrar }: { onCerrar: () => void }) {
  const { usuario, setUsuario } = useAuth();
  const original = usuario?.nombre_usuario ?? "";
  const [nombre, setNombre] = useState(original);
  const [tocado, setTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorNombre = validarNombre(nombre);
  const sinCambios = nombre.trim().replace(/\s+/g, " ") === original;

  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    setTocado(true);
    if (errorNombre || sinCambios || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await actualizarNombre(nombre);
      setUsuario(actualizado);
      onCerrar();
      alertaExito("Tu nombre quedó actualizado.");
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar. Inténtalo de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      amplio
      medio
      cerrarConEscape={!guardando}
      titulo="Editar perfil"
      subtitulo="Así te ven tus compañeros en el panel."
      onCerrar={() => !guardando && onCerrar()}
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-editar-perfil"
            className="btn primario"
            disabled={guardando || sinCambios || Boolean(errorNombre)}
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      }
    >
      <form id="form-editar-perfil" onSubmit={guardar} noValidate>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <div className="campo">
          <label htmlFor="perfil-nombre">Nombre completo *</label>
          <input
            id="perfil-nombre"
            value={nombre}
            maxLength={NOMBRE_MAXIMO}
            autoComplete="name"
            autoFocus
            aria-invalid={tocado && Boolean(errorNombre)}
            aria-describedby={tocado && errorNombre ? "perfil-nombre-error" : undefined}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => setTocado(true)}
          />
          {tocado && errorNombre && (
            <p className="campo-error" id="perfil-nombre-error">
              <AlertCircle size={14} aria-hidden="true" /> {errorNombre}
            </p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="perfil-correo">Correo electrónico</label>
          <input id="perfil-correo" value={usuario?.email_usuario ?? ""} readOnly disabled aria-describedby="perfil-correo-ayuda" />
          <p className="campo-ayuda" id="perfil-correo-ayuda">
            Es tu usuario de acceso y adonde llega el código de verificación, por eso no se cambia desde aquí.
          </p>
        </div>
      </form>
    </Modal>
  );
}

export function ProfilePage() {
  const { usuario, negocios, negocioActivo, cambiarNegocio, cambiandoNegocio } = useAuth();
  const [editando, setEditando] = useState(false);

  const rol = etiquetaRol(usuario?.rol_en_negocio, usuario?.rol_usuario);
  const otros = negocios.filter((n) => n.slug !== negocioActivo?.slug);

  return (
    <>
      <div className="topbar">
        <h1>Perfil</h1>
      </div>

      <div className="contenido perfil">
        <section className="panel perfil-hero" aria-labelledby="perfil-nombre-titulo">
          <span className="perfil-avatar" aria-hidden="true">
            {iniciales(usuario?.nombre_usuario)}
          </span>
          <div className="perfil-identidad">
            <h2 id="perfil-nombre-titulo">{usuario?.nombre_usuario}</h2>
            <p className="perfil-correo">{usuario?.email_usuario}</p>
            <ul className="perfil-chips" aria-label="Resumen de la cuenta">
              <li className="perfil-chip rol">
                <ShieldCheck size={14} aria-hidden="true" /> {rol}
              </li>
              <li className={`perfil-chip ${usuario?.is_active ? "activa" : "inactiva"}`}>
                <span className="perfil-punto" aria-hidden="true" />
                {usuario?.is_active ? "Cuenta activa" : "Cuenta inactiva"}
              </li>
              {negocioActivo && (
                <li className="perfil-chip">
                  <Building2 size={14} aria-hidden="true" /> {negocioActivo.nombre}
                </li>
              )}
            </ul>
          </div>
          <div className="perfil-acciones">
            <button type="button" className="btn primario" onClick={() => setEditando(true)}>
              <Pencil size={15} aria-hidden="true" /> Editar perfil
            </button>
            <Link className="btn secundario" to="/configuracion#cambiar-contrasena">
              <KeyRound size={15} aria-hidden="true" /> Seguridad
            </Link>
          </div>
        </section>

        <section aria-labelledby="perfil-datos-titulo">
          <h2 className="perfil-seccion-titulo" id="perfil-datos-titulo">
            Datos de la cuenta
          </h2>
          <dl className="perfil-grid">
            <Dato icono={<Mail size={18} />} etiqueta="Correo electrónico" nota="Tu usuario de acceso">
              <span className="perfil-correo-valor" title={usuario?.email_usuario}>
                {usuario?.email_usuario}
              </span>
            </Dato>
            <Dato
              icono={<Building2 size={18} />}
              etiqueta="Negocio"
              nota={
                otros.length > 0
                  ? `También trabajas en ${otros.length} ${otros.length === 1 ? "negocio más" : "negocios más"}`
                  : undefined
              }
            >
              {negocioActivo?.nombre ?? "—"}
            </Dato>
            <Dato icono={<ShieldCheck size={18} />} etiqueta="Rol en este negocio" nota="Lo asigna el dueño del negocio">
              {rol}
            </Dato>
            <Dato icono={<Clock size={18} />} etiqueta="Último acceso">
              {fecha(usuario?.ultimo_login_exitoso)}
            </Dato>
            <Dato icono={<CalendarPlus size={18} />} etiqueta="Cuenta creada">
              {fecha(usuario?.fecha_creacion)}
            </Dato>
          </dl>
        </section>

        <div className="perfil-columnas">
          <section className="panel perfil-bloque" aria-labelledby="perfil-ajustes-titulo">
            <div className="cabecera">
              <h2 id="perfil-ajustes-titulo">Configuración de la cuenta</h2>
            </div>
            <ul className="perfil-ajustes">
              <li>
                <button type="button" className="perfil-ajuste" onClick={() => setEditando(true)}>
                  <span className="perfil-ajuste-icono" aria-hidden="true">
                    <UserRound size={18} />
                  </span>
                  <span className="perfil-ajuste-texto">
                    <strong>Información personal</strong>
                    <span>Tu nombre como lo ve el equipo</span>
                  </span>
                  <ChevronRight size={18} className="perfil-ajuste-flecha" aria-hidden="true" />
                </button>
              </li>
              <li>
                <Link className="perfil-ajuste" to="/configuracion#cambiar-contrasena">
                  <span className="perfil-ajuste-icono" aria-hidden="true">
                    <KeyRound size={18} />
                  </span>
                  <span className="perfil-ajuste-texto">
                    <strong>Seguridad</strong>
                    <span>Cambia tu contraseña</span>
                  </span>
                  <ChevronRight size={18} className="perfil-ajuste-flecha" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link className="perfil-ajuste" to="/configuracion">
                  <span className="perfil-ajuste-icono" aria-hidden="true">
                    <PanelsTopLeft size={18} />
                  </span>
                  <span className="perfil-ajuste-texto">
                    <strong>Preferencias del panel</strong>
                    <span>Menú lateral y notificaciones</span>
                  </span>
                  <ChevronRight size={18} className="perfil-ajuste-flecha" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </section>

          {negocios.length > 1 && (
            <section className="panel perfil-bloque" aria-labelledby="perfil-negocios-titulo">
              <div className="cabecera">
                <h2 id="perfil-negocios-titulo">Tus negocios</h2>
              </div>
              <ul className="perfil-negocios">
                {negocios.map((n) => {
                  const activo = n.slug === negocioActivo?.slug;
                  return (
                    <li key={n.uuid} className={activo ? "activo" : undefined}>
                      <span className="perfil-ajuste-icono" aria-hidden="true">
                        <Building2 size={18} />
                      </span>
                      <span className="perfil-ajuste-texto">
                        <strong>{n.nombre}</strong>
                        <span>{etiquetaRol(n.rol, n.rol)}</span>
                      </span>
                      {activo ? (
                        <span className="perfil-chip activa">
                          <Check size={13} aria-hidden="true" /> Actual
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn secundario sm"
                          disabled={cambiandoNegocio}
                          onClick={() => cambiarNegocio(n.slug)}
                          aria-label={`Entrar a ${n.nombre}`}
                        >
                          <ArrowRightLeft size={14} aria-hidden="true" /> Entrar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {editando && <EditarPerfil onCerrar={() => setEditando(false)} />}
    </>
  );
}
