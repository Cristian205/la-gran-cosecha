import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  History,
  Layers,
  Loader2,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  SearchX,
  SquarePen,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import {
  contarLotes,
  contarPedidos,
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
import {
  EstadoVacio,
  MenuFila,
  Pastilla,
  TarjetaKpi,
  type AccionMenu,
} from "../../components/gestion/Gestion";
import { fechaCorta, fechaLocalISO, hoyISO } from "../../utils/fechas";
import {
  ETIQUETAS_ESTADO,
  EstadoPedido,
  OPCIONES_PERIODO,
  etiquetaPeriodo,
  rangoDelPeriodo,
  type Periodo,
} from "./pedidosUi";
import "./pedidos.css";

/** Lo que devuelve `obtenerPedidos` como máximo (su `page_size`). */
const TOPE_LISTA = 100;

/** Columnas configurables. Las claves no cambian: `useColumnas` guarda en el
 *  navegador cuáles están visibles y en qué orden. */
const DEFINICIONES_PEDIDOS: Record<
  string,
  { etiqueta: string; clase?: string; render: (p: Pedido) => ReactNode }
> = {
  id: { etiqueta: "Pedido", render: (p) => <span className="celda-id">#{p.id}</span> },
  cliente: {
    etiqueta: "Cliente",
    render: (p) =>
      p.cliente_nombre ? (
        <span className="celda-nombre" title={p.cliente_nombre}>
          {p.cliente_nombre}
        </span>
      ) : (
        <span className="celda-tenue">Sin cliente</span>
      ),
  },
  fecha: {
    etiqueta: "Fecha",
    render: (p) => (
      <time className="celda-fecha" dateTime={p.fecha_pedido} title={formatoFecha(p.fecha_pedido)}>
        {fechaCorta(p.fecha_pedido)}
      </time>
    ),
  },
  // `num_items` cuenta LÍNEAS del pedido (productos distintos), no unidades.
  items: {
    etiqueta: "Productos",
    render: (p) => (
      <span className="celda-tenue">
        {p.num_items} producto{p.num_items === 1 ? "" : "s"}
      </span>
    ),
  },
  total: {
    etiqueta: "Total",
    clase: "num",
    render: (p) => <span className="celda-cifra">{formatoPrecio(p.total_pedido)}</span>,
  },
  estado: { etiqueta: "Estado", render: (p) => <EstadoPedido estado={p.estado} /> },
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
type ClaveKpi = "total" | "pendientes" | "entregados" | "facturado" | "lotes";

interface Kpis {
  total: number;
  pendientes: number;
  entregadosHoy: number;
  facturadoHoy: number;
  lotes: number;
}

// ---------- Tabla ----------

interface TablaPedidosProps {
  lista: Pedido[];
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  vacio: ReactNode;
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
  entregandoId: number | null;
  onVerEditar: (id: number) => void;
  onImprimir: (id: number) => void;
  onEntregar: (id: number) => void;
  onEliminar: (id: number) => void;
}

function TablaPedidos({
  lista,
  cargando,
  error,
  onReintentar,
  vacio,
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
  entregandoId,
  onVerEditar,
  onImprimir,
  onEntregar,
  onEliminar,
}: TablaPedidosProps) {
  const idsVisibles = lista.map((p) => p.id);
  const todosSeleccionados = idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.has(id));
  const algunoSeleccionado = idsVisibles.some((id) => seleccion.has(id));
  const columnas = 2 + columnasVisibles.length;
  // Sin filas, la tabla no impone su ancho mínimo: el aviso queda centrado
  // en pantalla y no en un carril de 760px que en móvil se sale de la vista.
  const sinFilas = !cargando && (Boolean(error) || lista.length === 0);
  const puedeEntregar = tienePermiso(actual, "orders.change_pedido");
  const puedeEliminar = tienePermiso(actual, "orders.delete_pedido");

  function accionesDe(p: Pedido): AccionMenu[] {
    const acciones: AccionMenu[] = [];
    if (puedeEntregar && p.estado !== "ENTREGADO") {
      acciones.push({
        clave: "entregar",
        etiqueta: "Marcar como entregado",
        icono: <PackageCheck size={15} />,
        deshabilitada: entregandoId === p.id,
        onSeleccionar: () => onEntregar(p.id),
      });
    }
    if (puedeEliminar) {
      acciones.push({
        clave: "eliminar",
        etiqueta: "Eliminar pedido",
        icono: <Trash2 size={15} />,
        peligro: true,
        onSeleccionar: () => onEliminar(p.id),
      });
    }
    return acciones;
  }

  return (
    <div
      className={`tabla-scroll gestion-tabla-scroll ${cargando && lista.length > 0 ? "actualizando" : ""}`}
      aria-busy={cargando}
    >
      <table className={`gestion-tabla ${sinFilas ? "sin-filas" : ""}`}>
        <thead>
          <tr>
            <th className="col-check">
              <label className="check-area">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  disabled={cargando || lista.length === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = !todosSeleccionados && algunoSeleccionado;
                  }}
                  onChange={() => onToggleTodos(idsVisibles)}
                  aria-label="Seleccionar todos los pedidos listados"
                />
              </label>
            </th>
            {columnasVisibles.map((clave) => (
              <ThOrdenable
                key={clave}
                clave={clave}
                etiqueta={ETIQUETAS_PEDIDOS[clave]}
                className={DEFINICIONES_PEDIDOS[clave].clase}
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
          {cargando && lista.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="fila-esqueleto">
                <td colSpan={columnas}>
                  <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: `${72 - i * 8}%` }} />
                </td>
              </tr>
            ))
          ) : error ? (
            <tr className="fila-vacia">
              <td colSpan={columnas}>
                <EstadoVacio
                  icono={<TriangleAlert size={20} />}
                  titulo="No se pudieron cargar los pedidos"
                  texto={error}
                  accion={
                    <button type="button" className="btn secundario sm" onClick={onReintentar}>
                      <RefreshCw size={14} /> Reintentar
                    </button>
                  }
                />
              </td>
            </tr>
          ) : lista.length === 0 ? (
            <tr className="fila-vacia">
              <td colSpan={columnas}>{vacio}</td>
            </tr>
          ) : (
            lista.map((p) => {
              const marcado = seleccion.has(p.id);
              const acciones = accionesDe(p);
              return (
                <tr key={p.id} className={marcado ? "seleccionada" : ""}>
                  <td className="col-check">
                    <label className="check-area">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggle(p.id)}
                        aria-label={`Seleccionar pedido #${p.id}`}
                      />
                    </label>
                  </td>
                  {columnasVisibles.map((clave) => (
                    <td key={clave} className={DEFINICIONES_PEDIDOS[clave].clase}>
                      {DEFINICIONES_PEDIDOS[clave].render(p)}
                    </td>
                  ))}
                  <td className="col-acciones">
                    <div className="acciones">
                      <Tooltip label="Ver / editar pedido">
                        <button
                          type="button"
                          className="btn-icon editar"
                          onClick={() => onVerEditar(p.id)}
                          aria-label={`Ver o editar el pedido #${p.id}`}
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
                          aria-label={`Imprimir la factura del pedido #${p.id}`}
                        >
                          {imprimiendoId === p.id ? <Loader2 size={16} className="girando" /> : <Printer size={16} />}
                        </button>
                      </Tooltip>
                      {acciones.length > 0 && (
                        <MenuFila etiqueta={`Más acciones del pedido #${p.id}`} acciones={acciones} />
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
  );
}

// ---------- Página ----------

export function OrdersPage() {
  const { usuario: actual } = useAuth();
  const [searchParams] = useSearchParams();
  const qInicial = searchParams.get("q") ?? "";

  // Filtros. Si se llega buscando (desde la paleta de comandos), se busca en
  // todas las fechas: el pedido que se busca rara vez es de hoy.
  const [busqueda, setBusqueda] = useState(qInicial);
  const [estado, setEstado] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>(qInicial ? "todas" : "hoy");
  const [rangoDesde, setRangoDesde] = useState(hoyISO);
  const [rangoHasta, setRangoHasta] = useState(hoyISO);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [recargaHistorial, setRecargaHistorial] = useState(0);
  const historialRef = useRef<HTMLDivElement>(null);

  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [errorLotes, setErrorLotes] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [kpiPulsado, setKpiPulsado] = useState<ClaveKpi | null>(null);

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
  const [entregandoId, setEntregandoId] = useState<number | null>(null);
  const [entregandoLote, setEntregandoLote] = useState(false);

  // Cada pedido que se ha visto, para saber el estado de los seleccionados
  // aunque un filtro los haya sacado de la lista.
  const conocidos = useRef(new Map<number, Pedido>());
  function recordar(lista: Pedido[]) {
    lista.forEach((p) => conocidos.current.set(p.id, p));
  }

  // Respuestas fuera de orden: solo cuenta la última petición de cada lista.
  const turnoLista = useRef(0);
  const turnoHistorial = useRef(0);

  const rango = rangoDelPeriodo(periodo, rangoDesde, rangoHasta);
  const historialDisponible = periodo === "hoy";

  // Lista principal
  useEffect(() => {
    const turno = ++turnoLista.current;
    setCargando(true);
    const t = setTimeout(() => {
      obtenerPedidos({ search: busqueda || undefined, estado: estado || undefined, ...rango })
        .then((lista) => {
          if (turno !== turnoLista.current) return;
          recordar(lista);
          setPedidos(lista);
          setError(null);
        })
        .catch((err) => {
          if (turno !== turnoLista.current) return;
          setError(extraerMensajeError(err, "Revisa tu conexión e inténtalo de nuevo."));
        })
        .finally(() => {
          if (turno === turnoLista.current) setCargando(false);
        });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, estado, rango.desde, rango.hasta, recarga]);

  // Historial: lo anterior a hoy, en el último año. Solo se pide abierto.
  useEffect(() => {
    if (!historialAbierto || !historialDisponible) return;
    const turno = ++turnoHistorial.current;
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const haceUnAnio = new Date(hoy);
    haceUnAnio.setFullYear(hoy.getFullYear() - 1);
    setCargandoHistorial(true);
    const t = setTimeout(() => {
      obtenerPedidos({
        search: busqueda || undefined,
        estado: estado || undefined,
        desde: fechaLocalISO(haceUnAnio),
        hasta: fechaLocalISO(ayer),
      })
        .then((lista) => {
          if (turno !== turnoHistorial.current) return;
          recordar(lista);
          setHistorial(lista);
          setErrorHistorial(null);
        })
        .catch((err) => {
          if (turno !== turnoHistorial.current) return;
          setErrorHistorial(extraerMensajeError(err, "Revisa tu conexión e inténtalo de nuevo."));
        })
        .finally(() => {
          if (turno === turnoHistorial.current) setCargandoHistorial(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [historialAbierto, historialDisponible, busqueda, estado, recargaHistorial]);

  // Indicadores: conteos exactos del servidor, no de una lista recortada.
  function cargarKpis() {
    const hoy = hoyISO();
    Promise.all([
      contarPedidos(),
      contarPedidos({ estado: "PENDIENTE" }),
      obtenerPedidos({ estado: "ENTREGADO", desde: hoy, hasta: hoy }),
      contarLotes(),
    ])
      .then(([total, pendientes, entregadosHoy, numLotes]) =>
        setKpis({
          total,
          pendientes,
          entregadosHoy: entregadosHoy.length,
          facturadoHoy: entregadosHoy.reduce((acc, p) => acc + (parseFloat(p.total_pedido) || 0), 0),
          lotes: numLotes,
        })
      )
      .catch(() => undefined);
  }

  function cargarLotes() {
    obtenerLotes()
      .then((l) => {
        setLotes(l);
        setErrorLotes(null);
      })
      .catch((err) => setErrorLotes(extraerMensajeError(err, "Revisa tu conexión e inténtalo de nuevo.")));
  }

  useEffect(() => {
    cargarKpis();
  }, []);

  // Los lotes se piden la primera vez que se abre su pestaña.
  useEffect(() => {
    if (vista === "lotes" && lotes === null) cargarLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  function recargarListados() {
    setRecarga((n) => n + 1);
    if (historialAbierto) setRecargaHistorial((n) => n + 1);
    cargarKpis();
    if (lotes !== null) cargarLotes();
  }

  // ---------- Filtros ----------

  const hayFiltros = Boolean(busqueda || estado || periodo !== "hoy");

  function limpiarFiltros() {
    setBusqueda("");
    setEstado("");
    setPeriodo("hoy");
    setKpiPulsado(null);
  }

  const coincideKpi: Record<ClaveKpi, boolean> = {
    total: vista === "pedidos" && !busqueda && !estado && periodo === "todas",
    pendientes: vista === "pedidos" && !busqueda && estado === "PENDIENTE" && periodo === "todas",
    entregados: vista === "pedidos" && !busqueda && estado === "ENTREGADO" && periodo === "hoy",
    facturado: vista === "pedidos" && !busqueda && estado === "ENTREGADO" && periodo === "hoy",
    lotes: vista === "lotes",
  };
  // "Entregados hoy" y "Facturado hoy" muestran los mismos pedidos: se marca
  // la que se pulsó, no las dos.
  const kpiActivo: ClaveKpi | null =
    vista === "lotes" ? "lotes" : kpiPulsado && coincideKpi[kpiPulsado] ? kpiPulsado : null;

  function aplicarKpi(clave: ClaveKpi) {
    if (kpiActivo === clave) {
      // Pulsar la tarjeta activa la suelta: vuelve a la vista del día.
      setVista("pedidos");
      limpiarFiltros();
      return;
    }
    setKpiPulsado(clave);
    if (clave === "lotes") {
      setVista("lotes");
      return;
    }
    setVista("pedidos");
    setBusqueda("");
    if (clave === "total") {
      setEstado("");
      setPeriodo("todas");
    } else if (clave === "pendientes") {
      setEstado("PENDIENTE");
      setPeriodo("todas");
    } else {
      setEstado("ENTREGADO");
      setPeriodo("hoy");
    }
  }

  // ---------- Selección ----------

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

  // Entregar un pedido ya entregado no es una acción válida: se envían solo
  // los que faltan, y si no falta ninguno el botón no se ofrece.
  const entregables = [...seleccion].filter((id) => conocidos.current.get(id)?.estado !== "ENTREGADO");

  // La barra se oculta con una transición; mientras se va, conserva la última
  // cifra en vez de pasar a "0 pedidos".
  const ultimaCantidad = useRef(0);
  if (seleccion.size > 0) ultimaCantidad.current = seleccion.size;
  const cantidadBarra = seleccion.size || ultimaCantidad.current;
  const barraVisible = vista === "pedidos" && seleccion.size > 0;
  const barraRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (barraRef.current) barraRef.current.inert = !barraVisible;
  }, [barraVisible]);

  // ---------- Acciones ----------

  async function entregar(ids: number[]) {
    await entregarPedidos(ids);
    setSeleccion((prev) => {
      const s = new Set(prev);
      ids.forEach((id) => s.delete(id));
      return s;
    });
    recargarListados();
  }

  async function entregarSeleccionados() {
    if (entregables.length === 0) return;
    setEntregandoLote(true);
    try {
      await entregar(entregables);
      setSeleccion(new Set());
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudieron entregar los pedidos seleccionados."));
    } finally {
      setEntregandoLote(false);
    }
  }

  async function entregarUno(id: number) {
    setEntregandoId(id);
    try {
      await entregar([id]);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo marcar el pedido como entregado."));
    } finally {
      setEntregandoId(null);
    }
  }

  async function eliminar(id: number) {
    if (!(await confirmarEliminar(`¿Eliminar el pedido #${id}?`, "Esta acción no se puede deshacer.")))
      return;
    try {
      await eliminarPedido(id);
      setSeleccion((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      recargarListados();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el pedido."));
    }
  }

  async function imprimir(id: number) {
    setImprimiendoId(id);
    try {
      await descargarPdfPedido(id);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo generar la factura del pedido."));
    } finally {
      setImprimiendoId(null);
    }
  }

  async function imprimirSeleccionados() {
    if (seleccion.size === 0) return;
    setImprimiendoLote(true);
    try {
      await descargarPdfPedidosLote([...seleccion]);
      // Imprimir varios genera un lote de impresión.
      cargarKpis();
      if (lotes !== null) cargarLotes();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudieron generar las facturas seleccionadas."));
    } finally {
      setImprimiendoLote(false);
    }
  }

  function verHistorial() {
    setHistorialAbierto(true);
    requestAnimationFrame(() =>
      historialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  // ---------- Render ----------

  const listaOrdenada = useMemo(
    () => ordenar(pedidos, EXTRACTORES_PEDIDOS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pedidos, columnaOrden, direccionOrden]
  );
  const nombrePeriodo = etiquetaPeriodo(periodo, rangoDesde, rangoHasta);
  const puedeEntregar = tienePermiso(actual, "orders.change_pedido");
  const actualizando = cargando || (historialAbierto && cargandoHistorial);

  const vacioPrincipal =
    busqueda || estado ? (
      <EstadoVacio
        icono={<SearchX size={20} />}
        titulo="Ningún pedido coincide con los filtros"
        texto={`No hay resultados para ${nombrePeriodo.toLowerCase()} con esta búsqueda o estado.`}
        accion={
          <button type="button" className="btn secundario sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        }
      />
    ) : periodo === "hoy" ? (
      <EstadoVacio
        icono={<ClipboardList size={20} />}
        titulo="No hay pedidos hoy"
        texto="Los pedidos registrados durante el día aparecerán aquí."
        accion={
          <button type="button" className="btn secundario sm" onClick={verHistorial}>
            <History size={14} /> Ver historial
          </button>
        }
      />
    ) : (
      <EstadoVacio
        icono={<ClipboardList size={20} />}
        titulo="No hay pedidos en este periodo"
        texto={`No se registraron pedidos: ${nombrePeriodo.toLowerCase()}.`}
        accion={
          <button type="button" className="btn secundario sm" onClick={() => setPeriodo("todas")}>
            Ver todas las fechas
          </button>
        }
      />
    );

  const propsTabla = {
    columnasVisibles,
    columnaOrden,
    direccionOrden,
    ordenarPorColumna,
    moverColumna,
    seleccion,
    toggle,
    onToggleTodos: toggleTodos,
    actual,
    imprimiendoId,
    entregandoId,
    onVerEditar: setDetalleId,
    onImprimir: imprimir,
    onEntregar: entregarUno,
    onEliminar: eliminar,
  };

  return (
    <>
      <div className="topbar gestion-topbar">
        <div className="gestion-titulo">
          <h1>Pedidos</h1>
          <p>Gestiona pedidos, entregas y facturación desde un solo lugar</p>
        </div>
        <button
          type="button"
          className="btn secundario sm gestion-actualizar"
          onClick={recargarListados}
          disabled={actualizando}
        >
          <RefreshCw size={14} className={actualizando ? "girando" : ""} />
          Actualizar
        </button>
      </div>

      <div className="contenido gestion-vista">
        <div className="kpis-gestion">
          <TarjetaKpi
            tono="neutro"
            icono={<ClipboardList size={18} />}
            etiqueta="Total pedidos"
            valor={kpis ? kpis.total.toLocaleString("es-CO") : null}
            activa={kpiActivo === "total"}
            descripcion="Ver todos los pedidos"
            onClick={() => aplicarKpi("total")}
          />
          <TarjetaKpi
            tono="ambar"
            icono={<Clock size={18} />}
            etiqueta="Pendientes"
            valor={kpis ? kpis.pendientes.toLocaleString("es-CO") : null}
            activa={kpiActivo === "pendientes"}
            descripcion="Ver los pedidos pendientes"
            onClick={() => aplicarKpi("pendientes")}
          />
          <TarjetaKpi
            tono="verde"
            icono={<CheckCircle2 size={18} />}
            etiqueta="Entregados hoy"
            valor={kpis ? kpis.entregadosHoy.toLocaleString("es-CO") : null}
            activa={kpiActivo === "entregados"}
            descripcion="Ver los pedidos de hoy ya entregados"
            onClick={() => aplicarKpi("entregados")}
          />
          <TarjetaKpi
            tono="azul"
            icono={<Wallet size={18} />}
            etiqueta="Facturado hoy"
            valor={kpis ? formatoPrecio(kpis.facturadoHoy) : null}
            activa={kpiActivo === "facturado"}
            descripcion="Ver los pedidos entregados hoy que suman este valor"
            onClick={() => aplicarKpi("facturado")}
          />
          <TarjetaKpi
            tono="violeta"
            icono={<Layers size={18} />}
            etiqueta="Lotes generados"
            valor={kpis ? kpis.lotes.toLocaleString("es-CO") : null}
            activa={kpiActivo === "lotes"}
            descripcion="Ver los lotes de impresión y entrega"
            onClick={() => aplicarKpi("lotes")}
          />
        </div>

        <section className="panel gestion-modulo" aria-label="Pedidos y lotes">
          <div className="gestion-modulo-cab">
            <div className="gestion-tabs" role="tablist" aria-label="Vista">
              <button
                type="button"
                role="tab"
                aria-selected={vista === "pedidos"}
                className={vista === "pedidos" ? "activo" : ""}
                onClick={() => setVista("pedidos")}
              >
                <ClipboardList size={15} /> Pedidos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vista === "lotes"}
                className={vista === "lotes" ? "activo" : ""}
                onClick={() => setVista("lotes")}
              >
                <Layers size={15} /> Lotes
                {kpis && <span className="gestion-tab-num">{kpis.lotes}</span>}
              </button>
            </div>
            {vista === "pedidos" && (
              <p className="gestion-meta" aria-live="polite">
                {cargando ? (
                  "Cargando…"
                ) : error ? null : (
                  <>
                    <strong>{pedidos.length >= TOPE_LISTA ? `${TOPE_LISTA}+` : pedidos.length}</strong>{" "}
                    pedido{pedidos.length === 1 ? "" : "s"} · {nombrePeriodo}
                  </>
                )}
              </p>
            )}
          </div>

          {vista === "pedidos" && (
            <>
              <div className="gestion-toolbar">
                <div className="buscador gestion-buscador">
                  <Search size={16} />
                  <input
                    type="search"
                    placeholder="Buscar por número de pedido o cliente…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    aria-label="Buscar pedidos"
                  />
                  {cargando && busqueda ? (
                    <Loader2 size={15} className="gestion-buscador-fin girando" aria-hidden="true" />
                  ) : (
                    busqueda && (
                      <button
                        type="button"
                        className="gestion-buscador-fin gestion-buscador-limpiar"
                        onClick={() => setBusqueda("")}
                        aria-label="Borrar búsqueda"
                      >
                        <X size={14} />
                      </button>
                    )
                  )}
                </div>
                <select
                  className={`select-filtro ${estado ? "con-valor" : ""}`}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  aria-label="Filtrar por estado"
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
                <select
                  className={`select-filtro ${periodo !== "hoy" ? "con-valor" : ""}`}
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as Periodo)}
                  aria-label="Filtrar por fecha"
                >
                  {OPCIONES_PERIODO.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
                {periodo === "rango" && (
                  <div className="gestion-rango">
                    <input
                      type="date"
                      value={rangoDesde}
                      max={rangoHasta || undefined}
                      onChange={(e) => setRangoDesde(e.target.value)}
                      aria-label="Desde"
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      type="date"
                      value={rangoHasta}
                      min={rangoDesde || undefined}
                      onChange={(e) => setRangoHasta(e.target.value)}
                      aria-label="Hasta"
                    />
                  </div>
                )}
                {hayFiltros && (
                  <button type="button" className="btn-limpiar" onClick={limpiarFiltros}>
                    <X size={14} /> Limpiar filtros
                  </button>
                )}
                <ColumnPickerButton
                  estado={columnasEstado}
                  etiquetas={ETIQUETAS_PEDIDOS}
                  onAlternar={alternarColumna}
                  onRestablecer={restablecerColumnas}
                />
              </div>

              <div ref={barraRef} className={`gestion-seleccion-wrap ${barraVisible ? "visible" : ""}`} aria-hidden={!barraVisible}>
                <div>
                  <div className="gestion-seleccion" role="region" aria-label="Acciones de la selección">
                    <div className="gestion-seleccion-info">
                      <span className="gestion-seleccion-check" aria-hidden="true">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span aria-live="polite">
                        <strong>{cantidadBarra}</strong> pedido{cantidadBarra === 1 ? "" : "s"} seleccionado
                        {cantidadBarra === 1 ? "" : "s"}
                      </span>
                      <button type="button" className="gestion-seleccion-quitar" onClick={() => setSeleccion(new Set())}>
                        Quitar selección
                      </button>
                    </div>
                    <div className="gestion-seleccion-acciones">
                      <button
                        type="button"
                        className="btn secundario sm"
                        disabled={imprimiendoLote}
                        onClick={imprimirSeleccionados}
                      >
                        {imprimiendoLote ? <Loader2 size={14} className="girando" /> : <Printer size={14} />}
                        {imprimiendoLote ? "Generando…" : "Imprimir"}
                      </button>
                      {puedeEntregar && (
                        <button
                          type="button"
                          className="btn primario sm"
                          disabled={entregandoLote || entregables.length === 0}
                          title={entregables.length === 0 ? "Los pedidos seleccionados ya están entregados" : undefined}
                          onClick={entregarSeleccionados}
                        >
                          {entregandoLote ? <Loader2 size={14} className="girando" /> : <PackageCheck size={14} />}
                          {entregandoLote
                            ? "Entregando…"
                            : entregables.length > 0 && entregables.length < seleccion.size
                              ? `Entregar ${entregables.length}`
                              : "Entregar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <TablaPedidos
                {...propsTabla}
                lista={listaOrdenada}
                cargando={cargando}
                error={error}
                onReintentar={() => setRecarga((n) => n + 1)}
                vacio={vacioPrincipal}
              />
              {!cargando && pedidos.length >= TOPE_LISTA && (
                <p className="gestion-nota">
                  Se muestran los {TOPE_LISTA} pedidos más recientes. Acota la búsqueda o la fecha para ver otros.
                </p>
              )}
            </>
          )}

          {vista === "lotes" && (
            <div className="tabla-scroll gestion-tabla-scroll">
              <table className={`gestion-tabla ${errorLotes || lotes?.length === 0 ? "sin-filas" : ""}`}>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Tipo</th>
                    <th className="num">Pedidos</th>
                    <th className="num">Total</th>
                    <th>Generado por</th>
                    <th>Fecha</th>
                    <th className="col-acciones">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lotes === null && !errorLotes ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="fila-esqueleto">
                        <td colSpan={7}>
                          <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: `${70 - i * 10}%` }} />
                        </td>
                      </tr>
                    ))
                  ) : errorLotes ? (
                    <tr className="fila-vacia">
                      <td colSpan={7}>
                        <EstadoVacio
                          icono={<TriangleAlert size={20} />}
                          titulo="No se pudieron cargar los lotes"
                          texto={errorLotes}
                          accion={
                            <button type="button" className="btn secundario sm" onClick={cargarLotes}>
                              <RefreshCw size={14} /> Reintentar
                            </button>
                          }
                        />
                      </td>
                    </tr>
                  ) : lotes && lotes.length === 0 ? (
                    <tr className="fila-vacia">
                      <td colSpan={7}>
                        <EstadoVacio
                          icono={<Layers size={20} />}
                          titulo="Aún no hay lotes"
                          texto="Se crea un lote al imprimir o entregar varios pedidos a la vez."
                        />
                      </td>
                    </tr>
                  ) : (
                    lotes?.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <span className="celda-id">#{l.id}</span>
                        </td>
                        <td>
                          <Pastilla tono={l.tipo === "ENTREGA" ? "verde" : "azul"}>{l.tipo_display}</Pastilla>
                        </td>
                        <td className="num">{l.cantidad_pedidos}</td>
                        <td className="num">
                          <span className="celda-cifra">{formatoPrecio(l.total_lote)}</span>
                        </td>
                        <td>
                          <span className="celda-nombre" title={l.usuario_nombre}>
                            {l.usuario_nombre}
                          </span>
                        </td>
                        <td>
                          <time className="celda-fecha" dateTime={l.fecha_creacion} title={formatoFecha(l.fecha_creacion)}>
                            {fechaCorta(l.fecha_creacion)}
                          </time>
                        </td>
                        <td className="col-acciones">
                          <div className="acciones">
                            <Tooltip label="Ver pedidos del lote">
                              <button
                                type="button"
                                className="btn-icon editar"
                                onClick={() => setLoteAbiertoId(l.id)}
                                aria-label={`Ver los pedidos del lote #${l.id}`}
                              >
                                <Eye size={16} />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* El historial es "todo lo anterior a hoy": solo tiene sentido junto
            a la lista del día. Con otro periodo, el filtro de fecha ya lo cubre. */}
        {vista === "pedidos" && historialDisponible && (
          <section
            ref={historialRef}
            className={`panel gestion-panel pedidos-historial ${historialAbierto ? "abierto" : ""}`}
            aria-label="Historial de pedidos"
          >
            <button
              type="button"
              className="pedidos-historial-cab"
              aria-expanded={historialAbierto}
              onClick={() => setHistorialAbierto((v) => !v)}
            >
              <span className="pedidos-historial-icono" aria-hidden="true">
                <History size={17} />
              </span>
              <span className="pedidos-historial-texto">
                <span className="pedidos-historial-titulo">Historial de pedidos</span>
                <span className="pedidos-historial-sub">Pedidos anteriores a hoy · último año</span>
              </span>
              {historialAbierto && !cargandoHistorial && !errorHistorial && (
                <span className="pedidos-historial-num">
                  {historial.length >= TOPE_LISTA ? `${TOPE_LISTA}+` : historial.length}
                </span>
              )}
              <ChevronDown size={18} className={`chevron ${historialAbierto ? "abierto" : ""}`} aria-hidden="true" />
            </button>
            {historialAbierto && (
              <div className="pedidos-historial-cuerpo">
                <TablaPedidos
                  {...propsTabla}
                  lista={ordenar(historial, EXTRACTORES_PEDIDOS)}
                  cargando={cargandoHistorial}
                  error={errorHistorial}
                  onReintentar={() => setRecargaHistorial((n) => n + 1)}
                  vacio={
                    <EstadoVacio
                      icono={<History size={20} />}
                      titulo={busqueda || estado ? "Ningún pedido anterior coincide" : "Sin pedidos en el último año"}
                      texto={
                        busqueda || estado
                          ? "Prueba con otra búsqueda o estado."
                          : "Aquí aparecerán los pedidos de días anteriores."
                      }
                    />
                  }
                />
                {!cargandoHistorial && historial.length >= TOPE_LISTA && (
                  <p className="gestion-nota">
                    Se muestran los {TOPE_LISTA} pedidos más recientes del historial. Usa el filtro de fecha para
                    ver otros.
                  </p>
                )}
              </div>
            )}
          </section>
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
