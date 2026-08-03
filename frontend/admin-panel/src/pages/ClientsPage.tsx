import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { eliminarCliente, obtenerClientes } from "../api/resources";
import type { Cliente } from "../types";
import { extraerMensajeError, formatoFecha, tienePermiso } from "../utils";
import { alertaError, confirmarEliminar } from "../utils/alertas";
import { Tooltip } from "../components/Tooltip";
import { ColumnPickerButton } from "../components/ColumnPickerButton";
import { ThOrdenable } from "../components/ThOrdenable";
import { useColumnas } from "../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../hooks/useOrdenTabla";
import { useAuth } from "../auth/AuthContext";
import { ClientFormModal } from "./clients/ClientFormModal";

type Segmento = "todos" | "con" | "sin";

const OPCIONES_SEGMENTO: { valor: Segmento; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "con", etiqueta: "Con pedidos" },
  { valor: "sin", etiqueta: "Sin pedidos" },
];

const DEFINICIONES_CLIENTES: Record<string, { etiqueta: string; render: (c: Cliente) => ReactNode }> = {
  nombre: { etiqueta: "Nombre", render: (c) => c.nombre_cliente },
  telefono: { etiqueta: "Teléfono", render: (c) => c.telefono_cliente || "—" },
  direccion: { etiqueta: "Dirección", render: (c) => c.direccion_cliente || "—" },
  pedidos: {
    etiqueta: "Pedidos",
    render: (c) => (
      <span className="pres-mas" style={{ display: "inline-flex", alignItems: "center", gap: ".3rem" }}>
        <ShoppingBag size={13} /> {c.total_pedidos}
      </span>
    ),
  },
  registro: { etiqueta: "Registro", render: (c) => formatoFecha(c.fecha_registro_cliente) },
};
const CLAVES_CLIENTES = Object.keys(DEFINICIONES_CLIENTES);
const ETIQUETAS_CLIENTES = Object.fromEntries(
  Object.entries(DEFINICIONES_CLIENTES).map(([clave, def]) => [clave, def.etiqueta])
);

const EXTRACTORES_CLIENTES: ExtractoresOrden<Cliente> = {
  nombre: (c) => c.nombre_cliente,
  telefono: (c) => c.telefono_cliente,
  direccion: (c) => c.direccion_cliente,
  pedidos: (c) => c.total_pedidos,
  registro: (c) => c.fecha_registro_cliente,
};

