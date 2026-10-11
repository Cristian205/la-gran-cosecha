import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Copy,
  Key,
  Mail,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { actualizarUsuario, eliminarUsuario, obtenerUsuarios } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import type { Usuario } from "../types";
import { extraerMensajeError, formatoFecha, normalizarTexto, tienePermiso } from "../utils";
import { alertaAdvertencia, alertaError, alertaExito, confirmarAccion, confirmarEliminar } from "../utils/alertas";
import { Tooltip } from "../components/Tooltip";
import { ColumnPickerButton } from "../components/ColumnPickerButton";
import { ThOrdenable } from "../components/ThOrdenable";
import { useColumnas } from "../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../hooks/useOrdenTabla";
import { EstadoVacio, MenuFila, Pastilla, TarjetaKpi, type AccionMenu, type Tono } from "../components/gestion/Gestion";
import { diaRelativo } from "../utils/fechas";
import { UserFormModal } from "./users/UserFormModal";
import { UserPermissionsModal } from "./users/UserPermissionsModal";
import "./users/usuarios.css";

type Segmento = "todos" | "activos" | "inactivos" | "administradores";
type ClaveKpi = "total" | "activos" | "administradores" | "delegados" | "inactivos";

const OPCIONES_SEGMENTO: { valor: Segmento; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
  { valor: "administradores", etiqueta: "Administradores" },
];

/** Los roles de siempre, con nombre de persona y no de constante. */
const ROLES: { valor: string; etiqueta: string; tono: Tono }[] = [
  { valor: "GERENTE", etiqueta: "Gerente", tono: "violeta" },
  { valor: "ADMIN", etiqueta: "Administrador", tono: "azul" },
  { valor: "ANALISTA", etiqueta: "Analista", tono: "neutro" },
];
const ROL_POR_VALOR = new Map(ROLES.map((r) => [r.valor, r]));

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Columnas configurables. Las claves no cambian: `useColumnas` guarda en el
 *  navegador cuáles están visibles y en qué orden. */
function definiciones(actualId: number | undefined): Record<
  string,
  { etiqueta: string; clase?: string; render: (u: Usuario) => ReactNode }
> {
  return {
    nombre: {
      etiqueta: "Usuario",
      render: (u) => (
        <span className="usuario-identidad">
          <span className={`usuario-avatar ${u.is_active ? "" : "inactivo"}`} aria-hidden="true">
            {iniciales(u.nombre_usuario)}
          </span>
          <span className="usuario-textos">
            <span className="celda-nombre" title={u.nombre_usuario}>
              {u.nombre_usuario}
              {u.id === actualId && <span className="usuario-tu">Tú</span>}
            </span>
            <span className="usuario-correo" title={u.email_usuario}>
              {u.email_usuario}
            </span>
          </span>
        </span>
      ),
    },
    rol: {
      etiqueta: "Rol",
      render: (u) => {
        const rol = ROL_POR_VALOR.get(u.rol_usuario);
        return <Pastilla tono={rol?.tono ?? "neutro"}>{rol?.etiqueta ?? u.rol_usuario}</Pastilla>;
      },
    },
    acceso: {
      etiqueta: "Acceso",
      render: (u) =>
        u.es_administrador ? (
          <Pastilla tono="verde">
            <ShieldCheck size={12} aria-hidden /> Acceso total
          </Pastilla>
        ) : u.permisos.length > 0 ? (
          <span className="celda-cifra-suave">
            {u.permisos.length} {u.permisos.length === 1 ? "permiso" : "permisos"}
          </span>
        ) : (
          <span className="celda-tenue">Sin permisos</span>
        ),
    },
    estado: {
      etiqueta: "Estado",
      render: (u) =>
        !u.is_active ? (
          <Pastilla>Inactivo</Pastilla>
        ) : u.debe_cambiar_password ? (
          <Pastilla tono="ambar">Contraseña temporal</Pastilla>
        ) : (
          <Pastilla tono="verde">Activo</Pastilla>
        ),
    },
    ultimo_acceso: {
      etiqueta: "Último acceso",
      render: (u) =>
        u.ultimo_login_exitoso ? (
          <time className="celda-fecha" dateTime={u.ultimo_login_exitoso} title={formatoFecha(u.ultimo_login_exitoso)}>
            {diaRelativo(u.ultimo_login_exitoso)}
          </time>
        ) : (
          <span className="celda-tenue">Nunca</span>
        ),
    },
    alta: {
      etiqueta: "Alta",
      render: (u) => (
        <time className="celda-fecha" dateTime={u.fecha_creacion} title={formatoFecha(u.fecha_creacion)}>
          {diaRelativo(u.fecha_creacion)}
        </time>
      ),
    },
  };
}

