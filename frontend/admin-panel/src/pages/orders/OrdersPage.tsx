import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  Layers,
  Printer,
  Search,
  SquarePen,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  descargarPdfPedido,
  descargarPdfPedidosLote,
  eliminarPedido,
  entregarPedidos,
  obtenerLotes,
  obtenerPedidos,
} from "../../api/resources";
import type { DireccionOrden } from "../../hooks/useOrdenTabla";
import type { Lote, Pedido, Usuario } from "../../types";
import { extraerMensajeError, formatoFecha, formatoPrecio, tienePermiso } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { Tooltip } from "../../components/Tooltip";
import { ColumnPickerButton } from "../../components/ColumnPickerButton";
import { ThOrdenable } from "../../components/ThOrdenable";
import { useColumnas } from "../../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../../hooks/useOrdenTabla";
import { useAuth } from "../../auth/AuthContext";
import { OrderDetailModal } from "./OrderDetailModal";
import { LoteDetailModal } from "./LoteDetailModal";

const ESTADOS = ["", "PENDIENTE", "EDITADO", "CERRADO", "ENTREGADO", "IMPRESO"];

const DEFINICIONES_PEDIDOS: Record<string, { etiqueta: string; render: (p: Pedido) => ReactNode }> = {
  id: { etiqueta: "#", render: (p) => `#${p.id}` },
  cliente: { etiqueta: "Cliente", render: (p) => p.cliente_nombre || "—" },
  fecha: { etiqueta: "Fecha", render: (p) => formatoFecha(p.fecha_pedido) },
  items: { etiqueta: "Items", render: (p) => p.num_items },
  total: { etiqueta: "Total", render: (p) => formatoPrecio(p.total_pedido) },
  estado: { etiqueta: "Estado", render: (p) => <span className={`badge ${p.estado}`}>{p.estado}</span> },
};
const CLAVES_PEDIDOS = Object.keys(DEFINICIONES_PEDIDOS);
const ETIQUETAS_PEDIDOS = Object.fromEntries(
  Object.entries(DEFINICIONES_PEDIDOS).map(([clave, def]) => [clave, def.etiqueta])
);

const EXTRACTORES_PEDIDOS: ExtractoresOrden<Pedido> = {
  id: (p) => p.id,
  cliente: (p) => p.cliente_nombre,
  fecha: (p) => p.fecha_pedido,
  items: (p) => p.num_items,
  total: (p) => parseFloat(p.total_pedido),
  estado: (p) => p.estado,
};

type Vista = "pedidos" | "lotes";

function formatoISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface TablaPedidosProps {
  lista: Pedido[];
  cargando: boolean;
  mensajeVacio: string;
  columnasVisibles: string[];
  columnaOrden: string | null;
  direccionOrden: DireccionOrden;
  ordenarPorColumna: (clave: string) => void;
  moverColumna: (claveOrigen: string, claveDestino: string) => void;
  seleccion: Set<number>;
  toggle: (id: number) => void;
  onToggleTodos: (ids: number[]) => void;
  actual: Usuario | null;
  imprimiendoId: number | null;
  onVerEditar: (id: number) => void;
  onImprimir: (id: number) => void;
  onEliminar: (id: number) => void;
}

