import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Loader2,
  MessageCircle,
  Eye,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  ShoppingBag,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { eliminarCliente, obtenerTodosLosClientes } from "../api/resources";
import type { Cliente } from "../types";
import { extraerMensajeError, formatoFecha, normalizarTexto, tienePermiso } from "../utils";
import { alertaError, confirmarEliminar } from "../utils/alertas";
import { Tooltip } from "../components/Tooltip";
import { ColumnPickerButton } from "../components/ColumnPickerButton";
import { ThOrdenable } from "../components/ThOrdenable";
import { useColumnas } from "../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../hooks/useOrdenTabla";
import { useAuth } from "../auth/AuthContext";
import { EstadoVacio, MenuFila, Pastilla, TarjetaKpi, type AccionMenu } from "../components/gestion/Gestion";
import { fechaISO } from "../utils/fechas";
import { BotonFiltros, FilaFiltros, useFiltrosColumna, type DefsFiltros } from "../components/gestion/FiltrosColumna";
import { ClientFormModal } from "./clients/ClientFormModal";
import { ClientViewModal } from "./clients/ClientViewModal";
import "./clients/clientes.css";

type Segmento = "todos" | "con" | "sin" | "nuevos";
type FiltroWhatsapp = "" | "acepta" | "no" | "sin_respuesta";
type ClaveKpi = "total" | "nuevos" | "con" | "sin" | "whatsapp";

const OPCIONES_SEGMENTO: { valor: Segmento; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "con", etiqueta: "Con pedidos" },
  { valor: "sin", etiqueta: "Sin pedidos" },
  { valor: "nuevos", etiqueta: "Nuevos este mes" },
];

const OPCIONES_WHATSAPP: { valor: Exclude<FiltroWhatsapp, "">; etiqueta: string }[] = [
  { valor: "acepta", etiqueta: "Aceptan avisos" },
  { valor: "no", etiqueta: "No aceptan" },
  { valor: "sin_respuesta", etiqueta: "Sin respuesta" },
];

function inicioDeMes(desplazamiento = 0): Date {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
}

function esNuevoEsteMes(c: Cliente): boolean {
  return new Date(c.fecha_registro_cliente) >= inicioDeMes();
}

/** La decisión sobre los avisos de WhatsApp: aceptó, dijo que no, o nunca se le preguntó. */
function decisionWhatsapp(c: Cliente): Exclude<FiltroWhatsapp, ""> {
  if (c.acepta_whatsapp) return "acepta";
  return c.whatsapp_decidido_en ? "no" : "sin_respuesta";
}

