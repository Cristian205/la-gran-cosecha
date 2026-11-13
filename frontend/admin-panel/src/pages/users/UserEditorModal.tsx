import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { Modal } from "../../components/Modal";
import { PasosModal, type PasoModal } from "../../components/PasosModal";
import {
  actualizarPermisosUsuario,
  actualizarUsuario,
  crearUsuario,
  obtenerPermisosDisponibles,
  obtenerPermisosUsuario,
} from "../../api/resources";
import type { ModuloPermisos, Usuario } from "../../types";
import { extraerMensajeError } from "../../utils";
import { ConsolaPermisos } from "./ConsolaPermisos";

const ROLES: { valor: string; nombre: string; ayuda: string }[] = [
  { valor: "ANALISTA", nombre: "Analista", ayuda: "Trabajo del día a día, con los permisos que le des." },
  { valor: "ADMIN", nombre: "Administrador", ayuda: "Gestión del negocio, con los permisos que le des." },
  { valor: "GERENTE", nombre: "Gerente", ayuda: "Dueño de la cuenta: acceso total, sin permisos que repartir." },
];
/** Un Gerente es dueño de la cuenta: tiene acceso total y no se le reparten permisos. */
const ROL_DUENO = "GERENTE";
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Los mismos tipos y reglas que valida el backend (`accounts/datos_personales.py`). */
const TIPOS_DOCUMENTO: { valor: string; nombre: string }[] = [
  { valor: "CC", nombre: "Cédula de ciudadanía" },
  { valor: "CE", nombre: "Cédula de extranjería" },
  { valor: "TI", nombre: "Tarjeta de identidad" },
  { valor: "PA", nombre: "Pasaporte" },
  { valor: "PPT", nombre: "Permiso por protección temporal (PPT)" },
];
const REGLAS_DOCUMENTO: Record<string, { patron: RegExp; mensaje: string; numerico: boolean }> = {
  CC: { patron: /^\d{6,10}$/, mensaje: "La cédula lleva entre 6 y 10 dígitos.", numerico: true },
  TI: { patron: /^\d{10,11}$/, mensaje: "La tarjeta de identidad lleva 10 u 11 dígitos.", numerico: true },
  CE: { patron: /^[A-Z0-9]{3,15}$/, mensaje: "Letras y números, de 3 a 15.", numerico: false },
  PA: { patron: /^[A-Z0-9]{3,15}$/, mensaje: "Letras y números, de 3 a 15.", numerico: false },
  PPT: { patron: /^[A-Z0-9]{3,15}$/, mensaje: "Letras y números, de 3 a 15.", numerico: false },
};
const limpiarDocumento = (n: string) => n.replace(/[\s.\-]/g, "").toUpperCase();
const digitosTelefono = (t: string) => t.replace(/\D/g, "");
const nombreDocumento = (t: string) => TIPOS_DOCUMENTO.find((x) => x.valor === t)?.nombre ?? t;

export type PestanaUsuario = "info" | "permisos";
type Paso = "info" | "permisos" | "confirmar";

interface Props {
  /** null: alta de un usuario nuevo. */
  usuario: Usuario | null;
  puedeEditarRol: boolean;
  /** Solo el dueño reparte permisos (ver `puedeGestionarPermisos` en UsersPage). */
  puedeGestionarPermisos: boolean;
  pestanaInicial?: PestanaUsuario;
  onCerrar: () => void;
  onGuardado: () => void;
}

function mismosPermisos(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((c) => b.has(c));
}

const nombreRol = (r: string) => ROLES.find((x) => x.valor === r)?.nombre ?? r;

/**
 * Crear o editar a un usuario del equipo.
 *
 * - CREAR es un asistente, igual que «Exportar informe»: 1 · Datos,
 *   2 · Permisos (la consola por vistas), 3 · Confirmar. No se avanza sin
 *   datos válidos, y al final queda la clave temporal para compartir.
 * - EDITAR usa las mismas pestañas, pero sin orden: se salta libremente entre
 *   «Información» y «Permisos» y un solo «Guardar» guarda las dos (los
 *   permisos solo se envían si cambiaron).
 */