function TablaPedidos({
  lista,
  cargando,
  mensajeVacio,
  columnasVisibles,
  columnaOrden,
  direccionOrden,
  ordenarPorColumna,
  moverColumna,
  seleccion,
  toggle,
  onToggleTodos,
  actual,
  imprimiendoId,
  onVerEditar,
  onImprimir,
  onEliminar,
}: TablaPedidosProps) {
  const idsVisibles = lista.map((p) => p.id);
  const todosSeleccionados = idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.has(id));
  const algunoSeleccionado = idsVisibles.some((id) => seleccion.has(id));

  return (
    <div className="tabla-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={todosSeleccionados}
                ref={(el) => {
                  if (el) el.indeterminate = !todosSeleccionados && algunoSeleccionado;
                }}
                onChange={() => onToggleTodos(idsVisibles)}
                aria-label="Seleccionar todos los pedidos listados"
              />
            </th>
            {columnasVisibles.map((clave) => (
              <ThOrdenable
                key={clave}
                clave={clave}
                etiqueta={ETIQUETAS_PEDIDOS[clave]}
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
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={2 + columnasVisibles.length}>
                  <div
                    className="skeleton-line skeleton-shimmer en-celda"
                    style={{ width: `${72 - i * 6}%` }}
                  />
                </td>
              </tr>
            ))
          ) : lista.length === 0 ? (
            <tr>
              <td colSpan={2 + columnasVisibles.length} className="vacio">
                {mensajeVacio}
              </td>
            </tr>
          ) : (
            lista.map((p) => (
              <tr key={p.id}>
                <td>
                  <input type="checkbox" checked={seleccion.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                {columnasVisibles.map((clave) => (
                  <td key={clave}>{DEFINICIONES_PEDIDOS[clave].render(p)}</td>
                ))}
                <td>
                  <div className="acciones">
                    <Tooltip label="Ver / editar pedido">
                      <button
                        type="button"
                        className="btn-icon editar"
                        onClick={() => onVerEditar(p.id)}
                        aria-label="Ver / editar pedido"
                      >
                        <SquarePen size={16} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Imprimir factura">
                      <button
                        type="button"
                        className="btn-icon info"
                        disabled={imprimiendoId === p.id}
                        onClick={() => onImprimir(p.id)}
                        aria-label="Imprimir factura"
                      >
                        <Printer size={16} />
                      </button>
                    </Tooltip>
                    {tienePermiso(actual, "orders.delete_pedido") && (
                      <Tooltip label="Eliminar pedido">
                        <button
                          type="button"
                          className="btn-icon peligro"
                          onClick={() => onEliminar(p.id)}
                          aria-label="Eliminar pedido"
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
  );
}

export function OrdersPage() {
  const { usuario: actual } = useAuth();
  const [searchParams] = useSearchParams();
  const [pedidosHoy, setPedidosHoy] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [todosPedidos, setTodosPedidos] = useState<Pedido[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [busqueda, setBusqueda] = useState(() => searchParams.get("q") ?? "");
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const {
    estado: columnasEstado,
    visibles: columnasVisibles,
    alternar: alternarColumna,
    mover: moverColumna,
    restablecer: restablecerColumnas,
  } = useColumnas("pedidos", CLAVES_PEDIDOS);
  const { columna: columnaOrden, direccion: direccionOrden, alternarColumna: ordenarPorColumna, ordenar } =
    useOrdenTabla<Pedido>();
  const [vista, setVista] = useState<Vista>("pedidos");
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [loteAbiertoId, setLoteAbiertoId] = useState<number | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [imprimiendoLote, setImprimiendoLote] = useState(false);

  function cargar() {
    const hoy = formatoISO(new Date());
    setCargando(true);
    obtenerPedidos({
      search: busqueda || undefined,
      estado: estado || undefined,
      desde: hoy,
      hasta: hoy,
    })
      .then(setPedidosHoy)
      .finally(() => setCargando(false));
  }

  function cargarHistorial() {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const haceUnAnio = new Date();
    haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1);
    setCargandoHistorial(true);
    obtenerPedidos({
      search: busqueda || undefined,
      estado: estado || undefined,
      desde: formatoISO(haceUnAnio),
      hasta: formatoISO(ayer),
    })
      .then(setHistorial)
      .finally(() => setCargandoHistorial(false));
  }

  function cargarResumen() {
    obtenerPedidos({}).then(setTodosPedidos);
    obtenerLotes().then(setLotes);
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, estado]);

  useEffect(() => {
    if (!historialAbierto) return;
    const t = setTimeout(cargarHistorial, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historialAbierto, busqueda, estado]);

  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const entregadosHoy = todosPedidos.filter(
      (p) => p.estado === "ENTREGADO" && p.fecha_pedido.slice(0, 10) === hoy
    );
    return {
      total: todosPedidos.length,
      pendientes: todosPedidos.filter((p) => p.estado === "PENDIENTE").length,
      entregadosHoy: entregadosHoy.length,
      facturadoHoy: entregadosHoy.reduce(
        (acc, p) => acc + (parseFloat(p.total_pedido) || 0),
        0
      ),
      lotesGenerados: lotes.length,
    };
  }, [todosPedidos, lotes]);

  function toggle(id: number) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleTodos(ids: number[]) {
    setSeleccion((prev) => {
      const todosSeleccionados = ids.length > 0 && ids.every((id) => prev.has(id));
      const s = new Set(prev);
      ids.forEach((id) => (todosSeleccionados ? s.delete(id) : s.add(id)));
      return s;
    });
  }

  function recargarListados() {
    cargar();
    if (historialAbierto) cargarHistorial();
    cargarResumen();
  }

  async function entregarSeleccionados() {
    if (seleccion.size === 0) return;
    await entregarPedidos([...seleccion]);
    setSeleccion(new Set());
    recargarListados();
  }

  async function eliminar(id: number) {
    if (!(await confirmarEliminar(`¿Eliminar el pedido #${id}?`, "Esta acción no se puede deshacer.")))
      return;
    try {
      await eliminarPedido(id);
      recargarListados();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el pedido."));
    }
  }

  async function imprimir(id: number) {
    setImprimiendoId(id);
    try {
      await descargarPdfPedido(id);
    } finally {
      setImprimiendoId(null);
    }
  }

  async function imprimirSeleccionados() {
    if (seleccion.size === 0) return;
    setImprimiendoLote(true);
    try {
      await descargarPdfPedidosLote([...seleccion]);
      cargarResumen();
    } finally {
      setImprimiendoLote(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Pedidos</h1>
      </div>

      <div className="contenido">
        <div className="stats-grid">
          <div className="stat dark">
            <div className="stat-icono" style={{ background: "var(--gris-claro)", color: "var(--dark)" }}>
              <ClipboardList size={18} />
            </div>
            <div className="label">Total pedidos</div>
            <div className="valor">{kpis.total}</div>
          </div>
          <div className="stat amber">
            <div className="stat-icono" style={{ background: "var(--ambar-claro)", color: "var(--ambar-texto)" }}>
              <Clock size={18} />
            </div>
            <div className="label">Pendientes</div>
            <div className="valor">{kpis.pendientes}</div>
          </div>
          <div className="stat verde">
            <div className="stat-icono" style={{ background: "var(--verde-claro)", color: "var(--verde-texto)" }}>
              <CheckCircle2 size={18} />
            </div>
            <div className="label">Entregados hoy</div>
            <div className="valor">{kpis.entregadosHoy}</div>
          </div>
          <div className="stat azul">
            <div className="stat-icono" style={{ background: "var(--azul-claro)", color: "var(--azul-texto)" }}>
              <Wallet size={18} />
            </div>
            <div className="label">Facturado hoy</div>
            <div className="valor">{formatoPrecio(kpis.facturadoHoy)}</div>
          </div>
          <div className="stat morado">
            <div className="stat-icono" style={{ background: "var(--morado-claro)", color: "var(--morado-texto)" }}>
              <Layers size={18} />
            </div>
            <div className="label">Lotes generados</div>
            <div className="valor">{kpis.lotesGenerados}</div>
          </div>
        </div>

        <div className="panel">
          <div className="cabecera">
            <h2>{vista === "pedidos" ? "Pedidos" : `Lotes (${lotes.length})`}</h2>
            <div className="segmentado">
              <button
                type="button"
                className={vista === "pedidos" ? "activo" : ""}
                onClick={() => setVista("pedidos")}
              >
                Pedidos
              </button>
              <button
                type="button"
                className={vista === "lotes" ? "activo" : ""}
                onClick={() => setVista("lotes")}
              >
                Lotes
              </button>
            </div>
          </div>

          {vista === "pedidos" && (
            <div className="filtros-bar">
              <div className="buscador">
                <Search size={16} />
                <input
                  placeholder="Buscar por # o cliente…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <select
                className="select-filtro"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e || "Todos los estados"}
                  </option>
                ))}
              </select>
              <ColumnPickerButton
                estado={columnasEstado}
                etiquetas={ETIQUETAS_PEDIDOS}
                onAlternar={alternarColumna}
                onRestablecer={restablecerColumnas}
              />
            </div>
          )}

          {vista === "pedidos" && seleccion.size > 0 && (
            <div className="barra-seleccion">
              <span>
                <strong>{seleccion.size}</strong> pedido{seleccion.size === 1 ? "" : "s"} seleccionado
                {seleccion.size === 1 ? "" : "s"}
              </span>
              <div className="acciones">
                <button
                  className="btn secundario sm"
                  disabled={imprimiendoLote}
                  onClick={imprimirSeleccionados}
                >
                  {imprimiendoLote ? "Generando…" : "Imprimir"}
                </button>
                {tienePermiso(actual, "orders.change_pedido") && (
                  <button className="btn primario sm" onClick={entregarSeleccionados}>
                    Entregar
                  </button>
                )}
              </div>
            </div>
          )}

          {vista === "lotes" && (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Pedidos</th>
                    <th>Total</th>
                    <th>Generado por</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="vacio">
                        Aún no se han generado lotes de impresión o entrega.
                      </td>
                    </tr>
                  ) : (
                    lotes.map((l) => (
                      <tr key={l.id}>
                        <td>#{l.id}</td>
                        <td>
                          <span className={`badge ${l.tipo === "ENTREGA" ? "activo" : "EDITADO"}`}>
                            {l.tipo_display}
                          </span>
                        </td>
                        <td>{l.cantidad_pedidos}</td>
                        <td>{formatoPrecio(l.total_lote)}</td>
                        <td>{l.usuario_nombre}</td>
                        <td>{formatoFecha(l.fecha_creacion)}</td>
                        <td>
                          <Tooltip label="Ver pedidos del lote">
                            <button
                              type="button"
                              className="btn-icon editar"
                              onClick={() => setLoteAbiertoId(l.id)}
                              aria-label="Ver pedidos del lote"
                            >
                              <Eye size={16} />
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {vista === "pedidos" && (
          <>
            <div className="panel">
              <div className="cabecera">
                <h2>Pedidos de hoy ({pedidosHoy.length})</h2>
              </div>
              <TablaPedidos
                lista={ordenar(pedidosHoy, EXTRACTORES_PEDIDOS)}
                cargando={cargando}
                mensajeVacio="Sin pedidos hoy"
                columnasVisibles={columnasVisibles}
                columnaOrden={columnaOrden}
                direccionOrden={direccionOrden}
                ordenarPorColumna={ordenarPorColumna}
                moverColumna={moverColumna}
                seleccion={seleccion}
                toggle={toggle}
                onToggleTodos={toggleTodos}
                actual={actual}
                imprimiendoId={imprimiendoId}
                onVerEditar={setDetalleId}
                onImprimir={imprimir}
                onEliminar={eliminar}
              />
            </div>

            <div className="panel">
              <button
                type="button"
                className="cabecera cabecera-clicable"
                onClick={() => setHistorialAbierto((v) => !v)}
              >
                <h2>
                  Historial de pedidos
                  {historialAbierto && !cargandoHistorial ? ` (${historial.length})` : ""}
                </h2>
                <ChevronDown size={18} className={historialAbierto ? "chevron abierto" : "chevron"} />
              </button>
              {historialAbierto && (
                <TablaPedidos
                  lista={ordenar(historial, EXTRACTORES_PEDIDOS)}
                  cargando={cargandoHistorial}
                  mensajeVacio="Sin pedidos en el último año"
                  columnasVisibles={columnasVisibles}
                  columnaOrden={columnaOrden}
                  direccionOrden={direccionOrden}
                  ordenarPorColumna={ordenarPorColumna}
                  moverColumna={moverColumna}
                  seleccion={seleccion}
                  toggle={toggle}
                  onToggleTodos={toggleTodos}
                  actual={actual}
                  imprimiendoId={imprimiendoId}
                  onVerEditar={setDetalleId}
                  onImprimir={imprimir}
                  onEliminar={eliminar}
                />
              )}
            </div>
          </>
        )}
      </div>

      {detalleId !== null && (
        <OrderDetailModal
          pedidoId={detalleId}
          soloLectura={!tienePermiso(actual, "orders.change_pedido")}
          onCerrar={() => setDetalleId(null)}
          onGuardado={() => {
            setDetalleId(null);
            recargarListados();
          }}
        />
      )}

      {loteAbiertoId !== null && (
        <LoteDetailModal
          loteId={loteAbiertoId}
          onCerrar={() => setLoteAbiertoId(null)}
          onVerPedido={(id) => {
            setLoteAbiertoId(null);
            setDetalleId(id);
          }}
        />
      )}
    </>
  );
}
