import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Key,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { eliminarUsuario, obtenerUsuarios } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import type { Usuario } from "../types";
import { extraerMensajeError, formatoFecha, tienePermiso } from "../utils";
import { alertaAdvertencia, alertaError, confirmarEliminar } from "../utils/alertas";
import { Tooltip } from "../components/Tooltip";
import { ColumnPickerButton } from "../components/ColumnPickerButton";
import { ThOrdenable } from "../components/ThOrdenable";
import { useColumnas } from "../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../hooks/useOrdenTabla";
import { UserFormModal } from "./users/UserFormModal";
import { UserPermissionsModal } from "./users/UserPermissionsModal";

const ROLES = ["ANALISTA", "ADMIN", "GERENTE"];
type EstadoFiltro = "todos" | "activos" | "inactivos";

const OPCIONES_ESTADO: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
];

const DEFINICIONES_USUARIOS: Record<string, { etiqueta: string; render: (u: Usuario) => ReactNode }> = {
  nombre: {
    etiqueta: "Nombre",
    render: (u) => (
      <>
        {u.nombre_usuario}
        {u.es_administrador && (
          <span className="badge activo" style={{ marginLeft: ".5rem" }}>
            Admin
          </span>
        )}
      </>
    ),
  },
  correo: { etiqueta: "Correo", render: (u) => u.email_usuario },
  rol: { etiqueta: "Rol", render: (u) => u.rol_usuario },
  estado: {
    etiqueta: "Estado",
    render: (u) => (
      <span className={`badge ${u.is_active ? "activo" : "inactivo"}`}>
        {u.is_active ? "Activo" : "Inactivo"}
      </span>
    ),
  },
  ultimo_acceso: { etiqueta: "Último acceso", render: (u) => formatoFecha(u.ultimo_login_exitoso) },
};
const CLAVES_USUARIOS = Object.keys(DEFINICIONES_USUARIOS);
const ETIQUETAS_USUARIOS = Object.fromEntries(
  Object.entries(DEFINICIONES_USUARIOS).map(([clave, def]) => [clave, def.etiqueta])
);

const EXTRACTORES_USUARIOS: ExtractoresOrden<Usuario> = {
  nombre: (u) => u.nombre_usuario,
  correo: (u) => u.email_usuario,
  rol: (u) => u.rol_usuario,
  estado: (u) => (u.is_active ? 1 : 0),
  ultimo_acceso: (u) => u.ultimo_login_exitoso,
};

