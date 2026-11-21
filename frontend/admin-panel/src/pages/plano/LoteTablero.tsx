import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  ClipboardList,
  FileDown,
  Flag,
  GripVertical,
  History,
  Inbox,
  Layers,
  MapPin,
  Package,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Undo2,
  Wand2,
  Weight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  anularLote,
  cambiarEstadoLote,
  confirmarLote,
  descargarDocumentoLote,
  editarLote,
  ETIQUETAS_DOCUMENTO,
  generarDespachosLote,
  guardarDistribucion,
  redistribuirLote,
  type DistribucionPayload,
  type DocumentoLote,
  type Lote,
  type ParadaLote,
  type PuntoRecorrido,
  type VehiculoLote,
} from "../../api/lotes";
import { consultarRejilla, descargarPdfPlano, type Furgon, type PedidoPlanificacion } from "../../api/logistica";
import { descargarPdfPedidosLote } from "../../api/resources";
import { EstadoVacio, MenuFila, Pastilla, TarjetaKpi, type AccionMenu, type Tono } from "../../components/gestion/Gestion";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarAccion, confirmarDescartar } from "../../utils/alertas";
import { COLORES_GRUPO } from "./acomodo";
import { canastillasDe, consolidar, EstadoDeLote, ESTADOS, estimar, fechaLarga, fmt, momento, pesoDe, verPdf } from "./loteUi";

/**
 * El tablero de un lote de despacho: la vista centralizada donde se termina la
 * preparación del día.
 *
 * El servidor reparte (pedidos del lote × rutas de la fecha × capacidad de
 * cada turbo) y aquí el administrador corrige: mueve pedidos y paradas entre
 * vehículos, reordena la secuencia, fija canastillas, define desde dónde sale
 * y a dónde regresa cada vehículo y agrega entregas extraordinarias. Los
 * cambios se acumulan en local y se guardan con «Guardar reparto»: así una
 * sesión de arrastres no son veinte peticiones.
 *
 * De ahí salen los despachos (un `PlanoCarga` por vehículo, que es el
 * constructor 3D), el resumen de confirmación y la documentación.
 */

type Arrastre = { tipo: "parada"; clave: string; idx: number } | { tipo: "pedido"; id: number };

interface Props {
  lote: Lote;
  furgones: Furgon[];
  puedeArmar: boolean;
  onCambiado: (lote: Lote) => void;
  onVolver: () => void;
  onAbrirDespacho: (id: number) => void;
  onIrARutas: () => void;
  onDespachosCambiaron: () => void;
}

const ORIGEN: Record<VehiculoLote["origen"], { texto: string; tono: Tono }> = {
  ruta: { texto: "Ruta habitual", tono: "neutro" },
  ajuste: { texto: "Ajustada este día", tono: "azul" },
  extra: { texto: "Ruta extra", tono: "violeta" },
  despacho: { texto: "Despacho suelto", tono: "neutro" },
  manual: { texto: "Agregado al lote", tono: "violeta" },
};

/** Las cifras de un vehículo con el reparto que hay en pantalla. */
function metricas(v: VehiculoLote) {
  const canastillas = v.paradas.reduce((a, p) => a + canastillasDe(p), 0);
  const pedidos = v.paradas.reduce((a, p) => a + p.pedidos.length, 0);
  const capacidad = v.capacidad?.canastillas ?? null;
  const tope = v.capacidad?.tope_por_peso ?? null;
  const conPedidos = v.paradas.filter((p) => !p.extra).flatMap((p) => p.pedidos);
  const peso = conPedidos.length ? pesoDe(conPedidos) : null;
  const limite = Math.min(capacidad ?? Infinity, tope ?? Infinity);
  let exceso: string | null = null;
  if (capacidad != null && canastillas > capacidad)
    exceso = `Sobrecapacidad: ${canastillas} canastillas y caben ${capacidad}.`;
  else if (tope != null && canastillas > tope)
    exceso = `Supera la carga útil: el peso permite ${tope} canastillas.`;
  else if (peso != null && v.capacidad?.carga_util_kg && peso > v.capacidad.carga_util_kg)
    exceso = `El peso de los productos (${fmt(Math.round(peso))} kg) supera la carga útil (${fmt(v.capacidad.carga_util_kg)} kg).`;
  let incompleta: string | null = null;
  if (!v.furgon) incompleta = "La ruta no tiene vehículo.";
  else if (!v.furgon.activo) incompleta = `«${v.furgon.nombre}» está inactivo.`;
  else if (v.capacidad?.errores?.length) incompleta = v.capacidad.errores[0];
  return {
    canastillas,
    pedidos,
    capacidad,
    tope,
    peso,
    pct: Number.isFinite(limite) && limite > 0 ? Math.round((canastillas / limite) * 100) : 0,
    exceso,
    incompleta,
  };
}

type Metricas = ReturnType<typeof metricas>;

function estadoVehiculo(v: VehiculoLote, m: Metricas, sucio: boolean): { texto: string; tono: Tono } {
  if (m.exceso) return { texto: "Sobrecapacidad", tono: "ambar" };
  if (m.incompleta && v.paradas.length) return { texto: "Ruta incompleta", tono: "ambar" };
  if (!v.paradas.length) return { texto: "Sin carga", tono: "neutro" };
  if (!v.despacho) return { texto: "Por generar", tono: "azul" };
  if (sucio) return { texto: "Con cambios", tono: "azul" };
  if (v.despacho.estado === "CONFIRMADO") return { texto: "Confirmado", tono: "verde" };
  if (v.despacho.listo) return { texto: "Listo para confirmar", tono: "verde" };
  return { texto: "Borrador con errores", tono: "ambar" };
}

function toggle(s: Set<string>, k: string): Set<string> {
  const n = new Set(s);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
}

const claveParada = (cliente: number | null, pedido: number) => (cliente !== null ? `c${cliente}` : `p${pedido}`);

// ---------------- Operaciones puras sobre el reparto ----------------
interface EstadoLocal {
  vs: VehiculoLote[];
  sa: Array<PedidoPlanificacion & { motivo: string }>;
}

/** Saca un pedido de donde esté (una parada o los pendientes). */
function opExtraer(e: EstadoLocal, id: number): PedidoPlanificacion | null {
  const i = e.sa.findIndex((p) => p.id === id);
  if (i >= 0) return e.sa.splice(i, 1)[0];
  for (const v of e.vs)
    for (const par of v.paradas) {
      const j = par.pedidos.findIndex((p) => p.id === id);
      if (j >= 0) {
        const [pedido] = par.pedidos.splice(j, 1);
        if (!par.pedidos.length && !par.extra) v.paradas = v.paradas.filter((x) => x !== par);
        else par.manual = false;
        return pedido;
      }
    }
  return null;
}

function opAsignar(e: EstadoLocal, id: number, clave: string, idx?: number) {
  const destino = e.vs.find((v) => v.clave === clave);
  if (!destino) return;
  const pedido = opExtraer(e, id);
  if (!pedido) return;
  const existente = destino.paradas.find(
    (p) => !p.extra && pedido.cliente_id !== null && p.cliente === pedido.cliente_id
  );
  if (existente) {
    existente.pedidos.push(pedido);
    existente.manual = false;
    return;
  }
  const enRuta = destino.ruta_paradas.some((r) => r.cliente_id === pedido.cliente_id);
  destino.paradas.splice(idx ?? destino.paradas.length, 0, {
    key: claveParada(pedido.cliente_id, pedido.id),
    cliente: pedido.cliente_id,
    nombre: pedido.cliente_nombre,
    direccion: pedido.direccion,
    telefono: pedido.telefono,
    orden: 0,
    pedidos: [pedido],
    productos: [],
    canastillas: 1,
    canastillas_calculadas: 1,
    manual: false,
    peso_kg: pedido.peso_kg,
    sin_regla: pedido.sin_regla,
    en_ruta: enRuta,
    nota_ruta: "",
    extra: false,
    nota: "",
    fuera_de_ruta: !enRuta,
  });
}