/** "1.023.456.789": la cédula como se lee en Colombia. Solo si son dígitos. */
function formatoCedula(doc: string): string {
  return /^\d+$/.test(doc) ? Number(doc).toLocaleString("es-CO") : doc;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Columnas configurables. Las claves no cambian: `useColumnas` guarda en el
 *  navegador cuáles están visibles y en qué orden. */
const DEFINICIONES_CLIENTES: Record<
  string,
  { etiqueta: string; clase?: string; render: (c: Cliente) => ReactNode }
> = {
  nombre: {
    etiqueta: "Cliente",
    render: (c) => (
      <span className="cliente-identidad">
        <span className="cliente-avatar" aria-hidden="true">
          {iniciales(c.nombre_cliente)}
        </span>
        <span className="celda-nombre" title={c.nombre_cliente}>
          {c.nombre_cliente}
        </span>
      </span>
    ),
  },
  cedula: {
    etiqueta: "Cédula",
    render: (c) =>
      c.documento_cliente ? (
        <span className="celda-cifra-suave">{formatoCedula(c.documento_cliente)}</span>
      ) : (
        <span className="celda-tenue">—</span>
      ),
  },
  telefono: {
    etiqueta: "Teléfono",
    render: (c) =>
      c.telefono_cliente ? (
        <span className="celda-cifra-suave">{c.telefono_cliente}</span>
      ) : (
        <span className="celda-tenue">—</span>
      ),
  },
  direccion: {
    etiqueta: "Dirección",
    render: (c) =>
      c.direccion_cliente ? (
        <span className="celda-texto-largo" title={c.direccion_cliente}>
          {c.direccion_cliente}
        </span>
      ) : (
        <span className="celda-tenue">—</span>
      ),
  },
  whatsapp: {
    etiqueta: "WhatsApp",
    render: (c) => {
      const decision = decisionWhatsapp(c);
      if (decision === "acepta") return <Pastilla tono="verde">Acepta</Pastilla>;
      if (decision === "no") return <Pastilla>No acepta</Pastilla>;
      return <span className="celda-tenue">Sin respuesta</span>;
    },
  },
  pedidos: {
    etiqueta: "Pedidos",
    clase: "num",
    render: (c) =>
      c.total_pedidos > 0 ? (
        <span className="celda-cifra">{c.total_pedidos}</span>
      ) : (
        <span className="celda-tenue">0</span>
      ),
  },
  registro: {
    etiqueta: "Registro",
    render: (c) => (
      <time
        className="celda-fecha"
        dateTime={c.fecha_registro_cliente}
        title={formatoFecha(c.fecha_registro_cliente)}
      >
        {fechaISO(c.fecha_registro_cliente)}
      </time>
    ),
  },
};
const CLAVES_CLIENTES = Object.keys(DEFINICIONES_CLIENTES);
const ETIQUETAS_CLIENTES = Object.fromEntries(
  Object.entries(DEFINICIONES_CLIENTES).map(([clave, def]) => [clave, def.etiqueta])
);

/** El filtro que va bajo cada columna (botón «Filtros»). WhatsApp, combobox. */
const FILTROS_CLIENTES: DefsFiltros<Cliente> = {
  nombre: { tipo: "texto", valor: (c) => c.nombre_cliente },
  cedula: { tipo: "texto", valor: (c) => c.documento_cliente },
  telefono: { tipo: "texto", valor: (c) => c.telefono_cliente },
  direccion: { tipo: "texto", valor: (c) => c.direccion_cliente },
  whatsapp: { tipo: "opciones", valor: (c) => decisionWhatsapp(c), opciones: OPCIONES_WHATSAPP },
  pedidos: { tipo: "numero", valor: (c) => c.total_pedidos },
  registro: { tipo: "fecha", valor: (c) => c.fecha_registro_cliente },
};

const EXTRACTORES_CLIENTES: ExtractoresOrden<Cliente> = {
  nombre: (c) => normalizarTexto(c.nombre_cliente),
  cedula: (c) => c.documento_cliente,
  telefono: (c) => c.telefono_cliente,
  direccion: (c) => c.direccion_cliente,
  whatsapp: (c) => (c.acepta_whatsapp ? 2 : c.whatsapp_decidido_en ? 1 : 0),
  pedidos: (c) => c.total_pedidos,
  registro: (c) => c.fecha_registro_cliente,
};

export function ClientsPage() {
  const { usuario: actual } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // La base completa: de aquí salen los indicadores y la lista sin búsqueda.
  const [todos, setTodos] = useState<Cliente[] | null>(null);
  const [errorTodos, setErrorTodos] = useState<string | null>(null);
  const [cargandoTodos, setCargandoTodos] = useState(true);

  // La búsqueda la sigue haciendo el servidor (nombre, teléfono o cédula).
  const [busqueda, setBusqueda] = useState(() => searchParams.get("q") ?? "");
  const [resultados, setResultados] = useState<Cliente[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const turnoBusqueda = useRef(0);

  const [segmento, setSegmento] = useState<Segmento>("todos");
  const filtros = useFiltrosColumna(FILTROS_CLIENTES);
  // El filtro de WhatsApp es el de su columna; el indicador «Aceptan WhatsApp» lo usa.
  const whatsapp = (filtros.valores.whatsapp ?? "") as FiltroWhatsapp;
  const setWhatsapp = (valor: FiltroWhatsapp) => filtros.cambiar("whatsapp", valor);
  const [kpiPulsado, setKpiPulsado] = useState<ClaveKpi | null>(null);

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
  const [viendo, setViendo] = useState<Cliente | null>(null);

  const puedeEditar = tienePermiso(actual, "orders.change_cliente");
  const puedeEliminar = tienePermiso(actual, "orders.delete_cliente");
  const puedeVerPedidos = tienePermiso(actual, "orders.view_pedido");

  function cargarTodos() {
    setCargandoTodos(true);
    obtenerTodosLosClientes()
      .then((lista) => {
        setTodos(lista);
        setErrorTodos(null);
      })
      .catch((err) => setErrorTodos(extraerMensajeError(err, "Revisa tu conexión e inténtalo de nuevo.")))
      .finally(() => setCargandoTodos(false));
  }

  useEffect(() => {
    cargarTodos();
  }, []);

  // Sin texto no se pide nada: la lista es la base que ya está cargada.
  const [recargaBusqueda, setRecargaBusqueda] = useState(0);
  useEffect(() => {
    const termino = busqueda.trim();
    const turno = ++turnoBusqueda.current;
    if (!termino) {
      setResultados(null);
      setBuscando(false);
      setErrorBusqueda(null);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      obtenerTodosLosClientes(termino)
        .then((lista) => {
          if (turno !== turnoBusqueda.current) return;
          setResultados(lista);
          setErrorBusqueda(null);
        })
        .catch((err) => {
          if (turno !== turnoBusqueda.current) return;
          setErrorBusqueda(extraerMensajeError(err, "Revisa tu conexión e inténtalo de nuevo."));
        })
        .finally(() => {
          if (turno === turnoBusqueda.current) setBuscando(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, recargaBusqueda]);

  function recargar() {
    cargarTodos();
    if (busqueda.trim()) setRecargaBusqueda((n) => n + 1);
  }

  // ---------- Indicadores ----------

  const kpis = useMemo(() => {
    if (!todos) return null;
    const inicioMes = inicioDeMes();
    const inicioMesAnterior = inicioDeMes(-1);
    return {
      total: todos.length,
      nuevosEsteMes: todos.filter(esNuevoEsteMes).length,
      nuevosMesAnterior: todos.filter((c) => {
        const f = new Date(c.fecha_registro_cliente);
        return f >= inicioMesAnterior && f < inicioMes;
      }).length,
      conPedidos: todos.filter((c) => c.total_pedidos > 0).length,
      sinPedidos: todos.filter((c) => c.total_pedidos === 0).length,
      aceptanWhatsapp: todos.filter((c) => c.acepta_whatsapp).length,
    };
  }, [todos]);

  const coincideKpi: Record<ClaveKpi, boolean> = {
    total: !busqueda && segmento === "todos" && !whatsapp,
    nuevos: !busqueda && segmento === "nuevos" && !whatsapp,
    con: !busqueda && segmento === "con" && !whatsapp,
    sin: !busqueda && segmento === "sin" && !whatsapp,
    whatsapp: !busqueda && segmento === "todos" && whatsapp === "acepta",
  };
  // "Total" coincide con la vista inicial; solo se marca si se pulsó.
  const kpiActivo = kpiPulsado && coincideKpi[kpiPulsado] ? kpiPulsado : null;

  function aplicarKpi(clave: ClaveKpi) {
    setBusqueda("");
    if (kpiActivo === clave) {
      setKpiPulsado(null);
      setSegmento("todos");
      setWhatsapp("");
      return;
    }
    setKpiPulsado(clave);
    setSegmento(clave === "nuevos" ? "nuevos" : clave === "con" ? "con" : clave === "sin" ? "sin" : "todos");
    setWhatsapp(clave === "whatsapp" ? "acepta" : "");
    if (clave === "whatsapp") filtros.abrir();
  }

  // ---------- Lista ----------

  const base = busqueda.trim() ? resultados : todos;
  const cargando = busqueda.trim() ? buscando && resultados === null : cargandoTodos && todos === null;
  const actualizando = buscando || cargandoTodos;
  const error = busqueda.trim() ? errorBusqueda : errorTodos;

  const lista = useMemo(() => {
    let l = base ?? [];
    if (segmento === "con") l = l.filter((c) => c.total_pedidos > 0);
    else if (segmento === "sin") l = l.filter((c) => c.total_pedidos === 0);
    else if (segmento === "nuevos") l = l.filter(esNuevoEsteMes);
    l = filtros.aplicar(l);
    return ordenar(l, EXTRACTORES_CLIENTES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, segmento, filtros.aplicar, columnaOrden, direccionOrden]);

  const hayFiltros = Boolean(busqueda || segmento !== "todos" || filtros.activos);

  function limpiarFiltros() {
    setBusqueda("");
    setSegmento("todos");
    filtros.limpiar();
    setKpiPulsado(null);
  }

  // ---------- Acciones ----------

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }

  async function eliminar(c: Cliente) {
    // En el backend el pedido cuelga del cliente con CASCADE: borrar al
    // cliente borra también sus pedidos. Quien elimina tiene que saberlo.
    const detalle =
      c.total_pedidos > 0
        ? `También se eliminarán sus ${c.total_pedidos} pedido${c.total_pedidos === 1 ? "" : "s"}. Esta acción no se puede deshacer.`
        : "Esta acción no se puede deshacer.";
    if (!(await confirmarEliminar(`¿Eliminar al cliente "${c.nombre_cliente}"?`, detalle))) return;
    try {
      await eliminarCliente(c.id);
      recargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el cliente."));
    }
  }

  function accionesDe(c: Cliente): AccionMenu[] {
    const acciones: AccionMenu[] = [];
    if (puedeVerPedidos && c.total_pedidos > 0) {
      acciones.push({
        clave: "pedidos",
        etiqueta: "Ver sus pedidos",
        icono: <ShoppingBag size={15} />,
        onSeleccionar: () => navigate(`/pedidos?q=${encodeURIComponent(c.nombre_cliente)}`),
      });
    }
    if (c.telefono_cliente) {
      acciones.push({
        clave: "llamar",
        etiqueta: "Llamar",
        icono: <Phone size={15} />,
        onSeleccionar: () => {
          window.location.href = `tel:${c.telefono_cliente.replace(/[^\d+]/g, "")}`;
        },
      });
    }
    if (puedeEliminar) {
      acciones.push({
        clave: "eliminar",
        etiqueta: "Eliminar cliente",
        icono: <Trash2 size={15} />,
        peligro: true,
        onSeleccionar: () => eliminar(c),
      });
    }
    return acciones;
  }

  // ---------- Render ----------

  const columnas = 1 + columnasVisibles.length;
  const sinFilas = !cargando && (Boolean(error) || lista.length === 0);
  const sinClientes = todos !== null && todos.length === 0;

  let cuerpoVacio: ReactNode = null;
  if (error) {
    cuerpoVacio = (
      <EstadoVacio
        icono={<TriangleAlert size={20} />}
        titulo="No se pudieron cargar los clientes"
        texto={error}
        accion={
          <button type="button" className="btn secundario sm" onClick={recargar}>
            <RefreshCw size={14} /> Reintentar
          </button>
        }
      />
    );
  } else if (sinClientes && !hayFiltros) {
    cuerpoVacio = (
      <EstadoVacio
        icono={<Users size={20} />}
        titulo="Aún no tienes clientes"
        texto="Se registran solos con su primer pedido en la tienda, o puedes crearlos tú."
        accion={
          <button type="button" className="btn primario sm" onClick={abrirNuevo}>
            <Plus size={14} /> Nuevo cliente
          </button>
        }
      />
    );
  } else {
    cuerpoVacio = (
      <EstadoVacio
        icono={<SearchX size={20} />}
        titulo="Ningún cliente coincide con los filtros"
        texto={busqueda ? `No hay resultados para "${busqueda}".` : "Prueba con otro segmento o filtro."}
        accion={
          <button type="button" className="btn secundario sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        }
      />
    );
  }

  const variacion = kpis ? kpis.nuevosEsteMes - kpis.nuevosMesAnterior : 0;

  return (
    <>
      <div className="topbar gestion-topbar">
        <div className="gestion-titulo">
          <h1>Clientes</h1>
          <p>Consulta y gestiona tus clientes, sus datos de contacto y sus pedidos</p>
        </div>
        <div className="gestion-topbar-acciones">
          <Tooltip label="Actualizar" posicion="abajo">
            <button
              type="button"
              className="btn-icon gestion-actualizar-icono"
              onClick={recargar}
              disabled={actualizando}
              aria-label="Actualizar clientes"
            >
              <RefreshCw size={16} className={actualizando ? "girando" : ""} />
            </button>
          </Tooltip>
          <button type="button" className="btn primario" onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo cliente
          </button>
        </div>
      </div>

      <div className="contenido gestion-vista">
        <div className="kpis-gestion">
          <TarjetaKpi
            tono="neutro"
            icono={<Users size={18} />}
            etiqueta="Total clientes"
            valor={kpis ? kpis.total.toLocaleString("es-CO") : null}
            activa={kpiActivo === "total"}
            descripcion="Ver todos los clientes"
            onClick={() => aplicarKpi("total")}
          />
          <TarjetaKpi
            tono="azul"
            icono={<UserPlus size={18} />}
            etiqueta="Nuevos este mes"
            valor={kpis ? kpis.nuevosEsteMes.toLocaleString("es-CO") : null}
            pie={
              kpis && (
                <>
                  <span className={variacion > 0 ? "sube" : variacion < 0 ? "baja" : ""}>
                    {variacion > 0 ? "+" : ""}
                    {variacion}
                  </span>{" "}
                  vs. {kpis.nuevosMesAnterior} el mes pasado
                </>
              )
            }
            activa={kpiActivo === "nuevos"}
            descripcion="Ver los clientes registrados este mes"
            onClick={() => aplicarKpi("nuevos")}
          />
          <TarjetaKpi
            tono="verde"
            icono={<UserCheck size={18} />}
            etiqueta="Con pedidos"
            valor={kpis ? kpis.conPedidos.toLocaleString("es-CO") : null}
            activa={kpiActivo === "con"}
            descripcion="Ver los clientes que ya han pedido"
            onClick={() => aplicarKpi("con")}
          />
          <TarjetaKpi
            tono="ambar"
            icono={<UserX size={18} />}
            etiqueta="Sin pedidos aún"
            valor={kpis ? kpis.sinPedidos.toLocaleString("es-CO") : null}
            activa={kpiActivo === "sin"}
            descripcion="Ver los clientes que todavía no han pedido"
            onClick={() => aplicarKpi("sin")}
          />
          <TarjetaKpi
            tono="violeta"
            icono={<MessageCircle size={18} />}
            etiqueta="Aceptan WhatsApp"
            valor={kpis ? kpis.aceptanWhatsapp.toLocaleString("es-CO") : null}
            activa={kpiActivo === "whatsapp"}
            descripcion="Ver los clientes que aceptan avisos por WhatsApp"
            onClick={() => aplicarKpi("whatsapp")}
          />
        </div>

        <section className="panel gestion-modulo" aria-label="Lista de clientes">
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
              {cargando ? (
                "Cargando…"
              ) : error ? null : (
                <>
                  <strong>{lista.length.toLocaleString("es-CO")}</strong> cliente{lista.length === 1 ? "" : "s"}
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
                placeholder="Buscar por nombre, teléfono o cédula…"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setKpiPulsado(null);
                }}
                aria-label="Buscar clientes"
              />
              {buscando ? (
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
            {hayFiltros && (
              <button type="button" className="btn-limpiar" onClick={limpiarFiltros}>
                <X size={14} /> Limpiar filtros
              </button>
            )}
            <BotonFiltros abiertos={filtros.abiertos} activos={filtros.activos} onAlternar={filtros.alternar} />
            <ColumnPickerButton
              estado={columnasEstado}
              etiquetas={ETIQUETAS_CLIENTES}
              onAlternar={alternarColumna}
              onRestablecer={restablecerColumnas}
            />
          </div>

          <div
            className={`tabla-scroll gestion-tabla-scroll ${actualizando && !cargando ? "actualizando" : ""}`}
            aria-busy={actualizando}
          >
            <table className={`gestion-tabla ${sinFilas ? "sin-filas" : ""}`}>
              <thead>
                <tr>
                  {columnasVisibles.map((clave) => (
                    <ThOrdenable
                      key={clave}
                      clave={clave}
                      etiqueta={ETIQUETAS_CLIENTES[clave]}
                      className={DEFINICIONES_CLIENTES[clave].clase}
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
                {filtros.abiertos && (
                  <FilaFiltros
                    columnas={columnasVisibles}
                    defs={FILTROS_CLIENTES}
                    etiquetas={ETIQUETAS_CLIENTES}
                    valores={filtros.valores}
                    onCambiar={(clave, valor) => {
                      filtros.cambiar(clave, valor);
                      setKpiPulsado(null);
                    }}
                  />
                )}
              </thead>
              <tbody>
                {cargando ? (
                  Array.from({ length: 6 }).map((_, i) => (
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
                  lista.map((c) => {
                    const acciones = accionesDe(c);
                    return (
                      <tr
                        key={c.id}
                        className="fila-clicable"
                        // El clic en cualquier parte de la fila abre la ficha; con
                        // teclado se llega por el botón «Ver ficha» de acciones.
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, a, input, [role=menu]")) return;
                          setViendo(c);
                        }}
                      >
                        {columnasVisibles.map((clave) => (
                          <td key={clave} className={DEFINICIONES_CLIENTES[clave].clase}>
                            {DEFINICIONES_CLIENTES[clave].render(c)}
                          </td>
                        ))}
                        <td className="col-acciones">
                          <div className="acciones">
                            <Tooltip label="Ver ficha">
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => setViendo(c)}
                                aria-label={`Ver la ficha de ${c.nombre_cliente}`}
                              >
                                <Eye size={16} />
                              </button>
                            </Tooltip>
                            {puedeEditar && (
                              <Tooltip label="Editar cliente">
                                <button
                                  type="button"
                                  className="btn-icon editar"
                                  onClick={() => {
                                    setEditando(c);
                                    setModalAbierto(true);
                                  }}
                                  aria-label={`Editar a ${c.nombre_cliente}`}
                                >
                                  <Pencil size={16} />
                                </button>
                              </Tooltip>
                            )}
                            {acciones.length > 0 && (
                              <MenuFila etiqueta={`Más acciones de ${c.nombre_cliente}`} acciones={acciones} />
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

      {viendo && (
        <ClientViewModal
          cliente={viendo}
          puedeEditar={puedeEditar}
          onCerrar={() => setViendo(null)}
          onEditar={() => {
            setEditando(viendo);
            setViendo(null);
            setModalAbierto(true);
          }}
        />
      )}

      {modalAbierto && (
        <ClientFormModal
          cliente={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            recargar();
          }}
        />
      )}
    </>
  );
}