export function UserEditorModal({
  usuario,
  puedeEditarRol,
  puedeGestionarPermisos,
  pestanaInicial = "info",
  onCerrar,
  onGuardado,
}: Props) {
  const esEdicion = usuario !== null;
  const id = useId();

  const [paso, setPaso] = useState<Paso>(pestanaInicial);
  const [nombre, setNombre] = useState(usuario?.nombre_usuario ?? "");
  const [email, setEmail] = useState(usuario?.email_usuario ?? "");
  const [rol, setRol] = useState(usuario?.rol_usuario ?? "ANALISTA");
  const [activo, setActivo] = useState(usuario?.is_active ?? true);
  const [telefono, setTelefono] = useState(usuario?.telefono_usuario ?? "");
  const [direccion, setDireccion] = useState(usuario?.direccion_usuario ?? "");
  const [tipoDoc, setTipoDoc] = useState<string>(usuario?.tipo_documento || "CC");
  const [numeroDoc, setNumeroDoc] = useState(usuario?.numero_documento ?? "");
  const [intentoDatos, setIntentoDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  const [catalogo, setCatalogo] = useState<ModuloPermisos[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [originales, setOriginales] = useState<Set<string>>(new Set());
  const [cargandoPermisos, setCargandoPermisos] = useState(puedeGestionarPermisos);
  const [errorPermisos, setErrorPermisos] = useState<string | null>(null);

  // Quien es (o pasa a ser) Gerente tiene acceso total: no hay permisos que repartir.
  const tieneAccesoTotal = (usuario?.es_administrador ?? false) || rol === ROL_DUENO;
  const conPermisos = puedeGestionarPermisos;

  useEffect(() => {
    if (!puedeGestionarPermisos) return;
    Promise.all([obtenerPermisosDisponibles(), usuario ? obtenerPermisosUsuario(usuario.id) : Promise.resolve([])])
      .then(([cat, permisos]) => {
        setCatalogo(cat);
        setSeleccionados(new Set(permisos));
        setOriginales(new Set(permisos));
      })
      .catch(() => setErrorPermisos("No se pudieron cargar los permisos."))
      .finally(() => setCargandoPermisos(false));
  }, [puedeGestionarPermisos, usuario]);

  // Al crear todo es obligatorio. Al editar, una cuenta antigua puede seguir
  // sin datos personales, pero lo que se escriba debe ser válido.
  const errores = useMemo(() => {
    const e: { nombre?: string; email?: string; telefono?: string; direccion?: string; documento?: string } = {};
    if (nombre.trim().length < 2) e.nombre = "Escribe el nombre completo.";
    if (!esEdicion) {
      if (!email.trim()) e.email = "El correo es obligatorio.";
      else if (!CORREO_VALIDO.test(email.trim())) e.email = "Revisa el correo: no parece válido.";
    }
    const obligatorio = !esEdicion;

    const tel = telefono.trim();
    if (!tel) {
      if (obligatorio) e.telefono = "El teléfono es obligatorio.";
    } else if (!/^\+?[\d\s\-().]+$/.test(tel)) e.telefono = "Escribe solo números (puede empezar con +).";
    else if (digitosTelefono(tel).length < 7 || digitosTelefono(tel).length > 15)
      e.telefono = "El teléfono debe tener entre 7 y 15 dígitos.";

    const dir = direccion.trim();
    if (!dir) {
      if (obligatorio) e.direccion = "La dirección es obligatoria.";
    } else if (dir.length < 5) e.direccion = "Escribe la dirección completa.";

    const doc = limpiarDocumento(numeroDoc);
    if (!doc) {
      if (obligatorio) e.documento = "El número de documento es obligatorio.";
    } else if (!REGLAS_DOCUMENTO[tipoDoc]?.patron.test(doc)) e.documento = REGLAS_DOCUMENTO[tipoDoc]?.mensaje;
    return e;
  }, [nombre, email, esEdicion, telefono, direccion, tipoDoc, numeroDoc]);
  const datosValidos = Object.values(errores).every((v) => !v);
  const faltanDatosPersonales =
    esEdicion && (!telefono.trim() || !direccion.trim() || !numeroDoc.trim());
  const permisosCambiados = !mismosPermisos(seleccionados, originales);

  // Cuántas vistas quedan habilitadas (para los resúmenes).
  const vistasHabilitadas = useMemo(
    () =>
      catalogo.filter((m) => {
        const vista = m.permisos.find((p) => /\.view_/.test(p.codename));
        return vista ? seleccionados.has(vista.codename) : m.permisos.some((p) => seleccionados.has(p.codename));
      }),
    [catalogo, seleccionados]
  );
  const resumenPermisos = tieneAccesoTotal
    ? "Acceso total"
    : cargandoPermisos
      ? "Cargando…"
      : `${vistasHabilitadas.length} de ${catalogo.length} vistas`;

  // ---------------------------------------------------------------- pasos
  const ordenPasos: Paso[] = esEdicion
    ? ["info", ...(conPermisos ? (["permisos"] as const) : [])]
    : ["info", ...(conPermisos ? (["permisos"] as const) : []), "confirmar"];
  const indice = ordenPasos.indexOf(paso);
  const ultimo = indice === ordenPasos.length - 1;

  const pasos: PasoModal[] = ordenPasos.map((p, i) => {
    if (p === "info")
      return {
        clave: p,
        titulo: esEdicion ? "Información" : "Datos",
        detalle: nombre.trim() ? `${nombre.trim()} · ${nombreRol(rol)}` : "Datos personales y rol",
        hecho: !esEdicion && (i < indice || Boolean(passwordTemporal)),
      };
    if (p === "permisos")
      return {
        clave: p,
        titulo: "Permisos por vista",
        detalle: resumenPermisos,
        // Al crear, no se llega a los permisos sin datos válidos.
        bloqueado: !esEdicion && !datosValidos && !passwordTemporal,
        hecho: !esEdicion && (i < indice || Boolean(passwordTemporal)),
      };
    return {
      clave: p,
      titulo: "Confirmar",
      detalle: passwordTemporal ? "Creado" : "Revisa y crea",
      bloqueado: !datosValidos && !passwordTemporal,
      hecho: Boolean(passwordTemporal),
    };
  });

  function irA(destino: string) {
    if (passwordTemporal) return;
    const d = destino as Paso;
    if (!esEdicion && d !== "info" && !datosValidos) {
      setIntentoDatos(true);
      setPaso("info");
      return;
    }
    setError(null);
    setPaso(d);
  }

  function siguiente() {
    if (paso === "info" && !datosValidos) {
      setIntentoDatos(true);
      return;
    }
    irA(ordenPasos[indice + 1]);
  }

  /** Lo que se envía. Al editar, el documento solo viaja si se escribió (una
   *  cuenta antigua puede seguir sin él). */
  function datosPersonalesCompletos() {
    return {
      telefono_usuario: telefono.trim(),
      direccion_usuario: direccion.trim(),
      tipo_documento: tipoDoc,
      numero_documento: limpiarDocumento(numeroDoc),
    };
  }
  function datosPersonales() {
    const { tipo_documento, numero_documento, ...resto } = datosPersonalesCompletos();
    return numero_documento ? { ...resto, tipo_documento, numero_documento } : resto;
  }

  // -------------------------------------------------------------- guardar
  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    setIntentoDatos(true);
    setError(null);
    if (!datosValidos) {
      setPaso("info");
      return;
    }

    setGuardando(true);
    try {
      let destino = usuario;
      if (esEdicion) {
        await actualizarUsuario(usuario!.id, {
          nombre_usuario: nombre.trim(),
          is_active: activo,
          ...(puedeEditarRol ? { rol_usuario: rol } : {}),
          ...datosPersonales(),
        });
      } else {
        const resp = await crearUsuario({ email: email.trim(), nombre: nombre.trim(), rol, ...datosPersonalesCompletos() });
        destino = resp.usuario;
        setPasswordTemporal(resp.password_temporal);
      }

      if (conPermisos && !tieneAccesoTotal && destino && permisosCambiados) {
        try {
          await actualizarPermisosUsuario(destino.id, [...seleccionados]);
          setOriginales(new Set(seleccionados));
        } catch (err) {
          // Los datos ya quedaron guardados: se dice qué faltó, sin perderlo.
          if (esEdicion) setPaso("permisos");
          setError(extraerMensajeError(err, "Los datos se guardaron, pero los permisos no. Vuelve a intentarlo."));
          return;
        }
      }

      if (esEdicion) onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, esEdicion ? "No se pudo guardar el usuario." : "No se pudo crear el usuario."));
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    if (guardando) return;
    if (passwordTemporal) onGuardado();
    else onCerrar();
  }

  async function copiarClave() {
    if (!passwordTemporal) return;
    try {
      await navigator.clipboard.writeText(passwordTemporal);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      // Sin permiso de portapapeles: la clave sigue a la vista para copiarla a mano.
    }
  }

  // ------------------------------------------------------------------ pie
  let pie;
  if (passwordTemporal) {
    pie = (
      <button type="button" className="btn primario" onClick={cerrar}>
        Listo
      </button>
    );
  } else if (esEdicion) {
    pie = (
      <>
        {conPermisos && !tieneAccesoTotal && permisosCambiados && (
          <span className="pie-aviso" role="status">
            Permisos sin guardar
          </span>
        )}
        <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" form={`${id}-form`} className="btn primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </>
    );
  } else {
    pie = (
      <>
        {indice === 0 ? (
          <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
        ) : (
          <button type="button" className="btn secundario btn-con-icono" onClick={() => irA(ordenPasos[indice - 1])} disabled={guardando}>
            <ArrowLeft size={16} aria-hidden="true" /> Atrás
          </button>
        )}
        {ultimo ? (
          <button type="submit" form={`${id}-form`} className="btn primario btn-con-icono" disabled={guardando}>
            <UserPlus size={16} aria-hidden="true" /> {guardando ? "Creando…" : "Crear usuario"}
          </button>
        ) : (
          <button type="button" className="btn primario btn-con-icono" onClick={siguiente}>
            Siguiente: {ordenPasos[indice + 1] === "permisos" ? "permisos" : "confirmar"} <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </>
    );
  }

  const titulo = esEdicion ? `Editar a ${usuario!.nombre_usuario}` : "Nuevo usuario";

  return (
    <Modal
      amplio
      ancho
      expandible
      titulo={titulo}
      subtitulo={esEdicion ? usuario!.email_usuario : "Recibirá una clave temporal para su primer ingreso."}
      subcabecera={
        ordenPasos.length > 1 ? (
          <PasosModal
            etiqueta={esEdicion ? "Secciones del usuario" : "Pasos para crear el usuario"}
            pasos={pasos}
            activo={passwordTemporal ? "confirmar" : paso}
            onCambiar={irA}
            numerados={!esEdicion}
          />
        ) : undefined
      }
      onCerrar={cerrar}
      cerrarConEscape={!guardando}
      footer={pie}
    >
      {passwordTemporal ? (
        <div className="usuario-creado" role="status">
          <span className="usuario-creado-icono" aria-hidden="true">
            <Check size={22} />
          </span>
          <h3>{nombre.trim()} ya forma parte del equipo</h3>
          <p>Comparte esta clave temporal; deberá cambiarla en su primer ingreso.</p>
          <div className="usuario-clave">
            <KeyRound size={16} aria-hidden="true" />
            <code>{passwordTemporal}</code>
            <button type="button" className="btn secundario sm btn-con-icono" onClick={copiarClave}>
              {copiada ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copiada ? "Copiada" : "Copiar"}
            </button>
          </div>
          {error && <div className="error-box">{error}</div>}
        </div>
      ) : (
        <form
          id={`${id}-form`}
          onSubmit={(e) => {
            // Al crear, Enter en un paso intermedio avanza en vez de crear.
            if (!esEdicion && !ultimo) {
              e.preventDefault();
              siguiente();
              return;
            }
            guardar(e);
          }}
          noValidate
          className="usuario-editor"
        >
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          {/* ------------------------------------------------ 1 · Datos */}
          {paso === "info" && (
            <div className="usuario-paso" role="tabpanel">
              {/* Todo lo que identifica a la persona, en un solo bloque:
                  nombre, correo, documento, teléfono y dirección. */}
              <fieldset className="usuario-personales">
                <legend>
                  Datos personales
                  {faltanDatosPersonales && <span className="usuario-falta">Incompletos</span>}
                </legend>
                <div className="usuario-datos">
                <div className="campo">
                  <label htmlFor={`${id}-nombre`}>Nombre completo *</label>
                  <input
                    id={`${id}-nombre`}
                    value={nombre}
                    maxLength={150}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={intentoDatos && Boolean(errores.nombre)}
                    aria-describedby={intentoDatos && errores.nombre ? `${id}-nombre-error` : undefined}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                  {intentoDatos && errores.nombre && (
                    <p className="campo-error" id={`${id}-nombre-error`}>
                      <AlertCircle size={14} aria-hidden="true" /> {errores.nombre}
                    </p>
                  )}
                </div>

                <div className="campo">
                  <label htmlFor={`${id}-email`}>Correo electrónico {esEdicion ? "" : "*"}</label>
                  <input
                    id={`${id}-email`}
                    type="email"
                    value={email}
                    disabled={esEdicion}
                    aria-invalid={intentoDatos && Boolean(errores.email)}
                    aria-describedby={
                      esEdicion ? `${id}-email-ayuda` : intentoDatos && errores.email ? `${id}-email-error` : undefined
                    }
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {esEdicion ? (
                    <p className="campo-ayuda" id={`${id}-email-ayuda`}>
                      Es su usuario de acceso; no se cambia desde aquí.
                    </p>
                  ) : intentoDatos && errores.email ? (
                    <p className="campo-error" id={`${id}-email-error`}>
                      <AlertCircle size={14} aria-hidden="true" /> {errores.email}
                    </p>
                  ) : (
                    <p className="campo-ayuda">Con este correo entrará al panel.</p>
                  )}
                </div>

                  <div className="campo">
                    <label htmlFor={`${id}-tipodoc`}>Tipo de documento {esEdicion ? "" : "*"}</label>
                    <select id={`${id}-tipodoc`} value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                      {TIPOS_DOCUMENTO.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor={`${id}-numdoc`}>Número de documento {esEdicion ? "" : "*"}</label>
                    <input
                      id={`${id}-numdoc`}
                      value={numeroDoc}
                      maxLength={20}
                      autoComplete="off"
                      inputMode={REGLAS_DOCUMENTO[tipoDoc]?.numerico ? "numeric" : "text"}
                      aria-invalid={intentoDatos && Boolean(errores.documento)}
                      aria-describedby={intentoDatos && errores.documento ? `${id}-numdoc-error` : undefined}
                      onChange={(e) => setNumeroDoc(e.target.value)}
                    />
                    {intentoDatos && errores.documento && (
                      <p className="campo-error" id={`${id}-numdoc-error`}>
                        <AlertCircle size={14} aria-hidden="true" /> {errores.documento}
                      </p>
                    )}
                  </div>
                  <div className="campo">
                    <label htmlFor={`${id}-telefono`}>Teléfono {esEdicion ? "" : "*"}</label>
                    <input
                      id={`${id}-telefono`}
                      type="tel"
                      value={telefono}
                      maxLength={20}
                      autoComplete="off"
                      inputMode="tel"
                      placeholder="300 123 4567"
                      aria-invalid={intentoDatos && Boolean(errores.telefono)}
                      aria-describedby={intentoDatos && errores.telefono ? `${id}-telefono-error` : undefined}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                    {intentoDatos && errores.telefono && (
                      <p className="campo-error" id={`${id}-telefono-error`}>
                        <AlertCircle size={14} aria-hidden="true" /> {errores.telefono}
                      </p>
                    )}
                  </div>
                  <div className="campo">
                    <label htmlFor={`${id}-direccion`}>Dirección {esEdicion ? "" : "*"}</label>
                    <input
                      id={`${id}-direccion`}
                      value={direccion}
                      maxLength={255}
                      autoComplete="off"
                      placeholder="Calle, número, barrio y ciudad"
                      aria-invalid={intentoDatos && Boolean(errores.direccion)}
                      aria-describedby={intentoDatos && errores.direccion ? `${id}-direccion-error` : undefined}
                      onChange={(e) => setDireccion(e.target.value)}
                    />
                    {intentoDatos && errores.direccion && (
                      <p className="campo-error" id={`${id}-direccion-error`}>
                        <AlertCircle size={14} aria-hidden="true" /> {errores.direccion}
                      </p>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="usuario-roles" disabled={esEdicion && !puedeEditarRol}>
                <legend>
                  Rol {!puedeEditarRol && esEdicion && <span className="usuario-nota">(solo un Gerente puede cambiarlo)</span>}
                </legend>
                <div className="usuario-roles-lista">
                  {ROLES.map((r) => (
                    <label key={r.valor} className={`usuario-rol ${rol === r.valor ? "activo" : ""}`}>
                      <input type="radio" name={`${id}-rol`} value={r.valor} checked={rol === r.valor} onChange={() => setRol(r.valor)} />
                      <strong>{r.nombre}</strong>
                      <small>{r.ayuda}</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              {esEdicion && (
                <label className="usuario-activo">
                  <span>
                    <strong>Cuenta activa</strong>
                    <small>Si la desactivas, no podrá entrar al panel.</small>
                  </span>
                  <span className="switch">
                    <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                    <span className="switch-riel" />
                  </span>
                </label>
              )}
            </div>
          )}

          {/* --------------------------------------------- 2 · Permisos */}
          {paso === "permisos" && conPermisos && (
            <div className="usuario-paso" role="tabpanel">
              {tieneAccesoTotal ? (
                <div className="ok-box usuario-editor-aviso">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>
                    Un <strong>Gerente</strong> es dueño de la cuenta: tiene acceso total a todas las vistas, así que no se
                    le asignan permisos uno a uno.
                  </span>
                </div>
              ) : errorPermisos ? (
                <div className="error-box">{errorPermisos}</div>
              ) : cargandoPermisos ? (
                <div className="vacio">Cargando permisos…</div>
              ) : catalogo.length === 0 ? (
                <div className="vacio">El plan de este negocio no incluye vistas que repartir.</div>
              ) : (
                <ConsolaPermisos catalogo={catalogo} seleccionados={seleccionados} onCambiar={setSeleccionados} nombre={nombre} />
              )}
            </div>
          )}

          {/* --------------------------------------------- 3 · Confirmar */}
          {paso === "confirmar" && (
            <div className="usuario-paso" role="tabpanel">
              <p className="usuario-intro">Revisa los datos antes de crear la cuenta.</p>
              <dl className="usuario-resumen">
                <div>
                  <dt>Nombre</dt>
                  <dd>{nombre.trim()}</dd>
                </div>
                <div>
                  <dt>Correo</dt>
                  <dd>{email.trim()}</dd>
                </div>
                <div>
                  <dt>Documento</dt>
                  <dd>
                    {nombreDocumento(tipoDoc)} · {limpiarDocumento(numeroDoc)}
                  </dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>{telefono.trim()}</dd>
                </div>
                <div className="usuario-resumen-ancho">
                  <dt>Dirección</dt>
                  <dd>{direccion.trim()}</dd>
                </div>
                <div>
                  <dt>Rol</dt>
                  <dd>{nombreRol(rol)}</dd>
                </div>
                <div>
                  <dt>Acceso</dt>
                  <dd>
                    {tieneAccesoTotal
                      ? "Total (dueño de la cuenta)"
                      : !conPermisos
                        ? "Sin permisos asignados"
                        : vistasHabilitadas.length === 0
                          ? "Ninguna vista: no podrá ver nada hasta que le des permisos"
                          : `${vistasHabilitadas.length} ${vistasHabilitadas.length === 1 ? "vista" : "vistas"} · ${seleccionados.size} permisos`}
                  </dd>
                </div>
              </dl>
              {!tieneAccesoTotal && vistasHabilitadas.length > 0 && (
                <ul className="usuario-vistas">
                  {vistasHabilitadas.map((m) => (
                    <li key={m.modulo}>
                      <Check size={13} aria-hidden="true" /> {m.modulo}
                    </li>
                  ))}
                </ul>
              )}
              {conPermisos && !tieneAccesoTotal && (
                <button type="button" className="usuario-editar-paso" onClick={() => irA("permisos")}>
                  Cambiar permisos
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
