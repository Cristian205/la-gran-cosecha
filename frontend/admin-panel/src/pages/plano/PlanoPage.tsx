import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  Box,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Eye,
  FileDown,
  FilePen,
  Gauge,
  Hand,
  LayoutDashboard,
  Layers,
  Lock,
  LockOpen,
  MapPin,
  Package,
  PackageMinus,
  PackageX,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Route,
  Rows3,
  Save,
  Search,
  SearchX,
  Settings2,
  ShieldCheck,
  Trash2,
  Truck,
  Undo2,
  Wand2,
  Weight,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  confirmarPlano,
  consultarDia,
  consultarRejilla,
  descargarPdfPlano,
  duplicarPlano,
  eliminarPlano,
  guardarPlano,
  listarCanastillas,
  listarFurgones,
  listarPlanos,
  obtenerPlano,
  reabrirPlano,
  type EntregaDestino,
  type EstadoDespacho,
  type Furgon,
  type GrupoCarga,
  type PedidoAsignado,
  type PedidoPlanificacion,
  type PlanoResumen,
  type VehiculoPropuesta,
  type Posicion,
  type Rejilla,
  type Revision,
  type TipoCanastilla,
} from "../../api/logistica";
import { useAuth } from "../../auth/AuthContext";
import { extraerMensajeError, normalizarTexto, tienePermiso } from "../../utils";
import { diaRelativo } from "../../utils/fechas";
import { Tooltip } from "../../components/Tooltip";
import { ColumnPickerButton } from "../../components/ColumnPickerButton";
import { ThOrdenable } from "../../components/ThOrdenable";
import { useColumnas } from "../../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../../hooks/useOrdenTabla";
import { EstadoVacio, MenuFila, Pastilla, TarjetaKpi, type AccionMenu } from "../../components/gestion/Gestion";
import { Paginacion, usePaginacion } from "../../components/gestion/Paginacion";
import { alertaError, alertaExito, confirmarAccion, confirmarDescartar, confirmarEliminar } from "../../utils/alertas";
import {
  acomodarAutomatico,
  cargaPorFilas,
  COLORES_GRUPO,
  contenidoPila,
  depurar,
  filaDePila,
  estorbosDeOrden,
  intercambiar,
  moverAPila,
  pendientesPorGrupo,
  quitar,
  ubicacionDe,
  ubicarPendientes,
} from "./acomodo";
import CentroPlanificacion, { mananaIso } from "./CentroPlanificacion";
import { ConfigMedidas } from "./ConfigMedidas";
import ReglasCarga from "./ReglasCarga";
import RutasSemanales from "./RutasSemanales";
import type { OpcionesVisor, Vista } from "./Furgon3D";
import Plano2D from "./Plano2D";
import "./plano.css";
import "./plano-v2.css";
import "./plano-v3.css";
import "./planificacion.css";

// three.js pesa: se descarga solo al abrir esta pantalla.
const Furgon3D = lazy(() => import("./Furgon3D"));

// Ver la página lo exige la ruta (`logistica.view_planocarga`, en App.tsx).
const ARMAR = "logistica.add_planocarga";
const ADMINISTRAR = "logistica.change_furgon";

interface Borrador {
  id?: number;
  nombre: string;
  fecha: string;
  furgon: number | "";
  tipo: number | "";
  grupos: GrupoCarga[];
  posiciones: Posicion[];
  bloqueos: number[];
  notas: string;
  estado: EstadoDespacho;
}

/** Lo que deshacer/rehacer restaura. */
type Instantanea = Pick<Borrador, "grupos" | "posiciones" | "bloqueos">;

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const diaSiguiente = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nuevoId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NOMBRE_ZONA: Record<string, string> = {
  frente: "Fila delantera",
  izquierda: "Lateral izquierdo",
  derecha: "Lateral derecho",
  rejilla: "Piso",
};

interface PuntoRuta {
  cliente: number;
  nombre: string;
  direccion: string;
  ordenRuta: number;
  pedidos: PedidoPlanificacion[];
}

/** Huella de las medidas que definen el esquema (para recalcularlo si cambian). */
function huellaMedidas(f: Furgon | null, t: TipoCanastilla | null): string {
  return JSON.stringify([f?.largo_cm, f?.ancho_cm, f?.alto_cm, f?.esquema_carga, t?.largo_cm, t?.ancho_cm, t?.alto_cm, t?.max_apiladas]);
}

/**
 * Los pedidos a guardar: solo los de destinos que existen, y cada destino
 * lleva exactamente sus canastillas (el primer pedido las lleva; los demás
 * van consolidados en ellas). Así el servidor no cambia la cantidad.
 */
function pedidosParaGuardar(grupos: GrupoCarga[], asignados: PedidoAsignado[]): PedidoAsignado[] {
  const cantidad = new Map(grupos.map((g) => [g.id, g.cantidad]));
  const vistos = new Set<string>();
  return asignados
    .filter((a) => cantidad.has(a.grupo))
    .map((a) => {
      const primero = !vistos.has(a.grupo);
      vistos.add(a.grupo);
      return { ...a, canastillas: primero ? cantidad.get(a.grupo)! : 0 };
    });
}

function borradorNuevo(furgones: Furgon[], canastillas: TipoCanastilla[]): Borrador {
  return {
    nombre: "",
    fecha: diaSiguiente(hoy()),
    furgon: furgones.find((f) => f.activo)?.id ?? "",
    tipo: canastillas.find((c) => c.activa)?.id ?? "",
    grupos: [],
    posiciones: [],
    bloqueos: [],
    notas: "",
    estado: "BORRADOR",
  };
}

type Pestana = "centro" | "rutas" | "despachos" | "medidas";
const PESTANAS: Array<{ clave: Pestana; etiqueta: string; icono: ReactNode; titulo: string; texto: string }> = [
  { clave: "centro", etiqueta: "Centro del día", icono: <LayoutDashboard size={15} />, titulo: "Centro de planificación", texto: "Los pedidos del día repartidos por vehículo según sus rutas: revisa, ajusta y genera los despachos" },
  { clave: "rutas", etiqueta: "Rutas semanales", icono: <Route size={15} />, titulo: "Programación semanal", texto: "Qué vehículo visita a qué clientes, en qué orden, cada día de la semana" },
  { clave: "despachos", etiqueta: "Despachos", icono: <Truck size={15} />, titulo: "Despachos", texto: "Cada vehículo con su plano de carga: qué canastilla va en cada posición y en qué orden se entrega" },
  { clave: "medidas", etiqueta: "Vehículos y reglas", icono: <Settings2 size={15} />, titulo: "Vehículos, canastillas y reglas", texto: "Las medidas reales y las reglas de carga con las que se calcula cuánto cabe" },
];

const VISTAS: Array<{ clave: Vista | "2d"; etiqueta: string; icono: ReactNode }> = [
  { clave: "3d", etiqueta: "3D", icono: <Box size={14} /> },
  { clave: "2d", etiqueta: "Plano 2D", icono: <Rows3 size={14} /> },
  { clave: "lateral", etiqueta: "Lateral", icono: <Truck size={14} /> },
  { clave: "trasera", etiqueta: "Desde las puertas", icono: <Layers size={14} /> },
];

/** "Hoy", "Mañana", "Ayer" o "12 nov": la fecha de entrega como se dice. */
function diaDespacho(iso: string): string {
  if (iso === diaSiguiente(hoy())) return "Mañana";
  return diaRelativo(`${iso}T12:00:00`);
}

type Segmento = "todos" | "proximos" | "borrador" | "confirmado" | "manana";
const OPCIONES_SEGMENTO: { valor: Segmento; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "proximos", etiqueta: "Próximos" },
  { valor: "borrador", etiqueta: "Borradores" },
  { valor: "confirmado", etiqueta: "Confirmados" },
];

/** Columnas de la lista; `useColumnas` recuerda cuáles se ven y en qué orden. */
const DEFINICIONES_DESPACHOS: Record<string, { etiqueta: string; clase?: string; render: (p: PlanoResumen) => ReactNode }> = {
  nombre: {
    etiqueta: "Despacho",
    render: (p) => (
      <span className="plano-celda-despacho">
        <span className="plano-celda-icono" aria-hidden="true">
          <Truck size={15} />
        </span>
        <span className="celda-nombre" title={p.nombre}>
          {p.nombre}
        </span>
      </span>
    ),
  },
  fecha: {
    etiqueta: "Entrega",
    render: (p) => (
      <time className={`celda-fecha ${p.fecha === diaSiguiente(hoy()) ? "plano-manana" : ""}`} dateTime={p.fecha}>
        {diaDespacho(p.fecha)}
      </time>
    ),
  },
  furgon: { etiqueta: "Vehículo", render: (p) => <span className="celda-texto-largo">{p.furgon_nombre}</span> },
  destinos: {
    etiqueta: "Destinos",
    clase: "num",
    render: (p) => (p.total_destinos ? <span className="celda-cifra">{p.total_destinos}</span> : <span className="celda-tenue">0</span>),
  },
  canastillas: {
    etiqueta: "Canastillas",
    clase: "num",
    render: (p) => (
      <span className="celda-cifra-suave">
        <strong className="celda-cifra">{p.total_canastillas}</strong> / {p.capacidad}
      </span>
    ),
  },
  ocupacion: {
    etiqueta: "Ocupación",
    render: (p) => {
      const pct = p.capacidad ? Math.round((p.total_canastillas / p.capacidad) * 100) : 0;
      return (
        <span className={`plano-ocupacion ${pct > 100 ? "excede" : pct > 95 ? "alta" : ""}`}>
          <span className="plano-ocupacion-barra" aria-hidden="true">
            <i style={{ width: `${Math.min(100, pct)}%` }} />
          </span>
          <span className="plano-ocupacion-num">{pct}%</span>
        </span>
      );
    },
  },
  estado: {
    etiqueta: "Estado",
    render: (p) => <Pastilla tono={p.estado === "CONFIRMADO" ? "verde" : "ambar"}>{p.estado === "CONFIRMADO" ? "Confirmado" : "Borrador"}</Pastilla>,
  },
};
const CLAVES_DESPACHOS = Object.keys(DEFINICIONES_DESPACHOS);
const ETIQUETAS_DESPACHOS = Object.fromEntries(Object.entries(DEFINICIONES_DESPACHOS).map(([k, d]) => [k, d.etiqueta]));
const EXTRACTORES_DESPACHOS: ExtractoresOrden<PlanoResumen> = {
  nombre: (p) => normalizarTexto(p.nombre),
  fecha: (p) => p.fecha,
  furgon: (p) => normalizarTexto(p.furgon_nombre),
  destinos: (p) => p.total_destinos,
  canastillas: (p) => p.total_canastillas,
  ocupacion: (p) => (p.capacidad ? p.total_canastillas / p.capacidad : 0),
  estado: (p) => p.estado,
};