export function ClientsPage() {
  const { usuario: actual } = useAuth();
  const [searchParams] = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosClientes, setTodosClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState(() => searchParams.get("q") ?? "");
  const [segmento, setSegmento] = useState<Segmento>("todos");
  const [cargando, setCargando] = useState(true);
  const {
    estado: columnasEstado,
    visibles: columnasVisibles,
    alternar: alternarColumna,
    mover: moverColumna,
    restablecer: restablecerColumnas,
  } = useColumnas("clientes", CLAVES_CLIENTES);
  const { columna: columnaOrden, direccion: direccionOrden, alternarColumna: ordenarPorColumna, ordenar } =
    useOrdenTabla<Cliente>();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);

  function cargar() {
    setCargando(true);
    obtenerClientes(busqueda || undefined)
      .then(setClientes)
      .finally(() => setCargando(false));
  }

  function cargarResumen() {
    obtenerClientes().then(setTodosClientes);
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const clientesVista = useMemo(() => {
    if (segmento === "todos") return clientes;
    if (segmento === "con") return clientes.filter((c) => c.total_pedidos > 0);
    return clientes.filter((c) => c.total_pedidos === 0);
  }, [clientes, segmento]);

  const hayFiltrosActivos = busqueda !== "" || segmento !== "todos";

  const kpis = useMemo(() => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    const nuevosEsteMes = todosClientes.filter(
      (c) => new Date(c.fecha_registro_cliente) >= inicioMes
    ).length;
    const nuevosMesAnterior = todosClientes.filter((c) => {
      const f = new Date(c.fecha_registro_cliente);
      return f >= inicioMesAnterior && f < inicioMes;
    }).length;

    const crecimiento =
      nuevosMesAnterior > 0
        ? ((nuevosEsteMes - nuevosMesAnterior) / nuevosMesAnterior) * 100
        : nuevosEsteMes > 0
        ? 100
        : 0;

    return {
      total: todosClientes.length,
      nuevosEsteMes,
      crecimiento,
      conPedidos: todosClientes.filter((c) => c.total_pedidos > 0).length,
      sinPedidos: todosClientes.filter((c) => c.total_pedidos === 0).length,
    };
  }, [todosClientes]);

  function limpiarFiltros() {
    setBusqueda("");
    setSegmento("todos");
  }

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }
  function abrirEdicion(c: Cliente) {
    setEditando(c);
    setModalAbierto(true);
  }

  async function eliminar(c: Cliente) {
    if (!(await confirmarEliminar(`¿Eliminar al cliente "${c.nombre_cliente}"?`))) return;
    try {
      await eliminarCliente(c.id);
      cargar();
      cargarResumen();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el cliente."));
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Clientes</h1>
        <button className="btn primario" onClick={abrirNuevo}>
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      <div className="contenido">
        <div className="stats-grid">
          <div className="stat dark">
            <div className="stat-icono" style={{ background: "var(--gris-claro)", color: "var(--dark)" }}>
              <Users size={18} />
            </div>
            <div className="label">Total clientes</div>
            <div className="valor">{kpis.total}</div>
          </div>
          <div className="stat azul">
            <div className="stat-icono" style={{ background: "var(--azul-claro)", color: "var(--azul-texto)" }}>
              <UserPlus size={18} />
            </div>
            <div className="label">Nuevos este mes</div>
            <div className="valor">{kpis.nuevosEsteMes}</div>
            <div className="pie tendencia">
              {kpis.crecimiento >= 0 ? (
                <TrendingUp size={13} className="sube" />
              ) : (
                <TrendingDown size={13} className="baja" />
              )}
              <span className={kpis.crecimiento >= 0 ? "sube" : "baja"}>
                {kpis.crecimiento >= 0 ? "+" : ""}
                {kpis.crecimiento.toFixed(0)}%
              </span>
              vs mes anterior
            </div>
          </div>
          <div className="stat verde">
            <div className="stat-icono" style={{ background: "var(--verde-claro)", color: "var(--verde-texto)" }}>
              <UserCheck size={18} />
            </div>
            <div className="label">Con pedidos</div>
            <div className="valor">{kpis.conPedidos}</div>
          </div>
          <div className="stat amber">
            <div className="stat-icono" style={{ background: "var(--ambar-claro)", color: "var(--ambar-texto)" }}>
              <UserX size={18} />
            </div>
            <div className="label">Sin pedidos aún</div>
            <div className="valor">{kpis.sinPedidos}</div>
          </div>
        </div>

        <div className="panel">
          <div className="cabecera">
            <h2>Clientes ({clientesVista.length})</h2>
          </div>

          <div className="filtros-bar">
            <div className="buscador">
              <Search size={16} />
              <input
                placeholder="Buscar por nombre o teléfono…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="segmentado">
              {OPCIONES_SEGMENTO.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={segmento === o.valor ? "activo" : ""}
                  onClick={() => setSegmento(o.valor)}
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
              etiquetas={ETIQUETAS_CLIENTES}
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
                      etiqueta={ETIQUETAS_CLIENTES[clave]}
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
                ) : clientesVista.length === 0 ? (
                  <tr>
                    <td colSpan={1 + columnasVisibles.length} className="vacio">
                      Sin clientes que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  ordenar(clientesVista, EXTRACTORES_CLIENTES).map((c) => (
                    <tr key={c.id}>
                      {columnasVisibles.map((clave) => (
                        <td key={clave}>{DEFINICIONES_CLIENTES[clave].render(c)}</td>
                      ))}
                      <td>
                        <div className="acciones">
                          {tienePermiso(actual, "orders.change_cliente") && (
                            <Tooltip label="Editar cliente">
                              <button
                                type="button"
                                className="btn-icon editar"
                                onClick={() => abrirEdicion(c)}
                                aria-label="Editar cliente"
                              >
                                <Pencil size={16} />
                              </button>
                            </Tooltip>
                          )}
                          {tienePermiso(actual, "orders.delete_cliente") && (
                            <Tooltip label="Eliminar cliente">
                              <button
                                type="button"
                                className="btn-icon peligro"
                                onClick={() => eliminar(c)}
                                aria-label="Eliminar cliente"
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
        <ClientFormModal
          cliente={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
            cargarResumen();
          }}
        />
      )}
    </>
  );
}