const CLAVES_USUARIOS = Object.keys(definiciones(undefined));
const ETIQUETAS_USUARIOS = Object.fromEntries(
  Object.entries(definiciones(undefined)).map(([clave, def]) => [clave, def.etiqueta])
);

const EXTRACTORES_USUARIOS: ExtractoresOrden<Usuario> = {
  nombre: (u) => normalizarTexto(u.nombre_usuario),
  rol: (u) => ROL_POR_VALOR.get(u.rol_usuario)?.etiqueta ?? u.rol_usuario,
  acceso: (u) => (u.es_administrador ? 1000 : u.permisos.length),
  estado: (u) => (u.is_active ? (u.debe_cambiar_password ? 1 : 2) : 0),
  ultimo_acceso: (u) => u.ultimo_login_exitoso ?? "",
  alta: (u) => u.fecha_creacion,
};

export function UsersPage() {
  const { usuario: actual, negocioActivo } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [segmento, setSegmento] = useState<Segmento>("todos");
  const [rolFiltro, setRolFiltro] = useState("");
  const [kpiPulsado, setKpiPulsado] = useState<ClaveKpi | null>(null);

  const {
    estado: columnasEstado,
    visibles: columnasVisibles,
    alternar: alternarColumna,
    mover: moverColumna,
    restablecer: restablecerColumnas,
  } = useColumnas("usuarios", CLAVES_USUARIOS);
  const { columna: columnaOrden, direccion: direccionOrden, alternarColumna: ordenarPorColumna, ordenar } =
    useOrdenTabla<Usuario>();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [permisosDe, setPermisosDe] = useState<Usuario | null>(null);

  const esOwner = actual?.es_administrador ?? false;
  const puedeCrear = !actual || tienePermiso(actual, "accounts.add_usuario");
  const DEFS = useMemo(() => definiciones(actual?.id), [actual?.id]);

  function cargar() {
    setCargando(true);
    obtenerUsuarios()
      .then((lista) => {
        setUsuarios(lista);
        setError(null);
      })
      .catch((err) => setError(extraerMensajeError(err, "Revisa tu conexión e inténtalo de nuevo.")))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  // ---------- Permisos por fila ----------

  function puedeEditar(u: Usuario) {
    if (!actual) return false;
    if (u.es_administrador && !esOwner) return false;
    return tienePermiso(actual, "accounts.change_usuario");
  }
  function puedeEliminar(u: Usuario) {
    if (!actual || u.id === actual.id) return false;
    if (u.es_administrador && !esOwner) return false;
    return tienePermiso(actual, "accounts.delete_usuario");
  }
  function puedeGestionarPermisos(u: Usuario) {
    return esOwner && !u.es_administrador;
  }

  // ---------- Indicadores ----------

  const kpis = useMemo(() => {
    if (!usuarios) return null;
    return {
      total: usuarios.length,
      activos: usuarios.filter((u) => u.is_active).length,
      inactivos: usuarios.filter((u) => !u.is_active).length,
      administradores: usuarios.filter((u) => u.es_administrador).length,
      delegados: usuarios.filter((u) => !u.es_administrador && u.permisos.length > 0).length,
      sinAccesoReciente: usuarios.filter(
        (u) => u.is_active && (!u.ultimo_login_exitoso || Date.now() - new Date(u.ultimo_login_exitoso).getTime() > 30 * 86_400_000)
      ).length,
    };
  }, [usuarios]);

  // "Con permisos delegados" no es un segmento: es un filtro propio.
  const [soloDelegados, setSoloDelegados] = useState(false);

  const coincideKpi: Record<ClaveKpi, boolean> = {
    total: !busqueda && segmento === "todos" && !rolFiltro && !soloDelegados,
    activos: !busqueda && segmento === "activos" && !rolFiltro && !soloDelegados,
    inactivos: !busqueda && segmento === "inactivos" && !rolFiltro && !soloDelegados,
    administradores: !busqueda && segmento === "administradores" && !rolFiltro && !soloDelegados,
    delegados: !busqueda && segmento === "todos" && !rolFiltro && soloDelegados,
  };
  const kpiActivo = kpiPulsado && coincideKpi[kpiPulsado] ? kpiPulsado : null;

  function aplicarKpi(clave: ClaveKpi) {
    setBusqueda("");
    setRolFiltro("");
    if (kpiActivo === clave) {
      setKpiPulsado(null);
      setSegmento("todos");
      setSoloDelegados(false);
      return;
    }
    setKpiPulsado(clave);
    setSoloDelegados(clave === "delegados");
    setSegmento(clave === "activos" || clave === "inactivos" || clave === "administradores" ? clave : "todos");
  }

  // ---------- Lista ----------

  const lista = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    let l = usuarios ?? [];
    if (q) l = l.filter((u) => normalizarTexto(`${u.nombre_usuario} ${u.email_usuario}`).includes(q));
    if (segmento === "activos") l = l.filter((u) => u.is_active);
    else if (segmento === "inactivos") l = l.filter((u) => !u.is_active);
    else if (segmento === "administradores") l = l.filter((u) => u.es_administrador);
    if (rolFiltro) l = l.filter((u) => u.rol_usuario === rolFiltro);
    if (soloDelegados) l = l.filter((u) => !u.es_administrador && u.permisos.length > 0);
    return ordenar(l, EXTRACTORES_USUARIOS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarios, busqueda, segmento, rolFiltro, soloDelegados, columnaOrden, direccionOrden]);

  const hayFiltros = Boolean(busqueda || segmento !== "todos" || rolFiltro || soloDelegados);

  function limpiarFiltros() {
    setBusqueda("");
    setSegmento("todos");
    setRolFiltro("");
    setSoloDelegados(false);
    setKpiPulsado(null);
  }

  // ---------- Acciones ----------

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }

  async function alternarActivo(u: Usuario) {
    if (u.id === actual?.id) {
      alertaAdvertencia("No puedes desactivar tu propia cuenta.");
      return;
    }
    if (
      u.is_active &&
      !(await confirmarAccion(
        `¿Desactivar a "${u.nombre_usuario}"?`,
        "No podrá entrar al panel hasta que lo actives de nuevo. Su historial se conserva.",
        "Desactivar"
      ))
    )
      return;
    try {
      const actualizado = await actualizarUsuario(u.id, { is_active: !u.is_active });
      setUsuarios((l) => l?.map((x) => (x.id === u.id ? { ...x, ...actualizado } : x)) ?? l);
      alertaExito(u.is_active ? "Usuario desactivado" : "Usuario activado");
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo cambiar el estado del usuario."));
    }
  }

  async function eliminar(u: Usuario) {
    if (u.id === actual?.id) {
      alertaAdvertencia("No puedes eliminar tu propia cuenta.");
      return;
    }
    if (!(await confirmarEliminar(`¿Eliminar al usuario "${u.nombre_usuario}"?`, "Esta acción no se puede deshacer."))) return;
    try {
      await eliminarUsuario(u.id);
      alertaExito("Usuario eliminado");
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el usuario."));
    }
  }

  function accionesDe(u: Usuario): AccionMenu[] {
    const acciones: AccionMenu[] = [];
    if (puedeGestionarPermisos(u)) {
      acciones.push({ clave: "permisos", etiqueta: "Gestionar permisos", icono: <Key size={15} />, onSeleccionar: () => setPermisosDe(u) });
    }
    acciones.push({
      clave: "correo",
      etiqueta: "Escribir un correo",
      icono: <Mail size={15} />,
      onSeleccionar: () => {
        window.location.href = `mailto:${u.email_usuario}`;
      },
    });
    acciones.push({
      clave: "copiar",
      etiqueta: "Copiar correo",
      icono: <Copy size={15} />,
      onSeleccionar: () => {
        navigator.clipboard
          ?.writeText(u.email_usuario)
          .then(() => alertaExito("Correo copiado"))
          .catch(() => alertaError("No se pudo copiar el correo."));
      },
    });
    if (puedeEditar(u) && u.id !== actual?.id) {
      acciones.push({
        clave: "estado",
        etiqueta: u.is_active ? "Desactivar acceso" : "Activar acceso",
        icono: u.is_active ? <PowerOff size={15} /> : <Power size={15} />,
        peligro: u.is_active,
        onSeleccionar: () => alternarActivo(u),
      });
    }
    if (puedeEliminar(u)) {
      acciones.push({ clave: "eliminar", etiqueta: "Eliminar usuario", icono: <Trash2 size={15} />, peligro: true, onSeleccionar: () => eliminar(u) });
    }
    return acciones;
  }

  // ---------- Render ----------

  const columnas = 1 + columnasVisibles.length;
  const sinFilas = !cargando && (Boolean(error) || lista.length === 0);
  const actualizando = cargando && usuarios !== null;
  const cargandoInicial = cargando && usuarios === null;

  let cuerpoVacio: ReactNode = null;
  if (error) {
    cuerpoVacio = (
      <EstadoVacio
        icono={<TriangleAlert size={20} />}
        titulo="No se pudo cargar el equipo"
        texto={error}
        accion={
          <button type="button" className="btn secundario sm" onClick={cargar}>
            <RefreshCw size={14} /> Reintentar
          </button>
        }
      />
    );
  } else if (usuarios && usuarios.length === 0 && !hayFiltros) {
    cuerpoVacio = (
      <EstadoVacio
        icono={<Users size={20} />}
        titulo="Aún no hay nadie en tu equipo"
        texto="Invita a las personas que te ayudan a atender el negocio."
        accion={
          puedeCrear ? (
            <button type="button" className="btn primario sm" onClick={abrirNuevo}>
              <Plus size={14} /> Nuevo usuario
            </button>
          ) : undefined
        }
      />
    );
  } else {
    cuerpoVacio = (
      <EstadoVacio
        icono={<SearchX size={20} />}
        titulo="Ningún usuario coincide con los filtros"
        texto={busqueda ? `No hay resultados para "${busqueda}".` : "Prueba con otro segmento o rol."}
        accion={
          <button type="button" className="btn secundario sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="topbar gestion-topbar">
        <div className="gestion-titulo">
          <h1>Usuarios</h1>
          <p>Gestiona quién trabaja en {negocioActivo?.nombre ?? "tu negocio"}, su rol y lo que puede hacer en el panel</p>
        </div>
        <div className="gestion-topbar-acciones">
          <Tooltip label="Actualizar" posicion="abajo">
            <button
              type="button"
              className="btn-icon gestion-actualizar-icono"
              onClick={cargar}
              disabled={cargando}
              aria-label="Actualizar usuarios"
            >
              <RefreshCw size={16} className={cargando ? "girando" : ""} />
            </button>
          </Tooltip>
          {puedeCrear && (
            <button type="button" className="btn primario" onClick={abrirNuevo}>
              <Plus size={16} /> Nuevo usuario
            </button>
          )}
        </div>
      </div>

      <div className="contenido gestion-vista">
        <div className="kpis-gestion">
          <TarjetaKpi
            tono="neutro"
            icono={<Users size={18} />}
            etiqueta="Total usuarios"
            valor={kpis ? kpis.total.toLocaleString("es-CO") : null}
            activa={kpiActivo === "total"}
            descripcion="Ver todo el equipo"
            onClick={() => aplicarKpi("total")}
          />
          <TarjetaKpi
            tono="verde"
            icono={<UserCheck size={18} />}
            etiqueta="Activos"
            valor={kpis ? kpis.activos.toLocaleString("es-CO") : null}
            pie={kpis && kpis.sinAccesoReciente > 0 ? `${kpis.sinAccesoReciente} sin entrar en 30 días` : undefined}
            activa={kpiActivo === "activos"}
            descripcion="Ver los usuarios que pueden entrar al panel"
            onClick={() => aplicarKpi("activos")}
          />
          <TarjetaKpi
            tono="azul"
            icono={<ShieldCheck size={18} />}
            etiqueta="Administradores"
            valor={kpis ? kpis.administradores.toLocaleString("es-CO") : null}
            pie="Acceso total al negocio"
            activa={kpiActivo === "administradores"}
            descripcion="Ver los usuarios con acceso total"
            onClick={() => aplicarKpi("administradores")}
          />
          <TarjetaKpi
            tono="violeta"
            icono={<Key size={18} />}
            etiqueta="Con permisos delegados"
            valor={kpis ? kpis.delegados.toLocaleString("es-CO") : null}
            activa={kpiActivo === "delegados"}
            descripcion="Ver los usuarios con permisos concedidos uno a uno"
            onClick={() => aplicarKpi("delegados")}
          />
          <TarjetaKpi
            tono="ambar"
            icono={<UserX size={18} />}
            etiqueta="Inactivos"
            valor={kpis ? kpis.inactivos.toLocaleString("es-CO") : null}
            activa={kpiActivo === "inactivos"}
            descripcion="Ver los usuarios sin acceso al panel"
            onClick={() => aplicarKpi("inactivos")}
          />
        </div>

        <section className="panel gestion-modulo" aria-label="Lista de usuarios">
          <div className="gestion-modulo-cab">
            <div className="gestion-tabs" role="tablist" aria-label="Segmento">
              {OPCIONES_SEGMENTO.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  role="tab"
                  aria-selected={segmento === o.valor}
                  className={segmento === o.valor ? "activo" : ""}
                  onClick={() => {
                    setSegmento(o.valor);
                    setKpiPulsado(null);
                  }}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>
            <p className="gestion-meta" aria-live="polite">
              {cargandoInicial ? (
                "Cargando…"
              ) : error ? null : (
                <>
                  <strong>{lista.length.toLocaleString("es-CO")}</strong> usuario{lista.length === 1 ? "" : "s"}
                  {hayFiltros && kpis ? ` de ${kpis.total.toLocaleString("es-CO")}` : ""}
                </>
              )}
            </p>
          </div>

          <div className="gestion-toolbar">
            <div className="buscador gestion-buscador">
              <Search size={16} />
              <input
                type="search"
                placeholder="Buscar por nombre o correo…"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setKpiPulsado(null);
                }}
                aria-label="Buscar usuarios"
              />
              {busqueda && (
                <button
                  type="button"
                  className="gestion-buscador-fin gestion-buscador-limpiar"
                  onClick={() => setBusqueda("")}
                  aria-label="Borrar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              className={`select-filtro ${rolFiltro ? "con-valor" : ""}`}
              value={rolFiltro}
              onChange={(e) => {
                setRolFiltro(e.target.value);
                setKpiPulsado(null);
              }}
              aria-label="Filtrar por rol"
            >
              <option value="">Rol: todos</option>
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
            {hayFiltros && (
              <button type="button" className="btn-limpiar" onClick={limpiarFiltros}>
                <X size={14} /> Limpiar filtros
              </button>
            )}
            <ColumnPickerButton
              estado={columnasEstado}
              etiquetas={ETIQUETAS_USUARIOS}
              onAlternar={alternarColumna}
              onRestablecer={restablecerColumnas}
            />
          </div>

          <div
            className={`tabla-scroll gestion-tabla-scroll ${actualizando ? "actualizando" : ""}`}
            aria-busy={cargando}
          >
            <table className={`gestion-tabla ${sinFilas ? "sin-filas" : ""}`}>
              <thead>
                <tr>
                  {columnasVisibles.map((clave) => (
                    <ThOrdenable
                      key={clave}
                      clave={clave}
                      etiqueta={ETIQUETAS_USUARIOS[clave]}
                      className={DEFS[clave].clase}
                      columnaActiva={columnaOrden}
                      direccion={direccionOrden}
                      onClick={ordenarPorColumna}
                      onMover={moverColumna}
                    />
                  ))}
                  <th className="col-acciones">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargandoInicial ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="fila-esqueleto">
                      <td colSpan={columnas}>
                        <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: `${72 - i * 6}%` }} />
                      </td>
                    </tr>
                  ))
                ) : sinFilas ? (
                  <tr className="fila-vacia">
                    <td colSpan={columnas}>{cuerpoVacio}</td>
                  </tr>
                ) : (
                  lista.map((u) => {
                    const acciones = accionesDe(u);
                    return (
                      <tr key={u.id} className={u.is_active ? "" : "usuario-fila-inactiva"}>
                        {columnasVisibles.map((clave) => (
                          <td key={clave} className={DEFS[clave].clase}>
                            {DEFS[clave].render(u)}
                          </td>
                        ))}
                        <td className="col-acciones">
                          <div className="acciones">
                            {puedeEditar(u) && (
                              <Tooltip label="Editar usuario">
                                <button
                                  type="button"
                                  className="btn-icon editar"
                                  onClick={() => {
                                    setEditando(u);
                                    setModalAbierto(true);
                                  }}
                                  aria-label={`Editar a ${u.nombre_usuario}`}
                                >
                                  <Pencil size={16} />
                                </button>
                              </Tooltip>
                            )}
                            {acciones.length > 0 && (
                              <MenuFila etiqueta={`Más acciones de ${u.nombre_usuario}`} acciones={acciones} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalAbierto && (
        <UserFormModal
          usuario={editando}
          puedeEditarRol={esOwner}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}

      {permisosDe && (
        <UserPermissionsModal
          usuario={permisosDe}
          onCerrar={() => setPermisosDe(null)}
          onGuardado={() => {
            setPermisosDe(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