export default function PlanoPage() {
  const { usuario } = useAuth();
  const puedeArmar = tienePermiso(usuario, ARMAR);
  const puedeAdministrar = tienePermiso(usuario, ADMINISTRAR);

  const [pestana, setPestana] = useState<Pestana>("centro");
  const [fechaCentro, setFechaCentro] = useState(mananaIso);
  const [furgones, setFurgones] = useState<Furgon[]>([]);
  const [canastillas, setCanastillas] = useState<TipoCanastilla[]>([]);
  const [planos, setPlanos] = useState<PlanoResumen[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [segmento, setSegmento] = useState<Segmento>("todos");
  const [kpiPulsado, setKpiPulsado] = useState<Segmento | null>(null);
  const {
    estado: columnasEstado,
    visibles: columnasVisibles,
    alternar: alternarColumna,
    mover: moverColumna,
    restablecer: restablecerColumnas,
  } = useColumnas("despachos-carga", CLAVES_DESPACHOS);
  const { columna: columnaOrden, direccion: direccionOrden, alternarColumna: ordenarPorColumna, ordenar } = useOrdenTabla<PlanoResumen>();

  const [b, setB] = useState<Borrador | null>(null);
  const [rejilla, setRejilla] = useState<Rejilla | null>(null);
  const [rejillaDe, setRejillaDe] = useState("");
  const [ajustado, setAjustado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [revisionServidor, setRevisionServidor] = useState<Revision | null>(null);
  const [motivoSinLugar, setMotivoSinLugar] = useState<string | null>(null);
  const [historial, setHistorial] = useState<{ atras: Instantanea[]; adelante: Instantanea[] }>({ atras: [], adelante: [] });

  const [seleccion, setSeleccion] = useState<Posicion | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  /** Pedidos y productos de cada destino (los manda el servidor con el despacho). */
  const [entregas, setEntregas] = useState<EntregaDestino[]>([]);
  /** Destino cuyas canastillas pendientes se están colocando a mano. */
  const [colocando, setColocando] = useState<string | null>(null);
  const [vistaDestinos, setVistaDestinos] = useState<"destino" | "fila">("destino");
  const [destinosAbiertos, setDestinosAbiertos] = useState<Set<string>>(new Set());
  /** Pedidos vinculados que tenía el despacho al abrirlo / guardarlo. */
  const [pedidosBase, setPedidosBase] = useState<PedidoAsignado[]>([]);
  /** null = los pedidos no cambiaron (no se envían); si no, la lista nueva completa. */
  const [asignados, setAsignados] = useState<PedidoAsignado[] | null>(null);
  /** La ruta del vehículo ese día (con los pedidos de sus puntos), si existe. */
  const [rutaDia, setRutaDia] = useState<VehiculoPropuesta | null>(null);
  /** Para saber si el despacho cambió en el servidor mientras se miraba otra cosa. */
  const actualizadoRef = useRef<string | null>(null);
  const [vista, setVista] = useState<Vista | "2d">("3d");
  const [opciones, setOpciones] = useState<OpcionesVisor>({ techo: false, paredes: true, puertasAbiertas: true });
  const alternar = (k: keyof OpcionesVisor) => setOpciones((o) => ({ ...o, [k]: !o[k] }));

  const cargarCatalogos = useCallback(async () => {
    try {
      const [f, c, p] = await Promise.all([listarFurgones(), listarCanastillas(), listarPlanos()]);
      setFurgones(f);
      setCanastillas(c);
      setPlanos(p);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo cargar el plano de carga."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  const furgonActual = furgones.find((f) => f.id === b?.furgon) ?? null;
  const tipoActual = canastillas.find((c) => c.id === b?.tipo) ?? null;
  const editable = puedeArmar && b?.estado !== "CONFIRMADO";

  /** Cuántas canastillas permite la carga útil (si se conocen los dos datos). */
  const topePeso = useMemo(() => {
    const peso = tipoActual?.peso_lleno_kg ? Number(tipoActual.peso_lleno_kg) : null;
    const carga = furgonActual?.carga_util_kg ?? null;
    return peso && carga ? Math.floor(carga / peso) : null;
  }, [tipoActual, furgonActual]);

  const autoAcomodar = useCallback(
    (grupos: GrupoCarga[], r: Rejilla, actuales: Posicion[], bloqueos: number[]) => {
      const res = acomodarAutomatico(grupos, r, { bloqueos, actuales, tope: topePeso });
      setMotivoSinLugar(res.motivo);
      return res.posiciones;
    },
    [topePeso]
  );

  // Cambió el furgón o la canastilla: se pide el esquema y se reacomoda.
  useEffect(() => {
    if (!b || b.furgon === "" || b.tipo === "") return;
    // En un despacho nuevo la clave incluye las medidas: si el vehículo o la
    // canastilla cambian, el esquema se vuelve a calcular. Uno guardado se
    // actualiza desde el servidor (que adapta los borradores al guardar medidas).
    const clave = b.id ? `${b.furgon}:${b.tipo}` : `${b.furgon}:${b.tipo}:${huellaMedidas(furgonActual, tipoActual)}`;
    if (clave === rejillaDe) return;
    let vigente = true;
    consultarRejilla(b.furgon, b.tipo)
      .then((r) => {
        if (!vigente) return;
        setRejilla(r);
        setRejillaDe(clave);
        setSeleccion(null);
        setAjustado(false);
        setB((x) => (x ? { ...x, bloqueos: [], posiciones: autoAcomodar(x.grupos, r, [], []) } : x));
      })
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudo calcular el esquema del furgón.")));
    return () => {
      vigente = false;
    };
  }, [b, rejillaDe, autoAcomodar, furgonActual, tipoActual]);

  // La ruta de este vehículo ese día: sus puntos aparecen para agregarlos.
  const furgonB = b?.furgon ?? "";
  const tipoB = b?.tipo ?? "";
  const fechaB = b?.fecha ?? "";
  useEffect(() => {
    if (furgonB === "" || tipoB === "" || !fechaB) {
      setRutaDia(null);
      return;
    }
    let vigente = true;
    consultarDia(fechaB, tipoB)
      .then((d) => vigente && setRutaDia(d.vehiculos.find((v) => v.furgon?.id === furgonB) ?? null))
      .catch(() => vigente && setRutaDia(null));
    return () => {
      vigente = false;
    };
  }, [furgonB, tipoB, fechaB]);

  // Al volver a esta pantalla (otra pestaña, otra ventana) se trae lo último:
  // vehículos, canastillas y, si no hay cambios sin guardar, el despacho.
  const idB = b?.id;
  useEffect(() => {
    const alVolver = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const [f, c] = await Promise.all([listarFurgones(), listarCanastillas()]);
        setFurgones(f);
        setCanastillas(c);
        if (!idB || sucio) return;
        const p = await obtenerPlano(idB);
        if (p.actualizado === actualizadoRef.current) return;
        actualizadoRef.current = p.actualizado;
        setB((x) => (x && x.id === p.id ? { ...x, grupos: p.grupos, posiciones: p.posiciones, bloqueos: p.bloqueos ?? [], estado: p.estado } : x));
        setRejilla(p.medidas);
        setRevisionServidor(p.revision);
        setEntregas(p.entregas ?? []);
        setPedidosBase(p.pedidos_detalle.map((x) => ({ pedido: x.id, grupo: x.grupo, canastillas: x.canastillas })));
      } catch {
        /* sin conexión: se queda lo que hay en pantalla */
      }
    };
    window.addEventListener("focus", alVolver);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("focus", alVolver);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [idB, sucio]);

  // ---------- Historial (deshacer / rehacer) ----------
  function aplicar(cambio: Partial<Instantanea>, marcarAjuste = true) {
    if (!b) return;
    setHistorial((h) => ({ atras: [...h.atras, { grupos: b.grupos, posiciones: b.posiciones, bloqueos: b.bloqueos }].slice(-60), adelante: [] }));
    setB({ ...b, ...cambio });
    if (marcarAjuste && cambio.posiciones) setAjustado(true);
    setSucio(true);
    setSeleccion(null);
    setRevisionServidor(null);
  }
  function deshacer() {
    if (!b || !historial.atras.length) return;
    const previo = historial.atras[historial.atras.length - 1];
    setHistorial((h) => ({ atras: h.atras.slice(0, -1), adelante: [{ grupos: b.grupos, posiciones: b.posiciones, bloqueos: b.bloqueos }, ...h.adelante] }));
    setB({ ...b, ...previo });
    setSucio(true);
    setSeleccion(null);
  }
  function rehacer() {
    if (!b || !historial.adelante.length) return;
    const sig = historial.adelante[0];
    setHistorial((h) => ({ atras: [...h.atras, { grupos: b.grupos, posiciones: b.posiciones, bloqueos: b.bloqueos }], adelante: h.adelante.slice(1) }));
    setB({ ...b, ...sig });
    setSucio(true);
    setSeleccion(null);
  }
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement;
      if (objetivo.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) rehacer();
        else deshacer();
      } else if (e.key === "Escape") setSeleccion(null);
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  });

  // ---------- Despachos ----------
  async function puedeDescartar() {
    return !sucio || (await confirmarDescartar("Hay cambios sin guardar en este despacho."));
  }

  function reiniciarEditor() {
    setRejilla(null);
    setRejillaDe("");
    setSucio(false);
    setAjustado(false);
    setSeleccion(null);
    setRevisionServidor(null);
    setMotivoSinLugar(null);
    setHistorial({ atras: [], adelante: [] });
    setEntregas([]);
    setColocando(null);
    setPedidosBase([]);
    setAsignados(null);
    setRutaDia(null);
    actualizadoRef.current = null;
  }

  async function nuevo() {
    if (!(await puedeDescartar())) return;
    reiniciarEditor();
    setB(borradorNuevo(furgones, canastillas));
  }

  async function abrir(id: number, forzar = false) {
    if ((!forzar && b?.id === id) || (!forzar && !(await puedeDescartar()))) return;
    try {
      const p = await obtenerPlano(id);
      reiniciarEditor();
      setB({
        id: p.id,
        nombre: p.nombre,
        fecha: p.fecha,
        furgon: p.furgon,
        tipo: p.tipo_canastilla,
        grupos: p.grupos,
        posiciones: p.posiciones,
        bloqueos: p.bloqueos ?? [],
        notas: p.notas,
        estado: p.estado,
      });
      // Un plano guardado se ve con SU esquema, aunque el vehículo se edite después.
      setRejilla(p.medidas);
      setRejillaDe(`${p.furgon}:${p.tipo_canastilla}`);
      setAjustado(true);
      setRevisionServidor(p.revision);
      setEntregas(p.entregas ?? []);
      setPedidosBase(p.pedidos_detalle.map((x) => ({ pedido: x.id, grupo: x.grupo, canastillas: x.canastillas })));
      actualizadoRef.current = p.actualizado;
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo abrir el despacho."));
    }
  }

  function cambiar(parcial: Partial<Borrador>) {
    setB((x) => (x ? { ...x, ...parcial } : x));
    setSucio(true);
    setRevisionServidor(null);
  }

  function cambiarGrupos(grupos: GrupoCarga[]) {
    if (!b) return;
    const actuales = asignados ?? pedidosBase;
    const ids = new Set(grupos.map((g) => g.id));
    if (actuales.some((a) => !ids.has(a.grupo))) setAsignados(actuales.filter((a) => ids.has(a.grupo)));
    const posiciones = !ajustado && rejilla ? autoAcomodar(grupos, rejilla, b.posiciones, b.bloqueos) : depurar(grupos, b.posiciones);
    aplicar({ grupos, posiciones }, false);
  }

  function agregarDestino() {
    if (!b) return;
    const usados = new Set(b.grupos.map((g) => g.color));
    const color = COLORES_GRUPO.find((c) => !usados.has(c)) ?? COLORES_GRUPO[b.grupos.length % COLORES_GRUPO.length];
    const orden = b.grupos.reduce((m, g) => Math.max(m, g.orden), 0) + 1;
    const numero = b.grupos.reduce((m, g) => Math.max(m, g.numero ?? g.orden), 0) + 1;
    cambiarGrupos([...b.grupos, { id: nuevoId(), nombre: `Destino ${numero}`, cantidad: 10, orden, numero, color }]);
  }

  function editarGrupo(id: string, parcial: Partial<GrupoCarga>) {
    if (!b) return;
    cambiarGrupos(b.grupos.map((g) => (g.id === id ? { ...g, ...parcial } : g)));
  }

  /**
   * Agrega puntos de la ruta como destinos, con sus pedidos reales vinculados
   * y las canastillas estimadas por las reglas de carga.
   */
  function agregarPuntos(puntos: PuntoRuta[]) {
    if (!b || !puntos.length) return;
    const nuevos: GrupoCarga[] = [];
    const nuevosPedidos: PedidoAsignado[] = [];
    const nuevasEntregas: EntregaDestino[] = [];
    let orden = b.grupos.reduce((m, g) => Math.max(m, g.orden), 0);
    let numero = b.grupos.reduce((m, g) => Math.max(m, g.numero ?? g.orden), 0);
    const usados = new Set(b.grupos.map((g) => g.color));
    for (const pt of puntos) {
      if (grupoDeCliente(pt.cliente)) continue;
      const id = `c${pt.cliente}`;
      const canastillas = pt.pedidos.length ? Math.max(1, Math.ceil(pt.pedidos.reduce((a, x) => a + (x.fraccion || 0), 0) - 1e-9)) : 1;
      const color = COLORES_GRUPO.find((c) => !usados.has(c)) ?? COLORES_GRUPO[(b.grupos.length + nuevos.length) % COLORES_GRUPO.length];
      usados.add(color);
      nuevos.push({ id, nombre: pt.nombre.slice(0, 80), cantidad: canastillas, orden: ++orden, numero: ++numero, color, cliente: pt.cliente, ...(pt.direccion ? { direccion: pt.direccion.slice(0, 300) } : {}) });
      pt.pedidos.forEach((x, k) => nuevosPedidos.push({ pedido: x.id, grupo: id, canastillas: k === 0 ? canastillas : 0 }));
      nuevasEntregas.push({
        grupo: id, orden, numero, cliente_id: pt.cliente, nombre: pt.nombre, direccion: pt.direccion, telefono: pt.pedidos[0]?.telefono ?? "",
        recibe: pt.pedidos[0]?.recibe ?? "", canastillas,
        pedidos: pt.pedidos.map((x) => ({ id: x.id, estado: x.estado, observaciones: x.observaciones, indicaciones: x.indicaciones })),
        productos: pt.pedidos.flatMap((x) => x.productos), peso_kg: null, sin_regla: [...new Set(pt.pedidos.flatMap((x) => x.sin_regla))],
      });
    }
    if (!nuevos.length) return;
    cambiarGrupos([...b.grupos, ...nuevos]);
    if (nuevosPedidos.length) setAsignados([...(asignados ?? pedidosBase), ...nuevosPedidos]);
    setEntregas((e) => [...e, ...nuevasEntregas]);
  }

  /** Sube o baja un destino en el orden de entrega (intercambia con el vecino). */
  function moverOrden(id: string, delta: -1 | 1) {
    if (!b) return;
    const ordenados = [...b.grupos].sort((x, y) => x.orden - y.orden);
    const i = ordenados.findIndex((g) => g.id === id);
    const j = i + delta;
    if (j < 0 || j >= ordenados.length) return;
    const renumerado = ordenados.map((g, k) => ({ ...g, orden: k + 1 }));
    [renumerado[i].orden, renumerado[j].orden] = [renumerado[j].orden, renumerado[i].orden];
    cambiarGrupos(renumerado);
  }

  async function reacomodar() {
    if (!b || !rejilla) return;
    if (ajustado && !(await confirmarAccion("¿Acomodar la carga automáticamente?", "Se reemplazan los cambios hechos a mano (salvo las posiciones bloqueadas).", "Sí, acomodar"))) return;
    aplicar({ posiciones: autoAcomodar(b.grupos, rejilla, b.posiciones, b.bloqueos) }, false);
    setAjustado(false);
  }

  function payload() {
    if (!b || b.furgon === "" || b.tipo === "") return null;
    return {
      nombre: b.nombre.trim(),
      fecha: b.fecha,
      furgon: b.furgon,
      tipo_canastilla: b.tipo,
      grupos: b.grupos.map((g) => ({ ...g, nombre: g.nombre.trim() || "Sin nombre" })),
      posiciones: b.posiciones.map(({ grupo, pila, nivel }) => ({ grupo, pila, nivel })),
      bloqueos: b.bloqueos,
      notas: b.notas,
      ...(asignados !== null ? { pedidos: pedidosParaGuardar(b.grupos, asignados) } : {}),
    };
  }

  async function guardar(): Promise<number | null> {
    const datos = payload();
    if (!b || !datos) return null;
    setGuardando(true);
    try {
      const p = await guardarPlano(datos, b.id);
      setB((x) => (x ? { ...x, id: p.id, grupos: p.grupos, posiciones: p.posiciones, estado: p.estado } : x));
      setPedidosBase(p.pedidos_detalle.map((x) => ({ pedido: x.id, grupo: x.grupo, canastillas: x.canastillas })));
      setAsignados(null);
      actualizadoRef.current = p.actualizado;
      setRejilla(p.medidas);
      // Ya guardado, su esquema es el del servidor: no se recalcula ni se reacomoda.
      setRejillaDe(`${p.furgon}:${p.tipo_canastilla}`);
      setRevisionServidor(p.revision);
      setEntregas(p.entregas ?? []);
      setSucio(false);
      setPlanos(await listarPlanos());
      alertaExito("Despacho guardado");
      return p.id;
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar el despacho."));
      return null;
    } finally {
      setGuardando(false);
    }
  }

  async function confirmar() {
    if (!b) return;
    const id = sucio || !b.id ? await guardar() : b.id;
    if (!id) return;
    try {
      const p = await confirmarPlano(id);
      setB((x) => (x ? { ...x, estado: p.estado } : x));
      setRevisionServidor(p.revision);
      setEntregas(p.entregas ?? []);
      setPlanos(await listarPlanos());
      alertaExito("Despacho confirmado");
    } catch (e) {
      const datos = (e as { response?: { data?: { revision?: Revision } } }).response?.data;
      if (datos?.revision) setRevisionServidor(datos.revision);
      alertaError(extraerMensajeError(e, "El despacho tiene errores: revísalos antes de confirmar."));
    }
  }

  async function reabrir() {
    if (!b?.id) return;
    try {
      const p = await reabrirPlano(b.id);
      setB((x) => (x ? { ...x, estado: p.estado } : x));
      setPlanos(await listarPlanos());
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo reabrir el despacho."));
    }
  }

  async function duplicar() {
    if (!b?.id || !(await puedeDescartar())) return;
    try {
      const copia = await duplicarPlano(b.id, diaSiguiente(b.fecha));
      setPlanos(await listarPlanos());
      await abrir(copia.id, true);
      alertaExito("Despacho duplicado para el día siguiente");
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo duplicar el despacho."));
    }
  }

  async function exportarPdf() {
    if (!b) return;
    const id = sucio || !b.id ? await guardar() : b.id;
    if (!id) return;
    try {
      const blob = await descargarPdfPlano(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo generar el PDF."));
    }
  }

  async function eliminar() {
    if (!b?.id || !(await confirmarEliminar(`¿Eliminar el despacho «${b.nombre}»?`, "Esta acción no se puede deshacer."))) return;
    try {
      await eliminarPlano(b.id);
      setB(null);
      reiniciarEditor();
      setPlanos(await listarPlanos());
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar el despacho."));
    }
  }

  async function recargar() {
    setActualizando(true);
    await cargarCatalogos();
    setActualizando(false);
  }

  async function volver() {
    if (!(await puedeDescartar())) return;
    setB(null);
    reiniciarEditor();
  }

  async function abrirPdf(id: number) {
    try {
      const blob = await descargarPdfPlano(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo generar el PDF."));
    }
  }

  async function duplicarDesde(id: number, fecha: string) {
    try {
      const copia = await duplicarPlano(id, diaSiguiente(fecha));
      setPlanos(await listarPlanos());
      await abrir(copia.id, true);
      alertaExito("Despacho duplicado para el día siguiente");
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo duplicar el despacho."));
    }
  }

  async function eliminarDesde(id: number, nombre: string) {
    if (!(await confirmarEliminar(`¿Eliminar el despacho «${nombre}»?`, "Esta acción no se puede deshacer."))) return;
    try {
      await eliminarPlano(id);
      setPlanos(await listarPlanos());
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar el despacho."));
    }
  }

  function conteoSegmento(seg: Segmento): number {
    if (seg === "borrador") return conteos.borradores;
    if (seg === "confirmado") return conteos.confirmados;
    if (seg === "proximos") return conteos.proximos;
    return conteos.total;
  }

  // ---------- Interacción con la carga ----------
  /**
   * Coloca en esa posición las canastillas pendientes del destino elegido:
   * llena la pila hasta el máximo de apilado (un toque por fila).
   */
  function colocarEn(pila: number) {
    if (!b || !rejilla || !colocando) return;
    const faltan = pendientesPorGrupo(b.grupos, b.posiciones).get(colocando) ?? 0;
    if (faltan <= 0) return setColocando(null);
    const altura = contenidoPila(b.posiciones, pila).length;
    const caben = Math.min(faltan, rejilla.niveles - altura);
    if (caben <= 0) {
      alertaError(`Esa posición ya tiene ${rejilla.niveles} canastillas: es el máximo de apilado.`);
      return;
    }
    const nuevas = Array.from({ length: caben }, (_, k) => ({ grupo: colocando, pila, nivel: altura + k }));
    aplicar({ posiciones: [...b.posiciones, ...nuevas] });
    if (faltan - caben <= 0) setColocando(null);
  }

  /** Saca del furgón todas las canastillas de un destino para colocarlas en otras filas. */
  function retirarDestino(id: string) {
    if (!b) return;
    aplicar({ posiciones: depurar(b.grupos.map((g) => (g.id === id ? { ...g, cantidad: 0 } : g)), b.posiciones) });
    setColocando(id);
  }

  function alTocarCanastilla(p: Posicion) {
    if (!b) return;
    if (colocando && editable) return colocarEn(p.pila);
    if (!editable || !seleccion) return setSeleccion(p);
    const misma = seleccion.pila === p.pila && seleccion.nivel === p.nivel;
    if (misma) return setSeleccion(null);
    if (seleccion.grupo === p.grupo) return setSeleccion(p);
    aplicar({ posiciones: intercambiar(b.posiciones, seleccion, p) });
  }

  function alTocarPila(pila: number) {
    if (colocando && editable) return colocarEn(pila);
    if (!b || !seleccion || !rejilla) return;
    aplicar({ posiciones: moverAPila(b.posiciones, seleccion, pila, rejilla) });
  }

  function seleccionarPila(pila: number | null) {
    if (!b || pila === null) return setSeleccion(null);
    const cont = contenidoPila(b.posiciones, pila);
    setSeleccion(cont.length ? cont[cont.length - 1] : null);
  }

  function moverEntrePilas(desde: number, hacia: number) {
    if (!b || !rejilla) return;
    const cont = contenidoPila(b.posiciones, desde);
    if (!cont.length) return;
    if (contenidoPila(b.posiciones, hacia).length >= rejilla.niveles) {
      alertaError(`${filaDePila(rejilla.pilas[hacia]).titulo} (${filaDePila(rejilla.pilas[hacia]).lado.toLowerCase()}) ya tiene ${rejilla.niveles} canastillas: es el máximo de apilado.`);
      return;
    }
    aplicar({ posiciones: moverAPila(b.posiciones, cont[cont.length - 1], hacia, rejilla) });
  }

  function alternarBloqueo(pila: number) {
    if (!b) return;
    const bloqueos = b.bloqueos.includes(pila) ? b.bloqueos.filter((x) => x !== pila) : [...b.bloqueos, pila].sort((x, y) => x - y);
    aplicar({ bloqueos }, false);
  }

  // ---------- Derivados ----------
  const pendientes = useMemo(() => (b ? pendientesPorGrupo(b.grupos, b.posiciones) : new Map<string, number>()), [b]);
  const totalPendientes = [...pendientes.values()].reduce((a, n) => a + n, 0);
  const totalCanastillas = b?.grupos.reduce((a, g) => a + g.cantidad, 0) ?? 0;
  const ubicadas = b?.posiciones.length ?? 0;
  const ocupacion = rejilla?.capacidad ? Math.round((ubicadas / rejilla.capacidad) * 100) : 0;
  const volCanastilla = rejilla ? (rejilla.canastilla.largo * rejilla.canastilla.ancho * rejilla.canastilla.alto) / 1e6 : 0;
  const volFurgon = rejilla ? (rejilla.furgon.largo * rejilla.furgon.ancho * rejilla.furgon.alto) / 1e6 : 0;
  const pesoLleno = tipoActual?.peso_lleno_kg ? Number(tipoActual.peso_lleno_kg) : null;
  const pesoEstimado = pesoLleno != null ? ubicadas * pesoLleno : null;
  const entregaDe = useMemo(() => new Map(entregas.map((e) => [e.grupo, e])), [entregas]);

  /** Los puntos de la ruta del día, en su orden, con los pedidos que aún pueden ir en este despacho. */
  const puntosRuta = useMemo<PuntoRuta[]>(() => {
    if (!rutaDia) return [];
    const propio = (p: PedidoPlanificacion) => !p.despacho || p.despacho.id === idB;
    const lista = new Map<number, PuntoRuta>();
    rutaDia.ruta_paradas.forEach((rp, i) =>
      lista.set(rp.cliente_id, { cliente: rp.cliente_id, nombre: rp.nombre, direccion: rp.direccion, ordenRuta: i + 1, pedidos: [] })
    );
    for (const par of rutaDia.paradas) {
      if (par.cliente_id === null) continue;
      const e = lista.get(par.cliente_id) ?? { cliente: par.cliente_id, nombre: par.nombre, direccion: par.direccion, ordenRuta: lista.size + 1, pedidos: [] };
      e.pedidos = par.pedidos.filter(propio);
      lista.set(par.cliente_id, e);
    }
    return [...lista.values()].sort((x, y) => x.ordenRuta - y.ordenRuta);
  }, [rutaDia, idB]);
  const grupoDeCliente = (cliente: number) => b?.grupos.find((g) => g.cliente === cliente || g.id === `c${cliente}`);
  const puntosFaltantes = puntosRuta.filter((pt) => !grupoDeCliente(pt.cliente));
  const porFilas = useMemo(() => (b && rejilla ? cargaPorFilas(rejilla, b.posiciones) : []), [b, rejilla]);
  /** «Pedido #12» o «Pedidos #12, #13»; vacío si el destino no viene de pedidos. */
  const pedidosTexto = (gid: string) => {
    const e = entregaDe.get(gid);
    return e?.pedidos.length ? `Pedido${e.pedidos.length === 1 ? "" : "s"} ${e.pedidos.map((x) => "#" + x.id).join(", ")}` : "";
  };

  /** La misma revisión que hace el servidor, calculada en vivo. */
  const revision = useMemo(() => {
    const errores: string[] = [];
    const avisos: string[] = [];
    if (!b || !rejilla) return { errores, avisos };
    if (!b.nombre.trim()) errores.push("Falta el nombre del despacho.");
    if (!b.grupos.length) errores.push("El despacho no tiene destinos.");
    if (totalPendientes) errores.push(`Faltan ${totalPendientes} canastillas por ubicar.`);
    const ordenes = b.grupos.map((g) => g.orden);
    if (new Set(ordenes).size !== ordenes.length) errores.push("Dos destinos tienen el mismo orden de entrega.");
    errores.push(...(rejilla.errores ?? []));
    const carga = furgonActual?.carga_util_kg ?? null;
    if (pesoEstimado != null && carga) {
      if (pesoEstimado > carga) errores.push(`El peso estimado (${Math.round(pesoEstimado)} kg) supera la carga útil (${carga} kg).`);
    } else {
      avisos.push(`No se puede validar el peso: falta ${!carga ? "la carga útil del vehículo" : "el peso de la canastilla llena"}.`);
    }
    if (furgonActual && !furgonActual.medidas_verificadas) avisos.push("Las medidas interiores del furgón no están verificadas.");
    avisos.push(...(rejilla.avisos ?? []), ...estorbosDeOrden(b.grupos, b.posiciones, rejilla));
    if (motivoSinLugar && totalPendientes) avisos.unshift(motivoSinLugar);
    return { errores, avisos };
  }, [b, rejilla, totalPendientes, furgonActual, pesoEstimado, motivoSinLugar]);

  const sinMedidas = furgones.length === 0 || canastillas.length === 0;

  // ---------- Lista de despachos (la vista de gestión) ----------
  const manana = diaSiguiente(hoy());
  const conteos = useMemo(
    () => ({
      total: planos.length,
      borradores: planos.filter((p) => p.estado === "BORRADOR").length,
      confirmados: planos.filter((p) => p.estado === "CONFIRMADO").length,
      proximos: planos.filter((p) => p.fecha >= hoy()).length,
      manana: planos.filter((p) => p.fecha === manana),
      canastillasProximas: planos.filter((p) => p.fecha >= hoy()).reduce((a, p) => a + p.total_canastillas, 0),
    }),
    [planos, manana]
  );

  const coincideKpi: Record<Segmento, boolean> = {
    todos: !busqueda && segmento === "todos",
    manana: !busqueda && segmento === "manana",
    borrador: !busqueda && segmento === "borrador",
    confirmado: !busqueda && segmento === "confirmado",
    proximos: !busqueda && segmento === "proximos",
  };
  const kpiActivo = kpiPulsado && coincideKpi[kpiPulsado] ? kpiPulsado : null;
  function aplicarKpi(clave: Segmento) {
    setBusqueda("");
    if (kpiActivo === clave) {
      setKpiPulsado(null);
      setSegmento("todos");
      return;
    }
    setKpiPulsado(clave);
    setSegmento(clave);
  }

  const lista = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    let l = planos;
    if (segmento === "borrador") l = l.filter((p) => p.estado === "BORRADOR");
    else if (segmento === "confirmado") l = l.filter((p) => p.estado === "CONFIRMADO");
    else if (segmento === "proximos") l = l.filter((p) => p.fecha >= hoy());
    else if (segmento === "manana") l = l.filter((p) => p.fecha === manana);
    if (q) l = l.filter((p) => normalizarTexto(`${p.nombre} ${p.furgon_nombre} ${p.fecha}`).includes(q));
    return ordenar(l, EXTRACTORES_DESPACHOS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planos, segmento, busqueda, manana, columnaOrden, direccionOrden]);
  const pag = usePaginacion(lista, "despachos", [busqueda, segmento]);
  const hayFiltros = Boolean(busqueda || segmento !== "todos");
  function limpiarFiltros() {
    setBusqueda("");
    setSegmento("todos");
    setKpiPulsado(null);
  }

  function accionesDe(p: PlanoResumen): AccionMenu[] {
    const acciones: AccionMenu[] = [
      { clave: "pdf", tono: "info", etiqueta: "Descargar PDF", icono: <FileDown size={15} />, onSeleccionar: () => abrirPdf(p.id) },
    ];
    if (puedeArmar) {
      acciones.push({
        clave: "duplicar",
        tono: "copiar",
        etiqueta: "Duplicar para el día siguiente",
        icono: <Copy size={15} />,
        onSeleccionar: () => duplicarDesde(p.id, p.fecha),
      });
      if (p.estado === "BORRADOR")
        acciones.push({ clave: "eliminar", etiqueta: "Eliminar despacho", icono: <Trash2 size={15} />, peligro: true, onSeleccionar: () => eliminarDesde(p.id, p.nombre) });
    }
    return acciones;
  }

  // ---------- Derivados del editor ----------
  const grupoSel = seleccion ? b?.grupos.find((g) => g.id === seleccion.grupo) : undefined;
  const grupoColocando = colocando ? b?.grupos.find((g) => g.id === colocando) : undefined;
  const pilaSel = seleccion && rejilla ? rejilla.pilas[seleccion.pila] : undefined;
  const valido = !!b && !!b.nombre.trim() && b.furgon !== "" && b.tipo !== "" && b.grupos.length > 0 && !!rejilla;
  const sobrePeso = pesoEstimado != null && !!furgonActual?.carga_util_kg && pesoEstimado > furgonActual.carga_util_kg;

  const botonActualizar = (
    <Tooltip label="Actualizar" posicion="abajo">
      <button type="button" className="btn-icon gestion-actualizar-icono" onClick={recargar} disabled={actualizando} aria-label="Actualizar despachos">
        <RefreshCw size={16} className={actualizando ? "girando" : ""} />
      </button>
    </Tooltip>
  );

  // ===================== Vehículos y canastillas =====================
  const infoPestana = PESTANAS.find((x) => x.clave === pestana)!;
  const navegacion = (
    <nav className="pl-nav" aria-label="Módulos de logística">
      {PESTANAS.filter((x) => x.clave !== "medidas" || puedeAdministrar || furgones.length).map((x) => (
        <button key={x.clave} type="button" className={pestana === x.clave ? "activo" : ""} aria-current={pestana === x.clave ? "page" : undefined} onClick={() => setPestana(x.clave)}>
          {x.icono}
          {x.etiqueta}
        </button>
      ))}
    </nav>
  );
  const cabecera = (acciones?: ReactNode) => (
    <div className="topbar gestion-topbar">
      <div className="gestion-titulo">
        <h1>{infoPestana.titulo}</h1>
        <p>{infoPestana.texto}</p>
      </div>
      {acciones && <div className="gestion-topbar-acciones">{acciones}</div>}
    </div>
  );

  if (!b && pestana === "medidas") {
    return (
      <>
        {cabecera()}
        <div className="contenido gestion-vista plano">
          {navegacion}
          <ConfigMedidas furgones={furgones} canastillas={canastillas} puedeAdministrar={puedeAdministrar} onCambio={cargarCatalogos} />
          <ReglasCarga puedeAdministrar={puedeAdministrar} />
        </div>
      </>
    );
  }

  if (!b && pestana === "rutas") {
    return (
      <>
        {cabecera()}
        <div className="contenido gestion-vista plano">
          {navegacion}
          {cargando ? <div className="panel pl-cargando">Cargando…</div> : <RutasSemanales furgones={furgones} puedeAdministrar={puedeAdministrar} />}
        </div>
      </>
    );
  }

  if (!b && pestana === "centro") {
    return (
      <>
        {cabecera()}
        <div className="contenido gestion-vista plano">
          {navegacion}
          {cargando ? (
            <div className="panel pl-cargando">Cargando…</div>
          ) : (
            <CentroPlanificacion
              key={canastillas.length}
              fecha={fechaCentro}
              onFecha={setFechaCentro}
              furgones={furgones}
              canastillas={canastillas}
              puedeArmar={puedeArmar}
              onAbrirDespacho={(id) => abrir(id, true)}
              onIrARutas={() => setPestana("rutas")}
              onDespachosCambiaron={() => listarPlanos().then(setPlanos).catch(() => undefined)}
            />
          )}
        </div>
      </>
    );
  }

  // ===================== Lista de despachos =====================
  if (!b) {
    const columnas = 1 + columnasVisibles.length;
    const sinFilas = !cargando && lista.length === 0;
    let cuerpoVacio: ReactNode = null;
    if (sinMedidas) {
      cuerpoVacio = (
        <EstadoVacio
          icono={<Truck size={20} />}
          titulo="Primero registra un furgón y una canastilla"
          texto="El plano se arma con sus medidas reales: qué cabe en la fila delantera, en cada lateral y hacia arriba."
          accion={
            puedeAdministrar && (
              <button type="button" className="btn primario sm" onClick={() => setPestana("medidas")}>
                <Settings2 size={14} /> Configurar vehículos
              </button>
            )
          }
        />
      );
    } else if (planos.length === 0) {
      cuerpoVacio = (
        <EstadoVacio
          icono={<Layers size={20} />}
          titulo="Aún no hay despachos"
          texto="Crea el primero: agregas los destinos con su orden de entrega y el sistema acomoda las canastillas en el furgón."
          accion={
            puedeArmar && (
              <button type="button" className="btn primario sm" onClick={nuevo}>
                <Plus size={14} /> Nuevo despacho
              </button>
            )
          }
        />
      );
    } else {
      cuerpoVacio = (
        <EstadoVacio
          icono={<SearchX size={20} />}
          titulo="Ningún despacho coincide con los filtros"
          texto={busqueda ? `No hay resultados para "${busqueda}".` : "Prueba con otra pestaña."}
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
            <h1>{infoPestana.titulo}</h1>
            <p>{infoPestana.texto}</p>
          </div>
          <div className="gestion-topbar-acciones">
            {botonActualizar}
            {puedeArmar && (
              <button type="button" className="btn primario" onClick={nuevo} disabled={sinMedidas}>
                <Plus size={16} /> Nuevo despacho
              </button>
            )}
          </div>
        </div>

        <div className="contenido gestion-vista plano">
          {navegacion}
          <div className="kpis-gestion">
            <TarjetaKpi
              tono="neutro"
              icono={<Truck size={18} />}
              etiqueta="Total despachos"
              valor={cargando ? null : conteos.total.toLocaleString("es-CO")}
              activa={kpiActivo === "todos"}
              descripcion="Ver todos los despachos"
              onClick={() => aplicarKpi("todos")}
            />
            <TarjetaKpi
              tono="azul"
              icono={<CalendarClock size={18} />}
              etiqueta="Para mañana"
              valor={cargando ? null : conteos.manana.length.toLocaleString("es-CO")}
              pie={!cargando && `${conteos.manana.reduce((a, p) => a + p.total_canastillas, 0).toLocaleString("es-CO")} canastillas`}
              activa={kpiActivo === "manana"}
              descripcion="Ver los despachos de mañana"
              onClick={() => aplicarKpi("manana")}
            />
            <TarjetaKpi
              tono="ambar"
              icono={<FilePen size={18} />}
              etiqueta="Borradores"
              valor={cargando ? null : conteos.borradores.toLocaleString("es-CO")}
              activa={kpiActivo === "borrador"}
              descripcion="Ver los despachos que aún no se confirman"
              onClick={() => aplicarKpi("borrador")}
            />
            <TarjetaKpi
              tono="verde"
              icono={<ShieldCheck size={18} />}
              etiqueta="Confirmados"
              valor={cargando ? null : conteos.confirmados.toLocaleString("es-CO")}
              activa={kpiActivo === "confirmado"}
              descripcion="Ver los despachos confirmados"
              onClick={() => aplicarKpi("confirmado")}
            />
            <TarjetaKpi
              tono="violeta"
              icono={<Package size={18} />}
              etiqueta="Canastillas programadas"
              valor={cargando ? null : conteos.canastillasProximas.toLocaleString("es-CO")}
              pie={!cargando && `en ${conteos.proximos} despacho${conteos.proximos === 1 ? "" : "s"} desde hoy`}
              activa={kpiActivo === "proximos"}
              descripcion="Ver los despachos de hoy en adelante"
              onClick={() => aplicarKpi("proximos")}
            />
          </div>

          <section className="panel gestion-modulo" aria-label="Lista de despachos">
            <div className="gestion-modulo-cab">
              <div className="gestion-tabs" role="tablist" aria-label="Estado">
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
                    {!cargando && <span className="gestion-tab-num">{conteoSegmento(o.valor)}</span>}
                  </button>
                ))}
              </div>
              <p className="gestion-meta" aria-live="polite">
                {cargando ? (
                  "Cargando…"
                ) : (
                  <>
                    <strong>{lista.length.toLocaleString("es-CO")}</strong> despacho{lista.length === 1 ? "" : "s"}
                    {hayFiltros ? ` de ${planos.length.toLocaleString("es-CO")}` : ""}
                  </>
                )}
              </p>
            </div>

            <div className="gestion-toolbar">
              <div className="buscador gestion-buscador">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Buscar por despacho, vehículo o fecha…"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setKpiPulsado(null);
                  }}
                  aria-label="Buscar despachos"
                />
                {busqueda && (
                  <button type="button" className="gestion-buscador-fin gestion-buscador-limpiar" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">
                    <X size={14} />
                  </button>
                )}
              </div>
              {hayFiltros && (
                <button type="button" className="btn-limpiar" onClick={limpiarFiltros}>
                  <X size={14} /> Limpiar filtros
                </button>
              )}
              <ColumnPickerButton estado={columnasEstado} etiquetas={ETIQUETAS_DESPACHOS} onAlternar={alternarColumna} onRestablecer={restablecerColumnas} />
            </div>

            <div className={`tabla-scroll gestion-tabla-scroll ${actualizando && !cargando ? "actualizando" : ""}`} aria-busy={actualizando}>
              <table className={`gestion-tabla ${sinFilas ? "sin-filas" : ""}`}>
                <thead>
                  <tr>
                    {columnasVisibles.map((clave) => (
                      <ThOrdenable
                        key={clave}
                        clave={clave}
                        etiqueta={ETIQUETAS_DESPACHOS[clave]}
                        className={DEFINICIONES_DESPACHOS[clave].clase}
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
                  {cargando ? (
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
                    pag.visibles.map((p) => (
                      <tr
                        key={p.id}
                        className="fila-clicable"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, a, input, [role=menu]")) return;
                          abrir(p.id);
                        }}
                      >
                        {columnasVisibles.map((clave) => (
                          <td key={clave} className={DEFINICIONES_DESPACHOS[clave].clase}>
                            {DEFINICIONES_DESPACHOS[clave].render(p)}
                          </td>
                        ))}
                        <td className="col-acciones">
                          <div className="acciones">
                            <Tooltip label={puedeArmar && p.estado === "BORRADOR" ? "Abrir y editar" : "Abrir"}>
                              <button
                                type="button"
                                className={`btn-icon ${puedeArmar && p.estado === "BORRADOR" ? "editar" : "ver"}`}
                                onClick={() => abrir(p.id)}
                                aria-label={`Abrir el despacho ${p.nombre}`}
                              >
                                {puedeArmar && p.estado === "BORRADOR" ? <Pencil size={16} /> : <Eye size={16} />}
                              </button>
                            </Tooltip>
                            <MenuFila etiqueta={`Más acciones de ${p.nombre}`} acciones={accionesDe(p)} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!cargando && lista.length > 0 && <Paginacion {...pag} etiqueta="despachos" />}
          </section>
        </div>
      </>
    );
  }

  // ===================== Editor del despacho =====================
  const estadoPastilla = (
    <Pastilla tono={b.estado === "CONFIRMADO" ? "verde" : "ambar"}>{b.estado === "CONFIRMADO" ? "Confirmado" : "Borrador"}</Pastilla>
  );
  const masAcciones: AccionMenu[] = [];
  if (editable)
    masAcciones.push({
      clave: "acomodar",
      tono: "info",
      etiqueta: "Acomodar automáticamente",
      icono: <Wand2 size={15} />,
      onSeleccionar: reacomodar,
      deshabilitada: !rejilla || !b.grupos.length,
    });
  if (puedeArmar && b.estado === "CONFIRMADO")
    masAcciones.push({ clave: "reabrir", tono: "editar", etiqueta: "Reabrir para editar", icono: <RotateCcw size={15} />, onSeleccionar: reabrir });
  if (puedeArmar && b.id) {
    masAcciones.push({ clave: "duplicar", tono: "copiar", etiqueta: "Duplicar para el día siguiente", icono: <Copy size={15} />, onSeleccionar: duplicar });
    if (b.estado === "BORRADOR")
      masAcciones.push({ clave: "eliminar", etiqueta: "Eliminar despacho", icono: <Trash2 size={15} />, peligro: true, onSeleccionar: eliminar });
  }

  return (
    <>
      <div className="topbar gestion-topbar">
        <div className="plano-topbar-titulo">
          <Tooltip label={pestana === "centro" ? "Volver al centro del día" : "Volver a los despachos"} posicion="abajo">
            <button type="button" className="btn-icon plano-volver" onClick={volver} aria-label={pestana === "centro" ? "Volver al centro del día" : "Volver a los despachos"}>
              <ArrowLeft size={18} />
            </button>
          </Tooltip>
          <div className="gestion-titulo">
            <h1 className="plano-titulo">
              <span>{b.nombre.trim() || (b.id ? "Despacho sin nombre" : "Nuevo despacho")}</span>
              {estadoPastilla}
            </h1>
            <p>
              {diaDespacho(b.fecha)} · {furgonActual?.nombre ?? "Sin vehículo"}
              {furgonActual?.placa ? ` (${furgonActual.placa})` : ""}
              {sucio && <span className="plano-sucio"> · Cambios sin guardar</span>}
            </p>
          </div>
        </div>
        <div className="gestion-topbar-acciones">
          {editable && (
            <>
              <Tooltip label="Deshacer (Ctrl+Z)" posicion="abajo">
                <button type="button" className="btn-icon gestion-actualizar-icono" onClick={deshacer} disabled={!historial.atras.length} aria-label="Deshacer">
                  <Undo2 size={16} />
                </button>
              </Tooltip>
              <Tooltip label="Rehacer (Ctrl+Shift+Z)" posicion="abajo">
                <button type="button" className="btn-icon gestion-actualizar-icono" onClick={rehacer} disabled={!historial.adelante.length} aria-label="Rehacer">
                  <Redo2 size={16} />
                </button>
              </Tooltip>
            </>
          )}
          <button type="button" className="btn secundario" onClick={exportarPdf} disabled={!valido}>
            <FileDown size={16} /> PDF
          </button>
          {editable && (
            <button type="button" className="btn secundario" onClick={() => guardar()} disabled={!valido || guardando || !sucio}>
              <Save size={16} /> {guardando ? "Guardando…" : "Guardar"}
            </button>
          )}
          {puedeArmar && b.estado === "BORRADOR" && (
            <button type="button" className="btn primario" onClick={confirmar} disabled={!valido || revision.errores.length > 0}>
              <ShieldCheck size={16} /> Confirmar
            </button>
          )}
          {masAcciones.length > 0 && <MenuFila etiqueta="Más acciones del despacho" acciones={masAcciones} />}
        </div>
      </div>

      <div className="contenido gestion-vista plano">
        {/* ---------- Indicadores ---------- */}
        <div className="kpis-gestion">
          <TarjetaKpi
            tono="neutro"
            icono={<Layers size={18} />}
            etiqueta="Capacidad"
            valor={rejilla ? rejilla.capacidad.toLocaleString("es-CO") : null}
            pie={rejilla && `${rejilla.pilas.length} posiciones × ${rejilla.niveles} niveles`}
            descripcion="Canastillas que caben con este vehículo y esta canastilla"
          />
          <TarjetaKpi
            tono="azul"
            icono={<Package size={18} />}
            etiqueta="Ubicadas"
            valor={rejilla ? `${ubicadas} / ${totalCanastillas}` : null}
            pie={`${b.grupos.length} destino${b.grupos.length === 1 ? "" : "s"}`}
            descripcion="Canastillas con posición asignada, de las que lleva el despacho"
          />
          <TarjetaKpi
            tono={ocupacion > 95 ? "ambar" : "verde"}
            icono={<Gauge size={18} />}
            etiqueta="Ocupación"
            valor={rejilla ? `${ocupacion}%` : null}
            pie={rejilla && `${(ubicadas * volCanastilla).toFixed(1)} de ${volFurgon.toFixed(1)} m³`}
            descripcion="Posiciones usadas sobre la capacidad del furgón"
          />
          <TarjetaKpi
            tono={sobrePeso ? "ambar" : "violeta"}
            icono={<Weight size={18} />}
            etiqueta="Peso estimado"
            valor={rejilla ? (pesoEstimado != null ? `${Math.round(pesoEstimado).toLocaleString("es-CO")} kg` : "—") : null}
            pie={furgonActual?.carga_util_kg ? `carga útil ${furgonActual.carga_util_kg.toLocaleString("es-CO")} kg` : "carga útil sin dato"}
            descripcion="Canastillas ubicadas por el peso de una canastilla llena"
          />
          <TarjetaKpi
            tono={totalPendientes ? "ambar" : "neutro"}
            icono={<PackageX size={18} />}
            etiqueta="Sin lugar"
            valor={rejilla ? totalPendientes.toLocaleString("es-CO") : null}
            pie={rejilla && `${rejilla.capacidad - ubicadas} posiciones libres`}
            descripcion="Canastillas del despacho que todavía no tienen posición"
          />
        </div>

        {/* ---------- Datos del despacho ---------- */}
        <section className="panel gestion-modulo plano-datos" aria-label="Datos del despacho">
          <div className="plano-datos-grid">
            <label className="plano-campo plano-campo--nombre">
              <span>Nombre del despacho</span>
              <input value={b.nombre} maxLength={120} placeholder="Ej. Ruta norte · jueves" disabled={!editable} onChange={(e) => cambiar({ nombre: e.target.value })} />
            </label>
            <label className="plano-campo">
              <span>Fecha de entrega</span>
              <input type="date" value={b.fecha} disabled={!editable} onChange={(e) => cambiar({ fecha: e.target.value })} />
            </label>
            <label className="plano-campo">
              <span>Vehículo</span>
              <select value={b.furgon} disabled={!editable} onChange={(e) => cambiar({ furgon: e.target.value ? Number(e.target.value) : "" })}>
                {furgones
                  .filter((f) => f.activo || f.id === b.furgon)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                      {f.placa ? ` · ${f.placa}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="plano-campo">
              <span>Canastilla</span>
              <select value={b.tipo} disabled={!editable} onChange={(e) => cambiar({ tipo: e.target.value ? Number(e.target.value) : "" })}>
                {canastillas
                  .filter((c) => c.activa || c.id === b.tipo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.largo_cm}×{c.ancho_cm}×{c.alto_cm})
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </section>

        <div className="plano-trabajo">
          {/* ---------- Visor ---------- */}
          <section className="panel gestion-modulo plano-visor" aria-label="Visor de la carga">
            <div className="gestion-modulo-cab">
              <div className="gestion-tabs" role="tablist" aria-label="Vista">
                {VISTAS.map((v) => (
                  <button key={v.clave} type="button" role="tab" aria-selected={vista === v.clave} className={vista === v.clave ? "activo" : ""} onClick={() => setVista(v.clave)}>
                    {v.icono}
                    {v.etiqueta}
                  </button>
                ))}
              </div>
              <div className="plano-visor-opciones">
                {vista !== "2d" &&
                  (["techo", "paredes", "puertasAbiertas"] as const).map((k) => (
                    <button key={k} type="button" className={`plano-chip ${opciones[k] ? "activo" : ""}`} aria-pressed={opciones[k]} onClick={() => alternar(k)}>
                      {k === "techo" ? "Techo" : k === "paredes" ? "Paredes" : "Puertas abiertas"}
                    </button>
                  ))}
                {editable && (
                  <button type="button" className="btn secundario sm" onClick={reacomodar} disabled={!rejilla || !b.grupos.length}>
                    <Wand2 size={14} /> Acomodar
                  </button>
                )}
              </div>
            </div>

            <div className="plano-visor-cuerpo">
              {editable && totalPendientes > 0 && rejilla && (
                <div className="plano-bandeja" aria-label="Pedidos por ubicar">
                  <div className="plano-bandeja-cab">
                    <PackageX size={16} />
                    <span>
                      <strong>Pedidos por ubicar</strong> · {totalPendientes} canastilla{totalPendientes === 1 ? "" : "s"}. Elige uno y toca la fila donde va.
                    </span>
                    {ubicadas < rejilla.capacidad && (
                      <button type="button" className="btn secundario sm" onClick={() => aplicar({ posiciones: ubicarPendientes(b.grupos, b.posiciones, rejilla, b.bloqueos, topePeso) })}>
                        <ArrowDownToLine size={14} /> Ubicar todas automáticamente
                      </button>
                    )}
                  </div>
                  <div className="plano-bandeja-items">
                    {[...b.grupos]
                      .sort((x, y) => x.orden - y.orden)
                      .filter((g) => (pendientes.get(g.id) ?? 0) > 0)
                      .map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className={`plano-pedido-chip ${colocando === g.id ? "activo" : ""}`}
                          style={{ "--destino": g.color } as CSSProperties}
                          aria-pressed={colocando === g.id}
                          onClick={() => {
                            setSeleccion(null);
                            setColocando(colocando === g.id ? null : g.id);
                          }}
                        >
                          <span className="plano-pedido-chip-num">{g.numero ?? g.orden}</span>
                          <span className="plano-pedido-chip-texto">
                            <strong>{g.nombre}</strong>
                            <small>
                              {pedidosTexto(g.id) || "Sin pedido asociado"} · faltan {pendientes.get(g.id)}
                            </small>
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {colocando && editable && grupoColocando && (
                <div className="plano-seleccion plano-colocando" role="status" style={{ "--destino": grupoColocando.color } as CSSProperties}>
                  <Hand size={18} />
                  <div className="plano-seleccion-info">
                    <strong>
                      Colocando #{grupoColocando.numero ?? grupoColocando.orden} · {grupoColocando.nombre}
                      {pedidosTexto(grupoColocando.id) ? ` · ${pedidosTexto(grupoColocando.id)}` : ""}
                    </strong>
                    <small>
                      Toca en el 3D o en el plano 2D la fila donde va: cada toque llena esa posición hasta {rejilla?.niveles} de alto. Faltan{" "}
                      {pendientes.get(grupoColocando.id) ?? 0}.
                    </small>
                  </div>
                  <button type="button" className="btn secundario sm" onClick={() => setColocando(null)}>
                    Terminar
                  </button>
                </div>
              )}

              {seleccion && grupoSel && pilaSel && rejilla && (
                <div className="plano-seleccion" role="status">
                  <i className="plano-seleccion-color" style={{ background: grupoSel.color }} />
                  <div className="plano-seleccion-info">
                    <strong>
                      #{grupoSel.numero ?? grupoSel.orden} · {grupoSel.nombre}
                    </strong>
                    <small>
                      {filaDePila(pilaSel).titulo} · {NOMBRE_ZONA[pilaSel.zona]} · nivel {seleccion.nivel + 1} de {contenidoPila(b.posiciones, seleccion.pila).length} ·{" "}
                      {pilaSel.rot === 90 ? "atravesada" : "a lo largo"} · entrega {grupoSel.orden}
                    </small>
                    {editable && <small className="plano-seleccion-ayuda">Toca otra canastilla para intercambiarlas o una posición verde para moverla.</small>}
                  </div>
                  {editable && (
                    <>
                      <button type="button" className="btn secundario sm" onClick={() => alternarBloqueo(seleccion.pila)}>
                        {b.bloqueos.includes(seleccion.pila) ? <LockOpen size={14} /> : <Lock size={14} />}
                        {b.bloqueos.includes(seleccion.pila) ? "Desbloquear" : "Bloquear posición"}
                      </button>
                      <button type="button" className="btn secundario sm plano-btn-peligro" onClick={() => aplicar({ posiciones: quitar(b.posiciones, seleccion) })}>
                        <PackageMinus size={14} /> Retirar
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-icon" aria-label="Cerrar selección" onClick={() => setSeleccion(null)}>
                    <X size={15} />
                  </button>
                </div>
              )}

              {!rejilla ? (
                <div className="plano-3d plano-3d--cargando">Calculando el esquema del furgón…</div>
              ) : vista === "2d" ? (
                <Plano2D
                  rejilla={rejilla}
                  grupos={b.grupos}
                  posiciones={b.posiciones}
                  bloqueos={b.bloqueos}
                  pilaSeleccionada={seleccion?.pila ?? null}
                  resaltado={resaltado}
                  editable={editable}
                  onSeleccionar={seleccionarPila}
                  onMover={moverEntrePilas}
                  colocando={colocando && editable ? (grupoColocando?.color ?? null) : null}
                  onColocar={colocarEn}
                />
              ) : (
                <Suspense fallback={<div className="plano-3d plano-3d--cargando">Cargando el visor 3D…</div>}>
                  <Furgon3D
                    rejilla={rejilla}
                    furgon={furgonActual}
                    opciones={opciones}
                    bloqueos={b.bloqueos}
                    grupos={b.grupos}
                    posiciones={b.posiciones}
                    seleccion={seleccion}
                    resaltado={resaltado}
                    vista={vista}
                    editable={editable}
                    onCanastilla={alTocarCanastilla}
                    onPila={alTocarPila}
                    onFondo={() => setSeleccion(null)}
                    colocando={colocando && editable ? (grupoColocando?.color ?? null) : null}
                  />
                </Suspense>
              )}

              {vista !== "2d" && <p className="plano-visor-ayuda">Arrastra para girar · rueda para acercar · toca una canastilla para seleccionarla</p>}
            </div>
          </section>

          <div className="plano-lateral">
            {/* ---------- Puntos de la ruta ---------- */}
            {rutaDia && puntosRuta.length > 0 && (
              <section className="panel gestion-modulo plano-ruta-puntos" aria-label="Puntos de la ruta">
                <div className="plano-modulo-cab">
                  <div>
                    <h2>
                      <Route size={16} /> Puntos de la ruta
                    </h2>
                    <p>
                      {rutaDia.nombre} · {puntosRuta.length} punto{puntosRuta.length === 1 ? "" : "s"}
                      {puntosFaltantes.length ? ` · ${puntosFaltantes.length} sin agregar` : " · todos en destinos"}
                    </p>
                  </div>
                  {editable && puntosFaltantes.length > 0 && (
                    <button type="button" className="btn primario sm" onClick={() => agregarPuntos(puntosFaltantes)}>
                      <Plus size={14} /> Agregar todos
                    </button>
                  )}
                </div>
                <ol className="plano-puntos">
                  {puntosRuta.map((pt) => {
                    const g = grupoDeCliente(pt.cliente);
                    const faltan = g ? (pendientes.get(g.id) ?? 0) : 0;
                    const ubic = g && rejilla ? ubicacionDe(rejilla, b.posiciones, g.id) : "";
                    const estim = pt.pedidos.length ? Math.max(1, Math.ceil(pt.pedidos.reduce((a, x) => a + (x.fraccion || 0), 0) - 1e-9)) : 0;
                    return (
                      <li key={pt.cliente} className={g ? "agregado" : ""} style={g ? ({ "--destino": g.color } as CSSProperties) : undefined}>
                        <span className="plano-puntos-num">{pt.ordenRuta}</span>
                        <div className="plano-puntos-datos">
                          <strong>{pt.nombre}</strong>
                          <small>
                            {pt.pedidos.length
                              ? `Pedido${pt.pedidos.length === 1 ? "" : "s"} ${pt.pedidos.map((x) => "#" + x.id).join(", ")} · ≈ ${estim} canastilla${estim === 1 ? "" : "s"}`
                              : "Sin pedido para este día"}
                          </small>
                          {g && <small className="plano-puntos-ubic">{ubic ? ubic : "En destinos · falta colocarlo en el furgón"}</small>}
                        </div>
                        {editable && !g && (
                          <button type="button" className="btn secundario sm" onClick={() => agregarPuntos([pt])}>
                            <Plus size={13} /> Agregar
                          </button>
                        )}
                        {editable && g && faltan > 0 && (
                          <button
                            type="button"
                            className={`btn sm ${colocando === g.id ? "primario" : "secundario"}`}
                            onClick={() => {
                              setSeleccion(null);
                              setColocando(colocando === g.id ? null : g.id);
                            }}
                          >
                            <Hand size={13} /> Colocar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* ---------- Destinos ---------- */}
            <section className="panel gestion-modulo plano-destinos" aria-label="Destinos">
              <div className="plano-modulo-cab">
                <div>
                  <h2>Destinos</h2>
                  <p>El orden 1 se entrega primero y va junto a las puertas · filas contadas desde la cabina</p>
                  <div className="gestion-tabs plano-destinos-vista" role="tablist" aria-label="Ver destinos">
                    <button type="button" role="tab" aria-selected={vistaDestinos === "destino"} className={vistaDestinos === "destino" ? "activo" : ""} onClick={() => setVistaDestinos("destino")}>
                      Por destino
                    </button>
                    <button type="button" role="tab" aria-selected={vistaDestinos === "fila"} className={vistaDestinos === "fila" ? "activo" : ""} onClick={() => setVistaDestinos("fila")}>
                      Por fila
                    </button>
                  </div>
                </div>
                {editable && (
                  <button type="button" className="btn secundario sm" onClick={agregarDestino}>
                    <Plus size={14} /> Agregar
                  </button>
                )}
              </div>
              {b.grupos.length === 0 ? (
                <EstadoVacio
                  icono={<MapPin size={20} />}
                  titulo="Sin destinos"
                  texto="Agrega los clientes o restaurantes de este despacho con sus canastillas."
                  accion={
                    editable && (
                      <button type="button" className="btn primario sm" onClick={agregarDestino}>
                        <Plus size={14} /> Agregar destino
                      </button>
                    )
                  }
                />
              ) : vistaDestinos === "fila" ? (
                porFilas.length === 0 ? (
                  <p className="plano-filas-vacio">Todavía no hay canastillas en el furgón.</p>
                ) : (
                  <ol className="plano-filas">
                    {porFilas.map((f) => (
                      <li key={f.clave}>
                        <strong className="plano-filas-titulo">{f.titulo}</strong>
                        <ul>
                          {f.lados.map((l) => (
                            <li key={l.pila}>
                              <span className="plano-filas-lado">{l.lado}</span>
                              <span className="plano-filas-items">
                                {l.grupos.map((x) => {
                                  const g = b.grupos.find((y) => y.id === x.grupo);
                                  if (!g) return null;
                                  return (
                                    <span
                                      key={x.grupo}
                                      className={`plano-filas-item ${resaltado === g.id ? "resaltado" : ""}`}
                                      style={{ "--destino": g.color } as CSSProperties}
                                      onMouseEnter={() => setResaltado(g.id)}
                                      onMouseLeave={() => setResaltado(null)}
                                    >
                                      <b>{g.numero ?? g.orden}</b>
                                      <span>
                                        {pedidosTexto(g.id) ? `${pedidosTexto(g.id)} · ` : ""}
                                        {g.nombre}
                                      </span>
                                      <em>×{x.canastillas}</em>
                                    </span>
                                  );
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )
              ) : (
                <ol className="plano-destinos-lista">
                  {[...b.grupos]
                    .sort((x, y) => x.orden - y.orden)
                    .map((g, i, todos) => {
                      const faltan = pendientes.get(g.id) ?? 0;
                      const entrega = entregaDe.get(g.id);
                      const ubicacion = rejilla ? ubicacionDe(rejilla, b.posiciones, g.id) : "";
                      const abierto = destinosAbiertos.has(g.id);
                      const ubicadasG = b.posiciones.filter((x) => x.grupo === g.id).length;
                      return (
                        <li
                          key={g.id}
                          className={resaltado === g.id ? "resaltado" : ""}
                          style={{ "--destino": g.color } as CSSProperties}
                          onMouseEnter={() => setResaltado(g.id)}
                          onMouseLeave={() => setResaltado(null)}
                        >
                          <div className="plano-destino-orden">
                            <button type="button" className="btn-icon" disabled={!editable || i === 0} onClick={() => moverOrden(g.id, -1)} aria-label={`Entregar antes a ${g.nombre}`}>
                              <ArrowUp size={13} />
                            </button>
                            <span title="Orden de entrega">{g.orden}</span>
                            <button type="button" className="btn-icon" disabled={!editable || i === todos.length - 1} onClick={() => moverOrden(g.id, 1)} aria-label={`Entregar después a ${g.nombre}`}>
                              <ArrowDown size={13} />
                            </button>
                          </div>
                          <div className="plano-destino-cuerpo">
                            <div className="plano-destino-fila">
                              <input type="color" value={g.color} disabled={!editable} aria-label={`Color de ${g.nombre}`} onChange={(e) => editarGrupo(g.id, { color: e.target.value })} />
                              <input
                                className="plano-destino-num"
                                type="number"
                                min={1}
                                max={999}
                                value={g.numero ?? g.orden}
                                disabled={!editable}
                                aria-label="Número del destino"
                                title="Número del destino (va en las canastillas y en el PDF)"
                                onChange={(e) => editarGrupo(g.id, { numero: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
                              />
                              <input
                                className="plano-destino-nombre"
                                value={g.nombre}
                                maxLength={80}
                                disabled={!editable}
                                aria-label="Cliente o restaurante"
                                onChange={(e) => editarGrupo(g.id, { nombre: e.target.value })}
                              />
                              {editable && (
                                <Tooltip label="Quitar destino">
                                  <button type="button" className="btn-icon peligro" aria-label={`Quitar ${g.nombre}`} onClick={() => cambiarGrupos(b.grupos.filter((x) => x.id !== g.id))}>
                                    <Trash2 size={14} />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                            <div className="plano-destino-fila plano-destino-fila--detalle">
                              <label>
                                Canastillas
                                <input
                                  type="number"
                                  min={1}
                                  max={2000}
                                  value={g.cantidad}
                                  disabled={!editable}
                                  onChange={(e) => editarGrupo(g.id, { cantidad: Math.max(1, Math.min(2000, Number(e.target.value) || 1)) })}
                                />
                              </label>
                              {faltan > 0 && <em className="plano-destino-falta">{faltan} sin lugar</em>}
                            </div>
                            <div className="plano-destino-ubicacion">
                              <MapPin size={12} />
                              <span>{ubicacion || "Todavía no está en el furgón"}</span>
                            </div>
                            {entrega && entrega.pedidos.length > 0 && (
                              <div className="plano-destino-pedidos">
                                <button
                                  type="button"
                                  className="plano-destino-pedidos-cab"
                                  aria-expanded={abierto}
                                  onClick={() =>
                                    setDestinosAbiertos((s0) => {
                                      const n = new Set(s0);
                                      if (n.has(g.id)) n.delete(g.id);
                                      else n.add(g.id);
                                      return n;
                                    })
                                  }
                                >
                                  <ClipboardList size={12} />
                                  <span>
                                    {pedidosTexto(g.id)} · {entrega.productos.length} producto{entrega.productos.length === 1 ? "" : "s"}
                                  </span>
                                  <ChevronDown size={13} className={abierto ? "girado" : ""} />
                                </button>
                                {abierto && (
                                  <ul className="plano-destino-productos">
                                    {entrega.productos.map((pr) => (
                                      <li key={pr.clave}>
                                        <span>{pr.producto}</span>
                                        <b>
                                          {Number(pr.cantidad).toLocaleString("es-CO", { maximumFractionDigits: 2 })} {pr.unidad}
                                        </b>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                            {editable && (faltan > 0 || ubicadasG > 0) && (
                              <div className="plano-destino-acciones">
                                {faltan > 0 && (
                                  <button
                                    type="button"
                                    className={`btn sm ${colocando === g.id ? "primario" : "secundario"}`}
                                    onClick={() => {
                                      setSeleccion(null);
                                      setColocando(colocando === g.id ? null : g.id);
                                    }}
                                  >
                                    <Hand size={14} /> {colocando === g.id ? "Toca la fila en el furgón…" : `Colocar en el furgón (${faltan})`}
                                  </button>
                                )}
                                {ubicadasG > 0 && (
                                  <button type="button" className="btn secundario sm" onClick={() => retirarDestino(g.id)} title="Saca sus canastillas para colocarlas en otras filas">
                                    <PackageMinus size={14} /> Recolocar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ol>
              )}
            </section>

            {/* ---------- Validación ---------- */}
            <section className={`panel gestion-modulo plano-revision ${revision.errores.length ? "con-errores" : ""}`} aria-label="Validación">
              <div className="plano-modulo-cab">
                <div>
                  <h2>
                    {revision.errores.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} Validación
                  </h2>
                  <p>
                    {revision.errores.length
                      ? `${revision.errores.length} error${revision.errores.length === 1 ? "" : "es"} por corregir antes de confirmar`
                      : "Lista para confirmar"}
                    {revisionServidor && !sucio ? " · verificado en el servidor" : ""}
                  </p>
                </div>
              </div>
              <div className="plano-revision-cuerpo">
                {revision.errores.length + revision.avisos.length === 0 ? (
                  <p className="plano-revision-ok">Dimensiones, apilado, orden de entrega, pasillo y capacidad en regla.</p>
                ) : (
                  <ul>
                    {revision.errores.map((t) => (
                      <li key={t} className="error">
                        {t}
                      </li>
                    ))}
                    {revision.avisos.map((t) => (
                      <li key={t} className="aviso">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                <label className="plano-campo">
                  <span>Notas para quien carga (salen en el PDF)</span>
                  <textarea rows={2} value={b.notas} disabled={!editable} placeholder="Ej.: lo refrigerado en el lateral derecho." onChange={(e) => cambiar({ notas: e.target.value })} />
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
