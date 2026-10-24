import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, Eye, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { Modal } from "../../components/Modal";
import {
  actualizarPermisosUsuario,
  actualizarUsuario,
  crearUsuario,
  obtenerPermisosDisponibles,
  obtenerPermisosUsuario,
} from "../../api/resources";
import type { ModuloPermisos, PermisoItem, Usuario } from "../../types";
import { extraerMensajeError } from "../../utils";

const ROLES = ["ANALISTA", "ADMIN", "GERENTE"];
/** Un Gerente es dueño de la cuenta: tiene acceso total y no se le reparten permisos. */
const ROL_DUENO = "GERENTE";
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PestanaUsuario = "info" | "permisos";

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

// El catálogo del backend no distingue "vista" de "acción" como campo aparte:
// se infiere del verbo de Django en el codename (view_/add_/change_/delete_),
// que es la misma convención que ya usa todo el resto del sistema de permisos.
function esPermisoDeVista(codename: string): boolean {
  return /\.view_/.test(codename);
}

const ICONOS_ACCION: Record<string, LucideIcon> = { add: Plus, change: Pencil, delete: Trash2 };

function iconoAccion(codename: string): LucideIcon {
  const verbo = codename.match(/\.(add|change|delete)_/)?.[1];
  return (verbo && ICONOS_ACCION[verbo]) || Pencil;
}

function mismosPermisos(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((c) => b.has(c));
}