export function UsersPage() {
  const { usuario: actual, negocioActivo } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [rolFiltro, setRolFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
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

  function cargar() {
    setCargando(true);
    obtenerUsuarios()
      .then(setUsuarios)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  const esOwner = actual?.es_administrador ?? false;

  const usuariosVista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      const coincideTexto =
        !q ||
        u.nombre_usuario.toLowerCase().includes(q) ||
        u.email_usuario.toLowerCase().includes(q);
      const coincideRol = !rolFiltro || u.rol_usuario === rolFiltro;
      const coincideEstado =
        estadoFiltro === "todos" ||
        (estadoFiltro === "activos" ? u.is_active : !u.is_active);
      return coincideTexto && coincideRol && coincideEstado;
    });
  }, [usuarios, busqueda, rolFiltro, estadoFiltro]);

  const hayFiltrosActivos = busqueda !== "" || rolFiltro !== "" || estadoFiltro !== "todos";

  const kpis = useMemo(
    () => ({
      total: usuarios.length,
      activos: usuarios.filter((u) => u.is_active).length,
      administradores: usuarios.filter((u) => u.es_administrador).length,
      conPermisos: usuarios.filter((u) => !u.es_administrador && u.permisos.length > 0)
        .length,
    }),
    [usuarios]
  );

  function limpiarFiltros() {
    setBusqueda("");
    setRolFiltro("");
    setEstadoFiltro("todos");
  }

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }
  function abrirEdicion(u: Usuario) {
    setEditando(u);
    setModalAbierto(true);
  }

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

  async function eliminar(u: Usuario) {
    if (u.id === actual?.id) {
      alertaAdvertencia("No puedes eliminar tu propia cuenta.");
      return;
    }
    if (!(await confirmarEliminar(`¿Eliminar al usuario "${u.nombre_usuario}"?`))) return;
    try {
      await eliminarUsuario(u.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el usuario."));
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Usuarios</h1>
        {(!actual || tienePermiso(actual, "accounts.add_usuario")) && (
          <button className="btn primario" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      <div className="contenido">
        <div className="stats-grid">
          <div className="stat dark">
            <div className="stat-icono" style={{ background: "var(--gris-claro)", color: "var(--dark)" }}>
              <Users size={18} />
            </div>
            <div className="label">Total usuarios</div>
            <div className="valor">{kpis.total}</div>
          </div>
          <div className="stat verde">
            <div className="stat-icono" style={{ background: "var(--verde-claro)", color: "var(--verde-texto)" }}>
              <UserCheck size={18} />
            </div>
            <div className="label">Activos</div>
            <div className="valor">{kpis.activos}</div>
          </div>
          <div className="stat azul">
            <div className="stat-icono" style={{ background: "var(--azul-claro)", color: "var(--azul-texto)" }}>
              <ShieldCheck size={18} />
            </div>
            <div className="label">Administradores</div>
            <div className="valor">{kpis.administradores}</div>
            <div className="pie">Gerentes y superusuarios</div>
          </div>
          <div className="stat morado">
            <div className="stat-icono" style={{ background: "var(--morado-claro)", color: "var(--morado-texto)" }}>
              <Key size={18} />
            </div>
            <div className="label">Con permisos delegados</div>
            <div className="valor">{kpis.conPermisos}</div>
          </div>
        </div>

        <div className="panel">
          <div className="cabecera">
            <h2>
              Equipo de {negocioActivo?.nombre ?? "tu negocio"} (
              {usuariosVista.length})
            </h2>
          </div>

          <div className="filtros-bar">
            <div className="buscador">
              <Search size={16} />
              <input
                placeholder="Buscar por nombre o correo…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <select
              className="select-filtro"
              value={rolFiltro}
              onChange={(e) => setRolFiltro(e.target.value)}
            >
              <option value="">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="segmentado">
              {OPCIONES_ESTADO.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={estadoFiltro === o.valor ? "activo" : ""}
                  onClick={() => setEstadoFiltro(o.valor)}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>

            {hayFiltrosActivos && (
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

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  {columnasVisibles.map((clave) => (
                    <ThOrdenable
                      key={clave}
                      clave={clave}
                      etiqueta={ETIQUETAS_USUARIOS[clave]}
                      columnaActiva={columnaOrden}
                      direccion={direccionOrden}
                      onClick={ordenarPorColumna}
                      onMover={moverColumna}
                    />
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={1 + columnasVisibles.length}>
                        <div
                          className="skeleton-line skeleton-shimmer en-celda"
                          style={{ width: `${72 - i * 6}%` }}
                        />
                      </td>
                    </tr>
                  ))
                ) : usuariosVista.length === 0 ? (
                  <tr>
                    <td colSpan={1 + columnasVisibles.length} className="vacio">
                      Sin usuarios que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  ordenar(usuariosVista, EXTRACTORES_USUARIOS).map((u) => (
                    <tr key={u.id}>
                      {columnasVisibles.map((clave) => (
                        <td key={clave}>{DEFINICIONES_USUARIOS[clave].render(u)}</td>
                      ))}
                      <td>
                        <div className="acciones">
                          {puedeEditar(u) && (
                            <Tooltip label="Editar usuario">
                              <button
                                type="button"
                                className="btn-icon editar"
                                onClick={() => abrirEdicion(u)}
                                aria-label="Editar usuario"
                              >
                                <Pencil size={16} />
                              </button>
                            </Tooltip>
                          )}
                          {puedeGestionarPermisos(u) && (
                            <Tooltip label="Gestionar permisos">
                              <button
                                type="button"
                                className="btn-icon info"
                                onClick={() => setPermisosDe(u)}
                                aria-label="Gestionar permisos"
                              >
                                <ShieldCheck size={16} />
                              </button>
                            </Tooltip>
                          )}
                          {puedeEliminar(u) && (
                            <Tooltip label="Eliminar usuario">
                              <button
                                type="button"
                                className="btn-icon peligro"
                                onClick={() => eliminar(u)}
                                aria-label="Eliminar usuario"
                              >
                                <Trash2 size={16} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