function opDesasignar(e: EstadoLocal, id: number) {
  const pedido = opExtraer(e, id);
  if (!pedido) return;
  e.sa.push({ ...pedido, motivo: "Se retiró del reparto a mano." });
}

export default function LoteTablero({
  lote,
  furgones,
  puedeArmar,
  onCambiado,
  onVolver,
  onAbrirDespacho,
  onIrARutas,
  onDespachosCambiaron,
}: Props) {
  const [vehiculos, setVehiculos] = useState<VehiculoLote[]>(lote.vehiculos);
  const [sinAsignar, setSinAsignar] = useState(lote.sin_asignar);
  const [sucio, setSucio] = useState(false);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<"" | "guardando" | "generando" | "confirmando" | "redistribuyendo">("");
  const [agregando, setAgregando] = useState(false);
  const [extraEn, setExtraEn] = useState<string | null>(null);
  const [recorridoDe, setRecorridoDe] = useState<string | null>(null);
  const [verResumen, setVerResumen] = useState(false);
  const [verBitacora, setVerBitacora] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const arrastre = useRef<Arrastre | null>(null);
  const [sobre, setSobre] = useState<{ clave: string; idx: number } | null>(null);

  // El lote que llega del servidor manda: cada guardado, generación o cambio
  // de estado devuelve el lote completo y reemplaza lo que hay en pantalla.
  useEffect(() => {
    setVehiculos(lote.vehiculos);
    setSinAsignar(lote.sin_asignar);
    setSucio(false);
  }, [lote]);

  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  const editable = puedeArmar && lote.abierto;
  const ms = useMemo(() => vehiculos.map(metricas), [vehiculos]);
  const totales = useMemo(
    () => ({
      canastillas: ms.reduce((a, m) => a + m.canastillas, 0),
      pedidos: ms.reduce((a, m) => a + m.pedidos, 0),
      conCarga: vehiculos.filter((v) => v.paradas.length).length,
      excedidos: ms.filter((m) => m.exceso).length,
      incompletos: vehiculos.filter((v, i) => v.paradas.length && ms[i].incompleta).length,
      paradas: vehiculos.reduce((a, v) => a + v.paradas.length, 0),
    }),
    [vehiculos, ms]
  );
  const despachos = lote.despachos;
  const confirmados = despachos.filter((d) => d.estado === "CONFIRMADO").length;

  // ---------------- Cambios en local ----------------
  function modificar(fn: (e: EstadoLocal) => void) {
    const e: EstadoLocal = {
      vs: vehiculos.map((v) => ({ ...v, paradas: v.paradas.map((p) => ({ ...p, pedidos: [...p.pedidos] })) })),
      sa: [...sinAsignar],
    };
    fn(e);
    setVehiculos(e.vs);
    setSinAsignar(e.sa);
    setSucio(true);
  }

  const asignarPedido = (id: number, clave: string, idx?: number) => modificar((e) => opAsignar(e, id, clave, idx));
  const desasignarPedido = (id: number) => modificar((e) => opDesasignar(e, id));

  function moverParada(desde: string, idx: number, hacia: string, destinoIdx: number) {
    modificar(({ vs }) => {
      const o = vs.find((v) => v.clave === desde);
      const d = vs.find((v) => v.clave === hacia);
      if (!o || !d) return;
      const [par] = o.paradas.splice(idx, 1);
      if (!par) return;
      const ajustado = o === d && destinoIdx > idx ? destinoIdx - 1 : destinoIdx;
      const mismo = d.paradas.find((p) => !p.extra && !par.extra && par.cliente !== null && p.cliente === par.cliente);
      if (mismo) {
        mismo.pedidos.push(...par.pedidos);
        mismo.manual = false;
      } else {
        par.en_ruta = d.ruta_paradas.some((r) => r.cliente_id === par.cliente);
        par.fuera_de_ruta = !par.extra && !par.en_ruta;
        d.paradas.splice(Math.min(Math.max(0, ajustado), d.paradas.length), 0, par);
      }
    });
  }

  function cambiarParada(clave: string, key: string, cambio: Partial<ParadaLote>) {
    modificar(({ vs }) => {
      const par = vs.find((v) => v.clave === clave)?.paradas.find((p) => p.key === key);
      if (par) Object.assign(par, cambio);
    });
  }

  const fijarCanastillas = (clave: string, key: string, n: number) =>
    cambiarParada(clave, key, { canastillas: Math.max(1, Math.min(500, Math.round(n) || 1)), manual: true });

  function quitarParada(clave: string, key: string) {
    modificar((e) => {
      const v = e.vs.find((x) => x.clave === clave);
      const par = v?.paradas.find((p) => p.key === key);
      if (!v || !par) return;
      if (par.extra) v.paradas = v.paradas.filter((p) => p !== par);
      else par.pedidos.map((p) => p.id).forEach((id) => opDesasignar(e, id));
    });
  }

  function agregarExtra(clave: string, datos: { nombre: string; direccion: string; nota: string; canastillas: number }) {
    modificar(({ vs }) => {
      const v = vs.find((x) => x.clave === clave);
      if (!v) return;
      v.paradas.push({
        key: `x${Date.now().toString(36)}`,
        cliente: null,
        nombre: datos.nombre,
        direccion: datos.direccion,
        orden: v.paradas.length + 1,
        pedidos: [],
        productos: [],
        canastillas: datos.canastillas,
        canastillas_calculadas: datos.canastillas,
        manual: true,
        peso_kg: null,
        sin_regla: [],
        en_ruta: false,
        nota_ruta: "",
        extra: true,
        nota: datos.nota,
      });
    });
    setExtraEn(null);
  }

  function fijarRecorrido(clave: string, inicio: PuntoRecorrido | null, fin: PuntoRecorrido | null) {
    modificar(({ vs }) => {
      const v = vs.find((x) => x.clave === clave);
      if (v) {
        v.inicio = inicio;
        v.fin = fin;
      }
    });
    setRecorridoDe(null);
  }

  async function agregarVehiculo(f: Furgon) {
    try {
      const r = await consultarRejilla(f.id, lote.tipo_canastilla.id);
      const peso = lote.tipo_canastilla.peso_lleno_kg;
      setVehiculos((vs) => [
        ...vs,
        {
          clave: `f${f.id}`,
          ruta_id: null,
          ajuste_id: null,
          origen: "manual",
          nombre: f.nombre,
          color: COLORES_GRUPO[vs.length % COLORES_GRUPO.length],
          furgon: {
            id: f.id,
            nombre: f.nombre,
            placa: f.placa,
            modelo_3d: f.modelo_3d,
            carga_util_kg: f.carga_util_kg,
            activo: f.activo,
          },
          capacidad: {
            canastillas: r.capacidad,
            posiciones: r.pilas.length,
            niveles: r.niveles,
            carga_util_kg: f.carga_util_kg,
            tope_por_peso: peso && f.carga_util_kg ? Math.floor(f.carga_util_kg / peso) : null,
            errores: r.errores,
          },
          ruta_paradas: [],
          paradas_sin_pedido: [],
          inicio: null,
          fin: null,
          paradas: [],
          metricas: {
            canastillas: 0, pedidos: 0, paradas: 0, capacidad: r.capacidad, tope: null,
            peso_kg: null, carga_util_kg: f.carga_util_kg, pct: 0, exceso: null, incompleta: null,
          },
          despacho: null,
        },
      ]);
      setSucio(true);
      setAgregando(false);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo calcular la capacidad del vehículo."));
    }
  }

  function quitarVehiculo(clave: string) {
    modificar((e) => {
      const v = e.vs.find((x) => x.clave === clave);
      v?.paradas.flatMap((p) => p.pedidos.map((x) => x.id)).forEach((id) => opDesasignar(e, id));
      e.vs = e.vs.filter((x) => x.clave !== clave);
    });
  }

  // ---------------- Arrastrar y soltar ----------------
  function alSoltar(e: DragEvent, clave: string) {
    e.preventDefault();
    const a = arrastre.current;
    const idx = sobre?.clave === clave ? sobre.idx : (vehiculos.find((v) => v.clave === clave)?.paradas.length ?? 0);
    arrastre.current = null;
    setSobre(null);
    if (!a) return;
    if (a.tipo === "pedido") asignarPedido(a.id, clave, idx);
    else moverParada(a.clave, a.idx, clave, a.clave === clave && a.idx < idx ? idx + 1 : idx);
  }

  function alSoltarPendientes(e: DragEvent) {
    e.preventDefault();
    const a = arrastre.current;
    arrastre.current = null;
    setSobre(null);
    if (!a) return;
    if (a.tipo === "pedido") desasignarPedido(a.id);
    else {
      const par = vehiculos.find((v) => v.clave === a.clave)?.paradas[a.idx];
      if (par) quitarParada(a.clave, par.key);
    }
  }

  // ---------------- Guardar y avanzar ----------------
  function payload(): DistribucionPayload {
    return {
      vehiculos: vehiculos
        .filter((v) => v.furgon)
        .map((v) => ({
          clave: v.clave,
          furgon: v.furgon!.id,
          nombre: v.nombre,
          color: v.color,
          inicio: v.inicio,
          fin: v.fin,
          paradas: v.paradas.map((p) => ({
            cliente: p.cliente,
            pedidos: p.pedidos.map((x) => x.id),
            canastillas: canastillasDe(p),
            manual: p.manual,
            nota: p.nota,
            extra: p.extra,
            nombre: p.nombre,
            direccion: p.direccion,
          })),
        })),
    };
  }

  async function conError<T>(que: string, trabajo: () => Promise<T>, estado: typeof ocupado): Promise<T | null> {
    setOcupado(estado);
    try {
      return await trabajo();
    } catch (e) {
      alertaError(extraerMensajeError(e, que));
      return null;
    } finally {
      setOcupado("");
    }
  }

  async function guardar(): Promise<Lote | null> {
    const r = await conError("No se pudo guardar el reparto.", () => guardarDistribucion(lote.id, payload()), "guardando");
    if (r) {
      onCambiado(r);
      setSucio(false);
    }
    return r;
  }

  async function generar() {
    if (totales.excedidos) {
      const ok = await confirmarAccion(
        "Hay vehículos sobre su capacidad",
        "Se generan igual, pero las canastillas que no caben quedan sin lugar y el despacho no se podrá confirmar hasta corregirlo.",
        "Generar de todos modos"
      );
      if (!ok) return;
    }
    if (sucio && !(await guardar())) return;
    const r = await conError("No se pudieron generar los despachos.", () => generarDespachosLote(lote.id), "generando");
    if (!r) return;
    onCambiado(r);
    onDespachosCambiaron();
    alertaExito(`${r.despachos.length} despacho${r.despachos.length === 1 ? "" : "s"} con su plano de carga`);
  }

  async function redistribuir() {
    if (sucio && !(await confirmarDescartar("El reparto tiene cambios sin guardar que se van a perder."))) return;
    const r = await conError(
      "No se pudo volver a calcular el reparto.",
      () => redistribuirLote(lote.id),
      "redistribuyendo"
    );
    if (r) onCambiado(r);
  }

  async function confirmar() {
    const r = await conError("No se pudo confirmar el lote.", () => confirmarLote(lote.id), "confirmando");
    if (!r) return;
    setVerResumen(false);
    onCambiado(r);
    onDespachosCambiaron();
    alertaExito("Lote confirmado: los datos del despacho quedan congelados");
  }

  async function avanzar(estado: Lote["estado"], titulo: string, texto: string, boton: string) {
    if (!(await confirmarAccion(titulo, texto, boton))) return;
    const r = await conError("No se pudo cambiar el estado del lote.", () => cambiarEstadoLote(lote.id, estado), "guardando");
    if (r) {
      onCambiado(r);
      onDespachosCambiaron();
    }
  }

  async function anular() {
    if (
      !(await confirmarAccion(
        `¿Anular el lote #${lote.numero}?`,
        "Sus pedidos vuelven a quedar pendientes de planificación y se eliminan los planos de carga en borrador. La bitácora se conserva.",
        "Anular el lote"
      ))
    )
      return;
    const r = await conError("No se pudo anular el lote.", () => anularLote(lote.id, ""), "guardando");
    if (r) {
      onCambiado(r);
      onDespachosCambiaron();
    }
  }

  async function documento(doc: DocumentoLote) {
    try {
      await verPdf(() => descargarDocumentoLote(lote.id, doc));
    } catch (e) {
      alertaError(extraerMensajeError(e, `No se pudo generar «${ETIQUETAS_DOCUMENTO[doc]}».`));
    }
  }

  async function facturasDe(v: VehiculoLote) {
    const ids = v.paradas.flatMap((p) => p.pedidos.map((x) => x.id));
    if (!ids.length) return;
    try {
      await descargarPdfPedidosLote(ids);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudieron generar las facturas del vehículo."));
    }
  }

  // ---------------- Render ----------------
  const usados = new Set(vehiculos.map((v) => v.furgon?.id));
  const libres = furgones.filter((f) => f.activo && !usados.has(f.id));
  const destinos = (actual: string | null) => vehiculos.filter((v) => v.clave !== actual && v.furgon);
  const puedeConfirmar = lote.abierto && totales.conCarga > 0 && !sucio && despachos.length > 0;

  const accionesLote: AccionMenu[] = [];
  if (editable)
    accionesLote.push({
      clave: "renombrar",
      tono: "editar",
      etiqueta: "Renombrar el lote",
      icono: <Pencil size={15} />,
      onSeleccionar: () => setRenombrando(true),
    });
  accionesLote.push({
    clave: "bitacora",
    tono: "info",
    etiqueta: "Ver la bitácora",
    icono: <History size={15} />,
    onSeleccionar: () => setVerBitacora(true),
  });
  if (puedeArmar && lote.estado === "CONFIRMADO")
    accionesLote.push({
      clave: "en-ruta",
      tono: "exito",
      etiqueta: "Marcar como «en ruta»",
      icono: <Truck size={15} />,
      onSeleccionar: () =>
        avanzar("EN_RUTA", "¿Los vehículos ya salieron?", "El lote queda en ruta y sus pedidos aparecen como «en ruta».", "Sí, salieron"),
    });
  if (puedeArmar && lote.estado === "EN_RUTA")
    accionesLote.push({
      clave: "entregado",
      tono: "exito",
      etiqueta: "Cerrar el día (entregado)",
      icono: <CheckCircle2 size={15} />,
      onSeleccionar: () =>
        avanzar(
          "ENTREGADO",
          "¿Cerrar el lote como entregado?",
          "Sus pedidos quedan marcados como entregados. Esto no se puede deshacer desde aquí.",
          "Cerrar el día"
        ),
    });
  if (puedeArmar && (lote.estado === "CONFIRMADO" || lote.estado === "EN_RUTA"))
    accionesLote.push({
      clave: "reabrir",
      tono: "editar",
      etiqueta: lote.estado === "EN_RUTA" ? "Volver a «confirmado»" : "Reabrir para corregir",
      icono: <Undo2 size={15} />,
      onSeleccionar: () =>
        avanzar(
          lote.estado === "EN_RUTA" ? "CONFIRMADO" : "PREPARADO",
          "¿Reabrir el lote?",
          lote.estado === "EN_RUTA"
            ? "El lote vuelve a «confirmado»."
            : "Los planos de carga vuelven a borrador para poder corregirlos.",
          "Reabrir"
        ),
    });
  if (puedeArmar && lote.abierto)
    accionesLote.push({
      clave: "anular",
      etiqueta: "Anular el lote",
      icono: <CircleSlash size={15} />,
      peligro: true,
      onSeleccionar: anular,
    });

  return (
    <>
      {/* ---------- Barra del lote ---------- */}
      <section className="panel lote-barra" aria-label={`Lote ${lote.numero}`}>
        <div className="lote-identidad">
          <Tooltip label="Volver a los lotes" posicion="abajo">
            <button type="button" className="btn-icon plano-volver" onClick={onVolver} aria-label="Volver a los lotes">
              <ArrowLeft size={18} />
            </button>
          </Tooltip>
          <div>
            <h2>
              Lote #{lote.numero}
              {lote.nombre && <span className="lote-alias">{lote.nombre}</span>}
            </h2>
            <p className="pl-meta">
              <Route size={12} /> {fechaLarga(lote.fecha)} ·{" "}
              {lote.programacion ? (
                `programación «${lote.programacion.nombre}»`
              ) : (
                <button type="button" className="pl-enlace" onClick={onIrARutas}>
                  sin programación activa
                </button>
              )}{" "}
              · canastilla {lote.tipo_canastilla.nombre}
            </p>
          </div>
        </div>
        <div className="lote-barra-acciones">
          <EstadoDeLote estado={lote.estado} />
          {editable && (
            <Tooltip label="Volver a calcular el reparto automático" posicion="abajo">
              <button
                type="button"
                className="btn secundario sm"
                disabled={!!ocupado}
                onClick={redistribuir}
              >
                <RefreshCw size={14} className={ocupado === "redistribuyendo" ? "girando" : ""} /> Redistribuir
              </button>
            </Tooltip>
          )}
          <MenuFila etiqueta={`Documentos del lote ${lote.numero}`} acciones={[
            {
              clave: "todo",
              tono: "ver",
              etiqueta: ETIQUETAS_DOCUMENTO.todo,
              icono: <FileDown size={15} />,
              onSeleccionar: () => documento("todo"),
            },
            {
              clave: "planos",
              tono: "ver",
              etiqueta: ETIQUETAS_DOCUMENTO.planos,
              icono: <Box size={15} />,
              deshabilitada: despachos.length === 0,
              onSeleccionar: () => documento("planos"),
            },
            {
              clave: "productos",
              tono: "ver",
              etiqueta: ETIQUETAS_DOCUMENTO.productos,
              icono: <ClipboardList size={15} />,
              onSeleccionar: () => documento("productos"),
            },
            {
              clave: "facturas",
              tono: "ver",
              etiqueta: ETIQUETAS_DOCUMENTO.facturas,
              icono: <Layers size={15} />,
              deshabilitada: totales.pedidos === 0,
              onSeleccionar: () => documento("facturas"),
            },
          ]} />
          {accionesLote.length > 0 && <MenuFila etiqueta={`Acciones del lote ${lote.numero}`} acciones={accionesLote} />}
          {editable && (
            <button type="button" className="btn primario" disabled={!!ocupado || !!totales.incompletos} onClick={generar}>
              <Wand2 size={16} />{" "}
              {ocupado === "generando" ? "Generando…" : despachos.length ? "Actualizar despachos" : "Generar despachos"}
            </button>
          )}
          {puedeArmar && lote.abierto && (
            <button type="button" className="btn secundario pl-btn-ok" disabled={!puedeConfirmar} onClick={() => setVerResumen(true)}>
              <ShieldCheck size={16} /> Revisar y confirmar
            </button>
          )}
        </div>
      </section>

      {/* ---------- Indicadores ---------- */}
      <div className="kpis-gestion">
        <TarjetaKpi
          tono="neutro"
          icono={<ClipboardList size={18} />}
          etiqueta="Pedidos del lote"
          descripcion="Pedidos reservados en este lote"
          valor={fmt(totales.pedidos + sinAsignar.length)}
          pie={`${lote.resumen.clientes} clientes · ${totales.paradas} paradas`}
        />
        <TarjetaKpi
          tono={sinAsignar.length ? "ambar" : "verde"}
          icono={<Inbox size={18} />}
          etiqueta="Sin asignar"
          descripcion="Pedidos del lote que todavía no van en ningún vehículo"
          valor={fmt(sinAsignar.length)}
          pie={sinAsignar.length ? "no se despachan así" : "todos tienen vehículo"}
        />
        <TarjetaKpi
          tono="azul"
          icono={<Truck size={18} />}
          etiqueta="Vehículos con carga"
          descripcion="Vehículos del día que llevan al menos una parada"
          valor={`${totales.conCarga} / ${vehiculos.length}`}
          pie={totales.excedidos ? `${totales.excedidos} sobre su capacidad` : "dentro de su capacidad"}
        />
        <TarjetaKpi
          tono="violeta"
          icono={<Package size={18} />}
          etiqueta="Canastillas"
          descripcion="Canastillas de todos los vehículos del lote"
          valor={fmt(totales.canastillas)}
          pie="estimadas o fijadas"
        />
        <TarjetaKpi
          tono={confirmados === despachos.length && despachos.length ? "verde" : "neutro"}
          icono={<ShieldCheck size={18} />}
          etiqueta="Despachos"
          descripcion="Planos de carga confirmados de los generados"
          valor={`${confirmados} / ${despachos.length}`}
          pie={despachos.length ? "con plano 3D" : "sin generar"}
        />
      </div>

      {sucio && (
        <div className="pl-aviso-cambios" role="status">
          <Sparkles size={16} />
          <span>
            Cambiaste el reparto. <strong>Guárdalo</strong> para que quede en el lote y se pueda generar o confirmar.
          </span>
          <button type="button" className="btn primario sm" disabled={!!ocupado} onClick={guardar}>
            <Save size={14} /> {ocupado === "guardando" ? "Guardando…" : "Guardar reparto"}
          </button>
          <button type="button" className="btn secundario sm" disabled={!!ocupado} onClick={() => onCambiado(lote)}>
            <Undo2 size={14} /> Descartar
          </button>
        </div>
      )}

      {!lote.abierto && (
        <div className="pl-aviso-cambios lote-aviso-cerrado" role="status">
          <ShieldCheck size={16} />
          <span>
            {ESTADOS[lote.estado].ayuda}
            {lote.confirmado_por && ` Confirmado por ${lote.confirmado_por}.`}
          </span>
        </div>
      )}

      {!!lote.notas_motor.length && (
        <details className="panel lote-notas">
          <summary>
            <Wand2 size={14} /> Qué hizo el reparto automático ({lote.notas_motor.length})
          </summary>
          <ul>
            {lote.notas_motor.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="pl-tablero">
        {/* ---------- Pendientes ---------- */}
        <aside
          className={`panel pl-pendientes ${sobre?.clave === "__pendientes" ? "destino" : ""}`}
          aria-label="Pedidos del lote sin asignar"
          onDragOver={(e) => {
            if (!arrastre.current || !editable) return;
            e.preventDefault();
            setSobre({ clave: "__pendientes", idx: 0 });
          }}
          onDrop={alSoltarPendientes}
        >
          <div className="pl-col-cab">
            <h2>
              <Inbox size={16} /> Sin asignar
            </h2>
            <span className={`pl-contador ${sinAsignar.length ? "alerta" : ""}`}>{sinAsignar.length}</span>
          </div>
          {sinAsignar.length === 0 ? (
            <p className="pl-vacio-suave">
              <CheckCircle2 size={16} /> Todos los pedidos del lote tienen vehículo.
            </p>
          ) : (
            <ul className="pl-pendientes-lista">
              {sinAsignar.map((p) => (
                <li
                  key={p.id}
                  className="pl-pendiente"
                  draggable={editable}
                  onDragStart={() => (arrastre.current = { tipo: "pedido", id: p.id })}
                  onDragEnd={() => {
                    arrastre.current = null;
                    setSobre(null);
                  }}
                >
                  <div className="pl-pendiente-cab">
                    {editable && <GripVertical size={14} className="pl-asa" aria-hidden="true" />}
                    <strong>{p.cliente_nombre}</strong>
                    <span className="pl-pedido-num">#{p.id}</span>
                  </div>
                  <small className="pl-motivo">
                    <AlertTriangle size={12} /> {p.motivo}
                  </small>
                  <small className="pl-meta">
                    {p.productos.length} producto{p.productos.length === 1 ? "" : "s"} · ≈ {p.canastillas} canastilla
                    {p.canastillas === 1 ? "" : "s"}
                    {p.direccion ? ` · ${p.direccion}` : ""}
                  </small>
                  {editable && (
                    <select
                      className="pl-select pl-select-sm"
                      value=""
                      onChange={(e) => e.target.value && asignarPedido(p.id, e.target.value)}
                      aria-label={`Asignar el pedido ${p.id} a un vehículo`}
                    >
                      <option value="">Asignar a vehículo…</option>
                      {destinos(null).map((v) => (
                        <option key={v.clave} value={v.clave}>
                          {v.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!!lote.rutas_canceladas.length && (
            <div className="pl-canceladas">
              <h3>
                <CircleSlash size={14} /> No salen este día
              </h3>
              {lote.rutas_canceladas.map((c) => (
                <div key={c.clave} className="pl-cancelada">
                  <span>
                    <strong>{c.nombre}</strong>
                    {c.motivo && <small>{c.motivo}</small>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ---------- Vehículos ---------- */}
        <section className="pl-vehiculos" aria-label="Vehículos del lote">
          {vehiculos.length === 0 && (
            <section className="panel gestion-modulo">
              <EstadoVacio
                icono={<Route size={20} />}
                titulo={`Ninguna ruta programada el ${lote.dia_nombre.toLowerCase()}`}
                texto="Configura la programación semanal o agrega un vehículo a este lote para poder repartir sus pedidos."
                accion={
                  <button type="button" className="btn secundario sm" onClick={onIrARutas}>
                    <Route size={14} /> Ir a la programación semanal
                  </button>
                }
              />
            </section>
          )}
          {vehiculos.map((v, iv) => {
            const m = ms[iv];
            const estado = estadoVehiculo(v, m, sucio);
            const acciones: AccionMenu[] = [];
            if (editable)
              acciones.push({
                clave: "recorrido",
                tono: "editar",
                etiqueta: "Punto inicial y final",
                icono: <Flag size={15} />,
                onSeleccionar: () => setRecorridoDe(v.clave),
              });
            if (editable)
              acciones.push({
                clave: "extra",
                tono: "info",
                etiqueta: "Agregar entrega extraordinaria",
                icono: <Plus size={15} />,
                onSeleccionar: () => setExtraEn(v.clave),
              });
            if (v.despacho)
              acciones.push({
                clave: "facturas",
                tono: "ver",
                etiqueta: "Facturas de este vehículo",
                icono: <Layers size={15} />,
                deshabilitada: m.pedidos === 0,
                onSeleccionar: () => facturasDe(v),
              });
            if (editable && v.origen === "manual" && !v.despacho)
              acciones.push({
                clave: "quitar",
                etiqueta: "Quitar este vehículo del lote",
                icono: <CircleSlash size={15} />,
                peligro: true,
                onSeleccionar: () => quitarVehiculo(v.clave),
              });
            return (
              <article
                key={v.clave}
                className={`panel pl-vehiculo ${m.exceso ? "excede" : ""} ${!lote.abierto ? "bloqueado" : ""} ${sobre?.clave === v.clave ? "destino" : ""}`}
                style={{ "--ruta": v.color } as CSSProperties}
                onDragOver={(e) => {
                  if (!arrastre.current || !editable) return;
                  e.preventDefault();
                  if (sobre?.clave !== v.clave) setSobre({ clave: v.clave, idx: v.paradas.length });
                }}
                onDrop={(e) => alSoltar(e, v.clave)}
              >
                <header className="pl-vehiculo-cab">
                  <div className="pl-vehiculo-titulo">
                    <span className="pl-vehiculo-icono">
                      <Truck size={18} />
                    </span>
                    <div>
                      <h3>{v.nombre}</h3>
                      <p>
                        {v.furgon ? (
                          <>
                            {v.furgon.nombre}
                            {v.furgon.placa && <span className="plano-placa">{v.furgon.placa}</span>}
                          </>
                        ) : (
                          "Sin vehículo"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="pl-vehiculo-etiquetas">
                    <Pastilla tono={ORIGEN[v.origen].tono}>{ORIGEN[v.origen].texto}</Pastilla>
                    <Pastilla tono={estado.tono}>{estado.texto}</Pastilla>
                    {acciones.length > 0 && <MenuFila etiqueta={`Acciones de ${v.nombre}`} acciones={acciones} />}
                  </div>
                </header>

                {(v.inicio || v.fin) && (
                  <p className="lote-recorrido">
                    {v.inicio && (
                      <span>
                        <Flag size={12} /> Sale de <strong>{v.inicio.nombre || v.inicio.direccion}</strong>
                      </span>
                    )}
                    {v.fin && (
                      <span>
                        <MapPin size={12} /> Regresa a <strong>{v.fin.nombre || v.fin.direccion}</strong>
                      </span>
                    )}
                  </p>
                )}

                <div className="pl-capacidad">
                  <div className="pl-capacidad-fila">
                    <span>
                      <Layers size={13} /> <strong>{m.canastillas}</strong>
                      {m.capacidad != null ? ` / ${m.capacidad}` : ""} canastillas
                    </span>
                    <span>
                      <Weight size={13} /> {m.peso != null ? `${fmt(Math.round(m.peso))} kg` : "peso sin regla"}
                      {v.capacidad?.carga_util_kg ? ` / ${fmt(v.capacidad.carga_util_kg)} kg` : ""}
                    </span>
                  </div>
                  <span className={`plano-ocupacion pl-barra ${m.pct > 100 ? "excede" : m.pct > 90 ? "alta" : ""}`}>
                    <span className="plano-ocupacion-barra" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, m.pct)}%` }} />
                    </span>
                    <span className="plano-ocupacion-num">{m.pct}%</span>
                  </span>
                  {m.exceso && (
                    <p className="pl-alerta">
                      <AlertTriangle size={13} /> {m.exceso}
                    </p>
                  )}
                  {m.incompleta && (
                    <p className="pl-alerta">
                      <AlertTriangle size={13} /> Ruta incompleta: {m.incompleta}
                    </p>
                  )}
                  {v.despacho?.errores?.length && !sucio ? (
                    <p className="pl-alerta suave">
                      <AlertTriangle size={13} /> {v.despacho.errores[0]}
                    </p>
                  ) : null}
                </div>

                <ol className="pl-paradas-vehiculo">
                  {v.paradas.length === 0 && (
                    <li className="pl-soltar-aqui">
                      {editable ? "Arrastra aquí un pedido o una parada" : "Sin carga asignada"}
                    </li>
                  )}
                  {v.paradas.map((par, i) => {
                    const abierta = abiertas.has(`${v.clave}:${par.key}`);
                    const canas = canastillasDe(par);
                    const sinRegla = [...new Set(par.pedidos.flatMap((p) => p.sin_regla))];
                    const productos = par.extra ? [] : consolidar(par.pedidos);
                    return (
                      <li
                        key={par.key}
                        className={`pl-parada-v ${par.extra ? "lote-parada-extra" : ""} ${sobre?.clave === v.clave && sobre.idx === i ? "antes" : ""}`}
                        draggable={editable}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          arrastre.current = { tipo: "parada", clave: v.clave, idx: i };
                        }}
                        onDragEnd={() => {
                          arrastre.current = null;
                          setSobre(null);
                        }}
                        onDragOver={(e) => {
                          if (!arrastre.current || !editable) return;
                          e.preventDefault();
                          e.stopPropagation();
                          if (sobre?.clave !== v.clave || sobre.idx !== i) setSobre({ clave: v.clave, idx: i });
                        }}
                      >
                        <div className="pl-parada-v-cab">
                          {editable && <GripVertical size={14} className="pl-asa" aria-hidden="true" />}
                          <span className="pl-parada-num" style={{ background: COLORES_GRUPO[i % COLORES_GRUPO.length] }}>
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            className="pl-parada-v-datos"
                            onClick={() => setAbiertas((s) => toggle(s, `${v.clave}:${par.key}`))}
                            aria-expanded={abierta}
                          >
                            <strong>{par.nombre}</strong>
                            <small>
                              {par.extra
                                ? "Entrega extraordinaria"
                                : `${par.pedidos.length} pedido${par.pedidos.length === 1 ? "" : "s"} · ${productos.length} producto${productos.length === 1 ? "" : "s"}`}
                              {par.fuera_de_ruta && !par.extra ? " · fuera de ruta" : ""}
                            </small>
                          </button>
                          <label className="pl-canas" title={par.manual ? "Fijadas a mano" : "Estimadas con las reglas de carga"}>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={canas}
                              disabled={!editable}
                              onChange={(e) => fijarCanastillas(v.clave, par.key, Number(e.target.value))}
                              aria-label={`Canastillas de ${par.nombre}`}
                            />
                            <span>{par.manual ? "fijadas" : "estim."}</span>
                          </label>
                          {editable && (
                            <div className="pl-parada-v-orden">
                              <button
                                type="button"
                                className="btn-icon"
                                disabled={i === 0}
                                onClick={() => moverParada(v.clave, i, v.clave, i - 1)}
                                aria-label={`Entregar antes a ${par.nombre}`}
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon"
                                disabled={i === v.paradas.length - 1}
                                onClick={() => moverParada(v.clave, i, v.clave, i + 2)}
                                aria-label={`Entregar después a ${par.nombre}`}
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        {sinRegla.length > 0 && !par.manual && (
                          <small className="pl-aviso-texto pl-sangria">
                            <AlertTriangle size={11} /> Sin regla de carga: {sinRegla.join(", ")}. Revisa las canastillas.
                          </small>
                        )}
                        {abierta && (
                          <div className="pl-parada-detalle">
                            {(par.direccion || par.nota) && (
                              <p className="pl-meta">
                                {par.direccion && (
                                  <>
                                    <MapPin size={12} /> {par.direccion}
                                    {par.telefono ? ` · ${par.telefono}` : ""}
                                  </>
                                )}
                                {par.nota && <em> {par.nota}</em>}
                              </p>
                            )}
                            {par.extra ? (
                              <p className="pl-meta">
                                Esta parada no sale de un pedido: lleva {canas} canastilla{canas === 1 ? "" : "s"} y no
                                tiene factura.
                              </p>
                            ) : (
                              <table className="pl-productos">
                                <thead>
                                  <tr>
                                    <th>Producto</th>
                                    <th className="num">Cantidad</th>
                                    <th>Unidad</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {productos.map((pr) => (
                                    <tr key={`${pr.producto}-${pr.unidad}`}>
                                      <td>
                                        {pr.producto}
                                        {pr.pedidos.length > 1 && (
                                          <small> ({pr.pedidos.map((x) => `#${x.id}: ${x.cantidad}`).join(" · ")})</small>
                                        )}
                                        {pr.notas.length > 0 && <small className="pl-nota-prod">{pr.notas.join("; ")}</small>}
                                      </td>
                                      <td className="num">{fmt(pr.cantidad)}</td>
                                      <td>{pr.unidad}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <ul className="pl-pedidos">
                              {par.pedidos.map((p) => (
                                <li key={p.id}>
                                  <span className="pl-pedido-num">#{p.id}</span>
                                  <span className="pl-pedido-estado">{p.estado.toLowerCase()}</span>
                                  {(p.observaciones || p.indicaciones) && (
                                    <small className="pl-meta">{[p.observaciones, p.indicaciones].filter(Boolean).join(" · ")}</small>
                                  )}
                                  {editable && (
                                    <select
                                      className="pl-select pl-select-sm"
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value === "__sin") desasignarPedido(p.id);
                                        else if (e.target.value) asignarPedido(p.id, e.target.value);
                                      }}
                                      aria-label={`Mover el pedido ${p.id}`}
                                    >
                                      <option value="">Mover a…</option>
                                      {destinos(v.clave).map((o) => (
                                        <option key={o.clave} value={o.clave}>
                                          {o.nombre}
                                        </option>
                                      ))}
                                      <option value="__sin">Dejar sin asignar</option>
                                    </select>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {editable && (
                              <div className="lote-parada-pie">
                                {par.manual && !par.extra && (
                                  <button type="button" className="pl-enlace" onClick={() => cambiarParada(v.clave, par.key, { manual: false })}>
                                    Volver a estimar canastillas ({estimar(par.pedidos)})
                                  </button>
                                )}
                                <button type="button" className="pl-enlace lote-quitar" onClick={() => quitarParada(v.clave, par.key)}>
                                  <Trash2 size={12} /> {par.extra ? "Quitar la entrega" : "Quitar la parada del vehículo"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {v.paradas_sin_pedido.length > 0 && (
                  <p className="pl-sin-pedido">
                    <PackageX size={13} /> Sin pedido hoy: {v.paradas_sin_pedido.map((p) => p.nombre).join(", ")}
                  </p>
                )}

                <footer className="pl-vehiculo-pie">
                  {v.despacho ? (
                    <>
                      <button type="button" className="btn primario sm" onClick={() => onAbrirDespacho(v.despacho!.id)}>
                        <Box size={14} /> Constructor 3D
                      </button>
                      <button
                        type="button"
                        className="btn secundario sm"
                        onClick={() => verPdf(() => descargarPdfPlano(v.despacho!.id)).catch((e) =>
                          alertaError(extraerMensajeError(e, "No se pudo generar la guía en PDF."))
                        )}
                      >
                        <FileDown size={14} /> Guía de carga
                      </button>
                    </>
                  ) : (
                    <span className="pl-meta">
                      {v.paradas.length ? "Genera los despachos para ver su plano 3D" : "Sin paradas asignadas"}
                    </span>
                  )}
                </footer>
              </article>
            );
          })}

          {editable && (
            <div className="pl-agregar">
              {agregando ? (
                <div className="panel pl-agregar-lista">
                  <strong>Elige el vehículo</strong>
                  {libres.length === 0 ? (
                    <p className="pl-meta">Todos los vehículos activos ya están en el lote.</p>
                  ) : (
                    libres.map((f) => (
                      <button key={f.id} type="button" className="btn secundario sm" onClick={() => agregarVehiculo(f)}>
                        <Truck size={14} /> {f.nombre}
                        {f.placa ? ` · ${f.placa}` : ""}
                      </button>
                    ))
                  )}
                  <button type="button" className="pl-enlace" onClick={() => setAgregando(false)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" className="pl-ruta-nueva" onClick={() => setAgregando(true)}>
                  <Plus size={20} />
                  <strong>Agregar un vehículo al lote</strong>
                  <span>Para pedidos fuera de ruta o entregas extraordinarias</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {extraEn && <ModalEntregaExtra onCerrar={() => setExtraEn(null)} onGuardar={(d) => agregarExtra(extraEn, d)} />}
      {recorridoDe && (
        <ModalRecorrido
          vehiculo={vehiculos.find((v) => v.clave === recorridoDe)!}
          onCerrar={() => setRecorridoDe(null)}
          onGuardar={(inicio, fin) => fijarRecorrido(recorridoDe, inicio, fin)}
        />
      )}
      {renombrando && (
        <ModalNombre
          lote={lote}
          onCerrar={() => setRenombrando(false)}
          onGuardar={async (nombre, notas) => {
            const r = await conError("No se pudo guardar el nombre del lote.", () => editarLote(lote.id, { nombre, notas }), "guardando");
            if (r) {
              onCambiado(r);
              setRenombrando(false);
            }
          }}
        />
      )}
      {verBitacora && <ModalBitacora lote={lote} onCerrar={() => setVerBitacora(false)} />}
      {verResumen && (
        <ModalResumen
          lote={lote}
          confirmando={ocupado === "confirmando"}
          onCerrar={() => setVerResumen(false)}
          onConfirmar={confirmar}
          onDocumento={documento}
        />
      )}
    </>
  );
}

// =====================================================================
// Entrega extraordinaria
// =====================================================================
function ModalEntregaExtra({
  onCerrar,
  onGuardar,
}: {
  onCerrar: () => void;
  onGuardar: (d: { nombre: string; direccion: string; nota: string; canastillas: number }) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [nota, setNota] = useState("");
  const [canastillas, setCanastillas] = useState(1);
  return (
    <Modal
      titulo="Entrega extraordinaria"
      subtitulo="Una parada que no sale de un pedido: una recogida, una muestra o un pedido que entró por teléfono."
      onCerrar={onCerrar}
      amplio
      medio
      cerrarConEscape
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primario"
            disabled={!nombre.trim()}
            onClick={() => onGuardar({ nombre: nombre.trim(), direccion: direccion.trim(), nota: nota.trim(), canastillas })}
          >
            <Plus size={15} /> Agregar la parada
          </button>
        </>
      }
    >
      <div className="pl-ajuste-grid">
        <label className="plano-campo">
          <span>Qué se entrega o recoge</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Recoger canastillas en Menta" autoFocus />
        </label>
        <label className="plano-campo">
          <span>Dirección</span>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={300} />
        </label>
        <label className="plano-campo">
          <span>Canastillas que ocupa</span>
          <input
            type="number"
            min={1}
            max={500}
            value={canastillas}
            onChange={(e) => setCanastillas(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          />
        </label>
        <label className="plano-campo pl-campo-ancho">
          <span>Nota para quien reparte</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} rows={2} />
        </label>
      </div>
      <p className="pl-meta">
        Ocupa sitio en el furgón y aparece en el plano y en la relación de productos, pero no tiene factura: no hay
        pedido detrás.
      </p>
    </Modal>
  );
}

// =====================================================================
// Punto inicial y final del recorrido
// =====================================================================
function ModalRecorrido({
  vehiculo,
  onCerrar,
  onGuardar,
}: {
  vehiculo: VehiculoLote;
  onCerrar: () => void;
  onGuardar: (inicio: PuntoRecorrido | null, fin: PuntoRecorrido | null) => void;
}) {
  const [inicio, setInicio] = useState<PuntoRecorrido>(vehiculo.inicio ?? { nombre: "", direccion: "" });
  const [fin, setFin] = useState<PuntoRecorrido>(vehiculo.fin ?? { nombre: "", direccion: "" });
  const limpio = (p: PuntoRecorrido) => (p.nombre.trim() || p.direccion.trim() ? { nombre: p.nombre.trim(), direccion: p.direccion.trim() } : null);
  return (
    <Modal
      titulo={`Recorrido de ${vehiculo.nombre}`}
      subtitulo="Desde dónde sale y a dónde regresa el vehículo. Sale impreso en la guía de carga y en la relación de productos."
      onCerrar={onCerrar}
      amplio
      medio
      cerrarConEscape
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn primario" onClick={() => onGuardar(limpio(inicio), limpio(fin))}>
            <Flag size={15} /> Guardar el recorrido
          </button>
        </>
      }
    >
      <div className="pl-ajuste-grid">
        <label className="plano-campo">
          <span>Punto inicial</span>
          <input value={inicio.nombre} onChange={(e) => setInicio({ ...inicio, nombre: e.target.value })} maxLength={120} placeholder="Bodega principal" />
        </label>
        <label className="plano-campo">
          <span>Dirección de salida</span>
          <input value={inicio.direccion} onChange={(e) => setInicio({ ...inicio, direccion: e.target.value })} maxLength={300} />
        </label>
        <label className="plano-campo">
          <span>Punto final</span>
          <input value={fin.nombre} onChange={(e) => setFin({ ...fin, nombre: e.target.value })} maxLength={120} placeholder="Bodega principal" />
        </label>
        <label className="plano-campo">
          <span>Dirección de regreso</span>
          <input value={fin.direccion} onChange={(e) => setFin({ ...fin, direccion: e.target.value })} maxLength={300} />
        </label>
      </div>
      <button
        type="button"
        className="pl-enlace"
        onClick={() => setFin({ ...inicio })}
        disabled={!inicio.nombre && !inicio.direccion}
      >
        Regresa al mismo punto de salida
      </button>
    </Modal>
  );
}

// =====================================================================
// Nombre y notas del lote
// =====================================================================
function ModalNombre({
  lote,
  onCerrar,
  onGuardar,
}: {
  lote: Lote;
  onCerrar: () => void;
  onGuardar: (nombre: string, notas: string) => void;
}) {
  const [nombre, setNombre] = useState(lote.nombre);
  const [notas, setNotas] = useState(lote.notas);
  return (
    <Modal
      titulo={`Lote #${lote.numero}`}
      onCerrar={onCerrar}
      amplio
      medio
      cerrarConEscape
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn primario" onClick={() => onGuardar(nombre.trim(), notas)}>
            <Save size={15} /> Guardar
          </button>
        </>
      }
    >
      <div className="pl-ajuste-grid">
        <label className="plano-campo pl-campo-ancho">
          <span>Nombre (opcional)</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Despacho del martes" autoFocus />
        </label>
        <label className="plano-campo pl-campo-ancho">
          <span>Notas internas</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={2000} />
        </label>
      </div>
    </Modal>
  );
}

// =====================================================================
// Bitácora
// =====================================================================
function ModalBitacora({ lote, onCerrar }: { lote: Lote; onCerrar: () => void }) {
  return (
    <Modal
      titulo={`Bitácora del lote #${lote.numero}`}
      subtitulo="Cada decisión que alguien tomó sobre este lote, en orden."
      onCerrar={onCerrar}
      amplio
      cerrarConEscape
    >
      {lote.eventos.length === 0 ? (
        <p className="pl-vacio-suave">Todavía no hay movimientos.</p>
      ) : (
        <ol className="lote-bitacora">
          {lote.eventos.map((e) => (
            <li key={e.id} className={`lote-evento tipo-${e.tipo.toLowerCase()}`}>
              <div className="lote-evento-cab">
                <Pastilla tono={e.tipo === "AJUSTE" ? "ambar" : e.tipo === "CONFIRMADO" ? "verde" : "neutro"}>
                  {e.tipo_etiqueta}
                </Pastilla>
                <span className="pl-meta">
                  {momento(e.cuando)} · {e.usuario}
                </span>
              </div>
              <p>{e.detalle}</p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

// =====================================================================
// Resumen de confirmación
// =====================================================================
function ModalResumen({
  lote,
  confirmando,
  onCerrar,
  onConfirmar,
  onDocumento,
}: {
  lote: Lote;
  confirmando: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
  onDocumento: (doc: DocumentoLote) => void;
}) {
  const r = lote.resumen;
  const conCarga = lote.vehiculos.filter((v) => v.paradas.length);
  return (
    <Modal
      titulo={`Confirmar el lote #${lote.numero}`}
      subtitulo={`${fechaLarga(lote.fecha)} · lo que se va a despachar y lo que queda fuera`}
      onCerrar={onCerrar}
      amplio
      ancho
      cerrarConEscape
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Seguir corrigiendo
          </button>
          <button type="button" className="btn primario" disabled={!r.puede_confirmar || confirmando} onClick={onConfirmar}>
            <ShieldCheck size={15} /> {confirmando ? "Confirmando…" : "Confirmar el lote"}
          </button>
        </>
      }
    >
      <div className="lote-resumen-cifras">
        {[
          { etq: "Pedidos", valor: r.pedidos_asignados, pie: `de ${r.pedidos_total} del lote` },
          { etq: "Clientes", valor: r.clientes, pie: `${r.paradas} paradas` },
          { etq: "Vehículos", valor: r.vehiculos, pie: `de ${r.vehiculos_disponibles} disponibles` },
          { etq: "Canastillas", valor: r.canastillas, pie: r.capacidad ? `de ${r.capacidad} de capacidad` : "sin capacidad conocida" },
          { etq: "Peso estimado", valor: r.peso_kg ? `${fmt(Math.round(r.peso_kg))} kg` : "—", pie: r.peso_kg ? "con reglas de carga" : "faltan reglas" },
          { etq: "Despachos", valor: `${r.despachos_confirmados} / ${r.despachos}`, pie: "confirmados" },
        ].map((c) => (
          <div key={c.etq} className="lote-cifra">
            <b>{typeof c.valor === "number" ? fmt(c.valor) : c.valor}</b>
            <span>{c.etq}</span>
            <small>{c.pie}</small>
          </div>
        ))}
      </div>

      {r.errores.length > 0 && (
        <div className="lote-validaciones error">
          <h3>
            <AlertTriangle size={15} /> Hay que corregir antes de confirmar
          </h3>
          <ul>
            {r.errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {r.advertencias.length > 0 && (
        <div className="lote-validaciones aviso">
          <h3>
            <AlertTriangle size={15} /> Avisos (no impiden confirmar)
          </h3>
          <ul>
            {r.advertencias.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {r.pedidos_sin_asignar > 0 && (
        <div className="lote-validaciones aviso">
          <h3>
            <Inbox size={15} /> {r.pedidos_sin_asignar} pedidos sin vehículo
          </h3>
          <ul>
            {lote.sin_asignar.slice(0, 8).map((p) => (
              <li key={p.id}>
                #{p.id} · {p.cliente_nombre} — {p.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="lote-subtitulo">Qué sale en cada vehículo</h3>
      <div className="tabla-scroll">
        <table className="gestion-tabla">
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Recorrido</th>
              <th className="num">Paradas</th>
              <th className="num">Pedidos</th>
              <th className="num">Canastillas</th>
              <th>Plano de carga</th>
            </tr>
          </thead>
          <tbody>
            {conCarga.map((v) => (
              <tr key={v.clave}>
                <td>
                  <strong>{v.nombre}</strong>
                  {v.furgon?.placa && <small className="pl-meta"> {v.furgon.placa}</small>}
                </td>
                <td className="pl-meta">
                  {v.inicio?.nombre || v.inicio?.direccion || "—"} → {v.fin?.nombre || v.fin?.direccion || "—"}
                </td>
                <td className="num">{v.metricas.paradas}</td>
                <td className="num">{v.metricas.pedidos}</td>
                <td className="num">
                  {v.metricas.canastillas}
                  {v.metricas.capacidad ? ` / ${v.metricas.capacidad}` : ""}
                </td>
                <td>
                  {v.despacho ? (
                    <Pastilla tono={v.despacho.estado === "CONFIRMADO" ? "verde" : v.despacho.listo ? "verde" : "ambar"}>
                      {v.despacho.estado === "CONFIRMADO" ? "Confirmado" : v.despacho.listo ? "Listo" : "Con errores"}
                    </Pastilla>
                  ) : (
                    <Pastilla tono="ambar">Sin generar</Pastilla>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="lote-subtitulo">Documentos que quedan listos</h3>
      <div className="lote-documentos">
        {(["planos", "productos", "facturas", "todo"] as DocumentoLote[]).map((d) => (
          <button key={d} type="button" className="btn secundario sm" onClick={() => onDocumento(d)}>
            <FileDown size={14} /> {ETIQUETAS_DOCUMENTO[d]}
          </button>
        ))}
      </div>
    </Modal>
  );
}