function GrupoPermisos({
  titulo,
  icono: Icono,
  permisos,
  seleccionados,
  onAlternar,
  iconoPorItem,
}: {
  titulo: string;
  icono: LucideIcon;
  permisos: PermisoItem[];
  seleccionados: Set<string>;
  onAlternar: (codename: string) => void;
  iconoPorItem?: (codename: string) => LucideIcon;
}) {
  if (permisos.length === 0) return null;
  return (
    <fieldset className="permisos-subgrupo">
      <legend className="permisos-subgrupo-titulo">
        <Icono size={13} aria-hidden="true" /> {titulo}
      </legend>
      <div className="permisos-grid">
        {permisos.map((p) => {
          const IconoItem = iconoPorItem?.(p.codename);
          return (
            <label className="permiso-chip" key={p.codename}>
              <input type="checkbox" checked={seleccionados.has(p.codename)} onChange={() => onAlternar(p.codename)} />
              {IconoItem && <IconoItem size={13} aria-hidden="true" />}
              {p.etiqueta}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Editar un usuario y lo que puede hacer, en un solo lugar: «Información de
 * usuario» y «Módulos y permisos». Un solo «Guardar» guarda las dos pestañas;
 * los permisos solo se envían si cambiaron.
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

  const [pestana, setPestana] = useState<PestanaUsuario>(pestanaInicial);
  const [nombre, setNombre] = useState(usuario?.nombre_usuario ?? "");
  const [email, setEmail] = useState(usuario?.email_usuario ?? "");
  const [rol, setRol] = useState(usuario?.rol_usuario ?? "ANALISTA");
  const [activo, setActivo] = useState(usuario?.is_active ?? true);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState<ModuloPermisos[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [originales, setOriginales] = useState<Set<string>>(new Set());
  const [cargandoPermisos, setCargandoPermisos] = useState(puedeGestionarPermisos);
  const [errorPermisos, setErrorPermisos] = useState<string | null>(null);

  // Quien es (o pasa a ser) Gerente tiene acceso total: no hay permisos que repartir.
  const tieneAccesoTotal = (usuario?.es_administrador ?? false) || rol === ROL_DUENO;
  const conPestanaPermisos = puedeGestionarPermisos;

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

  const errores = useMemo(() => {
    const e: { nombre?: string; email?: string } = {};
    if (nombre.trim().length < 2) e.nombre = "Escribe el nombre completo.";
    if (!esEdicion) {
      if (!email.trim()) e.email = "El correo es obligatorio.";
      else if (!CORREO_VALIDO.test(email.trim())) e.email = "Revisa el correo: no parece válido.";
    }
    return e;
  }, [nombre, email, esEdicion]);

  const totalPermisos = catalogo.reduce((n, m) => n + m.permisos.length, 0);
  const permisosCambiados = !mismosPermisos(seleccionados, originales);

  function alternar(codename: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(codename)) next.delete(codename);
      else next.add(codename);
      return next;
    });
  }

  function alternarModulo(m: ModuloPermisos, marcar: boolean) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      for (const p of m.permisos) {
        if (marcar) next.add(p.codename);
        else next.delete(p.codename);
      }
      return next;
    });
  }

  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    setIntentoGuardar(true);
    setError(null);
    if (errores.nombre || errores.email) {
      setPestana("info");
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
        });
      } else {
        const resp = await crearUsuario({ email: email.trim(), nombre: nombre.trim(), rol });
        destino = resp.usuario;
        setPasswordTemporal(resp.password_temporal);
      }

      if (conPestanaPermisos && !tieneAccesoTotal && destino && permisosCambiados) {
        try {
          await actualizarPermisosUsuario(destino.id, [...seleccionados]);
          setOriginales(new Set(seleccionados));
        } catch (err) {
          // Los datos ya quedaron guardados: se dice qué faltó, sin perderlo.
          setPestana("permisos");
          setError(
            extraerMensajeError(err, "Los datos se guardaron, pero los permisos no. Vuelve a intentarlo.")
          );
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

  // Pestañas accesibles: flechas izquierda/derecha para moverse entre ellas.
  const refPestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const pestanas: { clave: PestanaUsuario; etiqueta: string; icono: LucideIcon }[] = [
    { clave: "info", etiqueta: "Información de usuario", icono: UserRound },
    ...(conPestanaPermisos ? [{ clave: "permisos" as const, etiqueta: "Módulos y permisos", icono: KeyRound }] : []),
  ];
  function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = pestanas.findIndex((p) => p.clave === pestana);
    const siguiente = (i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
    setPestana(pestanas[siguiente].clave);
    refPestanas.current[siguiente]?.focus();
  }

  const titulo = esEdicion ? `Editar a ${usuario!.nombre_usuario}` : "Nuevo usuario";

  return (
    <Modal
      amplio
      ancho
      titulo={titulo}
      subtitulo={esEdicion ? usuario!.email_usuario : "Recibirá una clave temporal para su primer ingreso."}
      onCerrar={cerrar}
      cerrarConEscape={!guardando}
      footer={
        passwordTemporal ? (
          <button type="button" className="btn primario" onClick={cerrar}>
            Listo
          </button>
        ) : (
          <>
            {conPestanaPermisos && !tieneAccesoTotal && permisosCambiados && (
              <span className="pie-aviso" role="status">
                Permisos sin guardar
              </span>
            )}
            <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" form={`${id}-form`} className="btn primario" disabled={guardando}>
              {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear usuario"}
            </button>
          </>
        )
      }
    >
      {passwordTemporal ? (
        <div className="ok-box" role="status">
          Usuario creado. Clave temporal: <strong style={{ fontSize: "1.1rem" }}>{passwordTemporal}</strong>
          <br />
          Compártela con el usuario; deberá cambiarla al ingresar.
          {error && (
            <>
              <br />
              <strong>{error}</strong>
            </>
          )}
        </div>
      ) : (
        <form id={`${id}-form`} onSubmit={guardar} noValidate className="usuario-editor">
          {pestanas.length > 1 && (
            <div className="gestion-tabs usuario-editor-tabs" role="tablist" aria-label="Secciones del usuario" onKeyDown={alTeclado}>
              {pestanas.map((p, i) => {
                const Icono = p.icono;
                const activa = pestana === p.clave;
                return (
                  <button
                    key={p.clave}
                    ref={(el) => {
                      refPestanas.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${p.clave}`}
                    aria-selected={activa}
                    aria-controls={`${id}-panel-${p.clave}`}
                    tabIndex={activa ? 0 : -1}
                    className={activa ? "activo" : ""}
                    onClick={() => setPestana(p.clave)}
                  >
                    <Icono size={15} aria-hidden="true" /> {p.etiqueta}
                    {p.clave === "permisos" && !tieneAccesoTotal && !cargandoPermisos && (
                      <span className="gestion-tab-num">{seleccionados.size}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          <div
            role={pestanas.length > 1 ? "tabpanel" : undefined}
            id={`${id}-panel-info`}
            aria-labelledby={pestanas.length > 1 ? `${id}-tab-info` : undefined}
            hidden={pestana !== "info"}
          >
            <div className="campo">
              <label htmlFor={`${id}-nombre`}>Nombre completo *</label>
              <input
                id={`${id}-nombre`}
                value={nombre}
                maxLength={150}
                autoComplete="off"
                aria-invalid={intentoGuardar && Boolean(errores.nombre)}
                aria-describedby={intentoGuardar && errores.nombre ? `${id}-nombre-error` : undefined}
                onChange={(e) => setNombre(e.target.value)}
              />
              {intentoGuardar && errores.nombre && (
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
                aria-invalid={intentoGuardar && Boolean(errores.email)}
                aria-describedby={
                  esEdicion ? `${id}-email-ayuda` : intentoGuardar && errores.email ? `${id}-email-error` : undefined
                }
                onChange={(e) => setEmail(e.target.value)}
              />
              {esEdicion && (
                <p className="campo-ayuda" id={`${id}-email-ayuda`}>
                  Es su usuario de acceso; no se cambia desde aquí.
                </p>
              )}
              {!esEdicion && intentoGuardar && errores.email && (
                <p className="campo-error" id={`${id}-email-error`}>
                  <AlertCircle size={14} aria-hidden="true" /> {errores.email}
                </p>
              )}
            </div>

            <div className="campo">
              <label htmlFor={`${id}-rol`}>
                Rol {!puedeEditarRol && esEdicion && "(solo un Gerente puede cambiarlo)"}
              </label>
              <select
                id={`${id}-rol`}
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                disabled={esEdicion && !puedeEditarRol}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {rol === ROL_DUENO && <p className="campo-ayuda">Un Gerente tiene acceso total al panel.</p>}
            </div>

            {esEdicion && (
              <div className="campo">
                <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  Cuenta activa
                </label>
              </div>
            )}
          </div>

          {conPestanaPermisos && (
            <div
              role="tabpanel"
              id={`${id}-panel-permisos`}
              aria-labelledby={`${id}-tab-permisos`}
              hidden={pestana !== "permisos"}
            >
              {tieneAccesoTotal ? (
                <div className="ok-box usuario-editor-aviso">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>
                    Un <strong>Gerente</strong> es dueño de la cuenta: tiene acceso total a todos los módulos, así que no
                    se le asignan permisos uno a uno.
                  </span>
                </div>
              ) : (
                <>
                  <div className="ok-box usuario-editor-aviso">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <span>
                      Por cada módulo, elige qué puede <strong>ver</strong> y qué puede <strong>hacer</strong>
                      {nombre.trim() ? (
                        <>
                          {" "}
                          <strong>{nombre.trim()}</strong>
                        </>
                      ) : null}
                      . Todo lo demás quedará bloqueado, incluso si es un usuario ADMIN o ANALISTA. Solo aparecen los
                      módulos que incluye el plan del negocio.
                    </span>
                  </div>
                  {errorPermisos && <div className="error-box">{errorPermisos}</div>}
                  {cargandoPermisos ? (
                    <div className="vacio">Cargando…</div>
                  ) : catalogo.length === 0 ? (
                    !errorPermisos && <div className="vacio">El plan de este negocio no incluye módulos que repartir.</div>
                  ) : (
                    <>
                      <p className="usuario-editor-resumen" aria-live="polite">
                        <strong>{seleccionados.size}</strong> de {totalPermisos} permisos concedidos
                      </p>
                      <div className="permisos-lista">
                        {catalogo.map((m) => {
                          const vistas = m.permisos.filter((p) => esPermisoDeVista(p.codename));
                          const acciones = m.permisos.filter((p) => !esPermisoDeVista(p.codename));
                          const marcados = m.permisos.filter((p) => seleccionados.has(p.codename)).length;
                          const todos = marcados === m.permisos.length;
                          return (
                            <section className="permisos-modulo" key={m.modulo} aria-label={m.modulo}>
                              <div className="permisos-modulo-cab">
                                <h3>
                                  {m.modulo}{" "}
                                  <span className="permisos-modulo-cuenta">
                                    {marcados}/{m.permisos.length}
                                  </span>
                                </h3>
                                <button
                                  type="button"
                                  className="btn secundario sm"
                                  onClick={() => alternarModulo(m, !todos)}
                                  aria-label={`${todos ? "Quitar" : "Conceder"} todos los permisos de ${m.modulo}`}
                                >
                                  {todos ? "Quitar todo" : "Conceder todo"}
                                </button>
                              </div>
                              <GrupoPermisos
                                titulo="Puede ver"
                                icono={Eye}
                                permisos={vistas}
                                seleccionados={seleccionados}
                                onAlternar={alternar}
                              />
                              <GrupoPermisos
                                titulo="Puede hacer"
                                icono={Pencil}
                                permisos={acciones}
                                seleccionados={seleccionados}
                                onAlternar={alternar}
                                iconoPorItem={iconoAccion}
                              />
                            </section>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
