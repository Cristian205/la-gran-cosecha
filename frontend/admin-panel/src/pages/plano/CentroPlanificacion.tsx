import {
  AlertTriangle,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleSlash,
  ClipboardList,
  FileDown,
  GripVertical,
  Inbox,
  Layers,
  MapPin,
  Package,
  PackageX,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  Undo2,
  Wand2,
  Weight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  confirmarPlano,
  consultarDia,
  consultarRejilla,
  descargarPdfPlano,
  eliminarAjuste,
  generarDespachos,
  guardarAjuste,
  listarAjustes,
  type CapacidadVehiculo,
  type Furgon,
  type PedidoPlanificacion,
  type PropuestaDia,
  type TipoCanastilla,
  type VehiculoPropuesta,
} from "../../api/logistica";
import { obtenerTodosLosClientes } from "../../api/resources";
import { EstadoVacio, MenuFila, Pastilla, TarjetaKpi, type AccionMenu, type Tono } from "../../components/gestion/Gestion";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import type { Cliente } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarAccion, confirmarDescartar } from "../../utils/alertas";
import { COLORES_GRUPO } from "./acomodo";
import { EditorParadas, type ParadaEditable } from "./EditorParadas";

/**
 * Centro de planificación diaria.
 *
 * El servidor propone (pedidos reales del día × rutas de la programación
 * activa); aquí el administrador revisa y corrige la propuesta —mover un
 * pedido o una parada de vehículo, reordenar, fijar canastillas— y la
 * convierte en despachos: uno por vehículo, con su plano de carga 3D.
 *
 * Nada de esta pantalla se guarda hasta pulsar «Generar despachos». Los
 * despachos generados quedan en borrador: se ajustan en el constructor 3D y
 * se confirman desde aquí o desde el editor.
 */

interface ParadaLocal {
  key: string;
  cliente_id: number | null;
  nombre: string;
  direccion: string;
  telefono: string;
  en_ruta: boolean;
  nota_ruta: string;
  pedidos: PedidoPlanificacion[];
  /** Fijadas a mano (o vienen de un despacho ya armado). */
  manual: boolean;
  canastillas: number;
}

type VehiculoLocal = Omit<VehiculoPropuesta, "paradas" | "origen"> & {
  origen: VehiculoPropuesta["origen"];
  paradas: ParadaLocal[];
};

type Arrastre = { tipo: "parada"; clave: string; idx: number } | { tipo: "pedido"; id: number };

const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
export const mananaIso = () => sumarDias(isoLocal(new Date()), 1);
const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const claveParada = (cliente: number | null, pedido: number) => (cliente !== null ? `c${cliente}` : `p${pedido}`);

/** Canastillas estimadas con las reglas de carga (fracciones sumadas, hacia arriba). */
function estimar(pedidos: PedidoPlanificacion[]): number {
  return Math.max(1, Math.ceil(pedidos.reduce((a, p) => a + (p.fraccion || 0), 0) - 1e-9));
}

function canastillasDe(p: ParadaLocal): number {
  return p.manual ? p.canastillas : estimar(p.pedidos);
}

function pesoDe(pedidos: PedidoPlanificacion[]): number | null {
  if (!pedidos.length || pedidos.some((p) => p.peso_kg == null)) return null;
  return pedidos.reduce((a, p) => a + (p.peso_kg ?? 0), 0);
}

/** Productos de varios pedidos, sumados por presentación (misma unidad). */
function consolidar(pedidos: PedidoPlanificacion[]) {
  const m = new Map<string, { producto: string; unidad: string; cantidad: number; pedidos: Array<{ id: number; cantidad: string }>; notas: string[]; con_regla: boolean }>();
  for (const p of pedidos)
    for (const pr of p.productos) {
      const e = m.get(pr.clave) ?? { producto: pr.producto, unidad: pr.unidad, cantidad: 0, pedidos: [], notas: [], con_regla: pr.con_regla };
      e.cantidad += Number(pr.cantidad);
      e.pedidos.push(...pr.pedidos);
      for (const n of pr.notas) if (!e.notas.includes(n)) e.notas.push(n);
      m.set(pr.clave, e);
    }
  return [...m.values()].sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}

function aLocal(p: PropuestaDia): VehiculoLocal[] {
  return p.vehiculos.map((v) => ({
    ...v,
    paradas: v.paradas.map((par) => ({
      key: claveParada(par.cliente_id, par.pedidos[0]?.id ?? 0),
      cliente_id: par.cliente_id,
      nombre: par.nombre,
      direccion: par.direccion,
      telefono: par.telefono,
      en_ruta: par.en_ruta,
      nota_ruta: par.nota_ruta,
      pedidos: par.pedidos,
      manual: par.canastillas_manual,
      canastillas: par.canastillas,
    })),
  }));
}

interface Metricas {
  canastillas: number;
  capacidad: number | null;
  tope: number | null;
  peso: number | null;
  pedidos: number;
  pct: number;
  exceso: string | null;
  incompleta: string | null;
}

function metricas(v: VehiculoLocal): Metricas {
  const canastillas = v.paradas.reduce((a, p) => a + canastillasDe(p), 0);
  const pedidos = v.paradas.reduce((a, p) => a + p.pedidos.length, 0);
  const capacidad = v.capacidad?.canastillas ?? null;
  const tope = v.capacidad?.tope_por_peso ?? null;
  const peso = v.paradas.length ? pesoDe(v.paradas.flatMap((p) => p.pedidos)) : null;
  const limite = Math.min(capacidad ?? Infinity, tope ?? Infinity);
  let exceso: string | null = null;
  if (capacidad != null && canastillas > capacidad) exceso = `Sobrecapacidad: ${canastillas} canastillas y caben ${capacidad}.`;
  else if (tope != null && canastillas > tope) exceso = `Supera la carga útil: el peso permite ${tope} canastillas.`;
  else if (peso != null && v.capacidad?.carga_util_kg && peso > v.capacidad.carga_util_kg)
    exceso = `El peso de los productos (${fmt(Math.round(peso))} kg) supera la carga útil (${fmt(v.capacidad.carga_util_kg)} kg).`;
  let incompleta: string | null = null;
  if (!v.furgon) incompleta = "La ruta no tiene vehículo.";
  else if (!v.furgon.activo) incompleta = `«${v.furgon.nombre}» está inactivo.`;
  else if (v.capacidad?.errores?.length) incompleta = v.capacidad.errores[0];
  return { canastillas, capacidad, tope, peso, pedidos, pct: Number.isFinite(limite) && limite > 0 ? Math.round((canastillas / limite) * 100) : 0, exceso, incompleta };
}

interface Props {
  fecha: string;
  onFecha: (fecha: string) => void;
  furgones: Furgon[];
  canastillas: TipoCanastilla[];
  puedeArmar: boolean;
  onAbrirDespacho: (id: number) => void;
  onIrARutas: () => void;
  onDespachosCambiaron: () => void;
}

export default function CentroPlanificacion({ fecha, onFecha, furgones, canastillas, puedeArmar, onAbrirDespacho, onIrARutas, onDespachosCambiaron }: Props) {
  const [tipo, setTipo] = useState<number | "">(() => canastillas.find((c) => c.activa)?.id ?? "");
  const [propuesta, setPropuesta] = useState<PropuestaDia | null>(null);
  const [vehiculos, setVehiculos] = useState<VehiculoLocal[]>([]);
  const [sinAsignar, setSinAsignar] = useState<PedidoPlanificacion[]>([]);
  const [liberados, setLiberados] = useState<Set<number>>(new Set());
  const [sucio, setSucio] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [ajuste, setAjuste] = useState<VehiculoLocal | "extra" | null>(null);
  const [agregando, setAgregando] = useState(false);
  const arrastre = useRef<Arrastre | null>(null);
  const [sobre, setSobre] = useState<{ clave: string; idx: number } | null>(null);

  const tipoActual = canastillas.find((c) => c.id === tipo) ?? null;

  const cargar = useCallback(async () => {
    if (tipo === "") return;
    setCargando(true);
    try {
      const p = await consultarDia(fecha, tipo);
      setPropuesta(p);
      setVehiculos(aLocal(p));
      setSinAsignar(p.sin_asignar);
      setLiberados(new Set());
      setSucio(false);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo cargar la planificación del día."));
    } finally {
      setCargando(false);
    }
  }, [fecha, tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  async function puedeDescartar() {
    return !sucio || (await confirmarDescartar("La distribución tiene cambios que aún no se convierten en despachos."));
  }

  async function cambiarFecha(nueva: string) {
    if (nueva === fecha || !nueva || !(await puedeDescartar())) return;
    onFecha(nueva);
  }

  // ---------------- Operaciones sobre la propuesta ----------------
  // Cada acción del usuario es UNA actualización: se clona el estado, se
  // aplican las operaciones puras de abajo y se publica el resultado.
  function modificar(fn: (e: EstadoLocal) => void) {
    const e: EstadoLocal = {
      vs: vehiculos.map((v) => ({ ...v, paradas: v.paradas.map((p) => ({ ...p, pedidos: [...p.pedidos] })) })),
      sa: [...sinAsignar],
      lib: new Set(liberados),
    };
    fn(e);
    setVehiculos(e.vs);
    setSinAsignar(e.sa);
    setLiberados(e.lib);
    setSucio(true);
  }

  const asignarPedido = (id: number, clave: string, idx?: number) => modificar((e) => opAsignar(e, id, clave, idx));
  const desasignarPedido = (id: number) => modificar((e) => opDesasignar(e, id));

  function moverParada(desde: string, idx: number, hacia: string, destinoIdx: number) {
    modificar(({ vs }) => {
      const o = vs.find((v) => v.clave === desde);
      const d = vs.find((v) => v.clave === hacia);
      if (!o || !d || o.bloqueado || d.bloqueado) return;
      const [par] = o.paradas.splice(idx, 1);
      if (!par) return;
      const ajustado = o === d && destinoIdx > idx ? destinoIdx - 1 : destinoIdx;
      const mismo = d.paradas.find((p) => par.cliente_id !== null && p.cliente_id === par.cliente_id);
      if (mismo) {
        mismo.pedidos.push(...par.pedidos);
        mismo.manual = false;
      } else {
        par.en_ruta = d.ruta_paradas.some((r) => r.cliente_id === par.cliente_id);
        d.paradas.splice(Math.min(Math.max(0, ajustado), d.paradas.length), 0, par);
      }
    });
  }

  function fijarCanastillas(clave: string, key: string, n: number) {
    modificar(({ vs }) => {
      const par = vs.find((v) => v.clave === clave)?.paradas.find((p) => p.key === key);
      if (par) {
        par.canastillas = Math.max(1, Math.min(500, Math.round(n) || 1));
        par.manual = true;
      }
    });
  }

  function reestimar(clave: string, key: string) {
    modificar(({ vs }) => {
      const par = vs.find((v) => v.clave === clave)?.paradas.find((p) => p.key === key);
      if (par) par.manual = false;
    });
  }

  /** Reparte los pendientes cuyo cliente está en alguna ruta del día (p. ej. tras liberarlos). */
  function asignarPorRuta() {
    modificar((e) => {
      for (const p of [...e.sa]) {
        const v = e.vs.find((x) => !x.bloqueado && x.ruta_paradas.some((r) => r.cliente_id === p.cliente_id));
        if (v) opAsignar(e, p.id, v.clave);
      }
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
    else
      modificar((e) => {
        const par = e.vs.find((v) => v.clave === a.clave)?.paradas[a.idx];
        par?.pedidos.map((p) => p.id).forEach((id) => opDesasignar(e, id));
      });
  }

  // ---------------- Vehículos ----------------
  async function agregarVehiculo(f: Furgon) {
    if (tipo === "") return;
    try {
      const r = await consultarRejilla(f.id, tipo);
      const peso = tipoActual?.peso_lleno_kg ? Number(tipoActual.peso_lleno_kg) : null;
      const capacidad: CapacidadVehiculo = {
        canastillas: r.capacidad,
        posiciones: r.pilas.length,
        niveles: r.niveles,
        carga_util_kg: f.carga_util_kg,
        tope_por_peso: peso && f.carga_util_kg ? Math.floor(f.carga_util_kg / peso) : null,
        errores: r.errores,
      };
      setVehiculos((vs) => [
        ...vs,
        {
          clave: `f${f.id}`,
          ruta_id: null,
          ajuste_id: null,
          origen: "manual",
          nombre: f.nombre,
          color: COLORES_GRUPO[vs.length % COLORES_GRUPO.length],
          furgon: { id: f.id, nombre: f.nombre, placa: f.placa, modelo_3d: f.modelo_3d, carga_util_kg: f.carga_util_kg, activo: f.activo },
          capacidad,
          despacho: null,
          bloqueado: false,
          paradas: [],
          ruta_paradas: [],
          paradas_sin_pedido: [],
          ruta_total_paradas: 0,
        },
      ]);
      setSucio(true);
      setAgregando(false);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo calcular la capacidad del vehículo."));
    }
  }

  function quitarVehiculoManual(clave: string) {
    modificar((e) => {
      const v = e.vs.find((x) => x.clave === clave);
      v?.paradas.flatMap((p) => p.pedidos.map((x) => x.id)).forEach((id) => opDesasignar(e, id));
      e.vs = e.vs.filter((x) => x.clave !== clave);
    });
  }

  // ---------------- Generar, confirmar, PDF ----------------
  const totales = useMemo(() => {
    const ms = vehiculos.map(metricas);
    return {
      canastillas: ms.reduce((a, m) => a + m.canastillas, 0),
      conPedidos: vehiculos.filter((v) => v.paradas.length).length,
      excedidos: ms.filter((m) => m.exceso).length,
      incompletos: vehiculos.filter((v, i) => v.paradas.length && ms[i].incompleta).length,
    };
  }, [vehiculos]);
  const despachos = propuesta?.despachos ?? [];
  const listos = despachos.filter((d) => d.listo).length;
  const confirmados = despachos.filter((d) => d.estado === "CONFIRMADO").length;
  const pendientesGenerar = vehiculos.some((v) => !v.bloqueado && v.paradas.length && (!v.despacho || sucio));
  const puedeGenerar = puedeArmar && tipo !== "" && !totales.incompletos && (sucio || pendientesGenerar);

  async function generar() {
    if (tipo === "" || !propuesta) return;
    const lista = vehiculos.filter((v) => !v.bloqueado && v.furgon && (v.paradas.length || v.despacho));
    if (totales.excedidos) {
      const ok = await confirmarAccion(
        "Hay vehículos sobre su capacidad",
        "Se generan igual, pero las canastillas que no caben quedan sin lugar y el despacho no se podrá confirmar hasta corregirlo.",
        "Generar de todos modos"
      );
      if (!ok) return;
    }
    setGenerando(true);
    try {
      const r = await generarDespachos(
        fecha,
        tipo,
        lista.map((v) => ({
          clave: v.clave,
          furgon: v.furgon!.id,
          nombre: v.nombre,
          paradas: v.paradas.map((p) => ({ cliente: p.cliente_id, pedidos: p.pedidos.map((x) => x.id), canastillas: canastillasDe(p) })),
        })),
        [...liberados].filter((id) => sinAsignar.some((p) => p.id === id))
      );
      setPropuesta(r.propuesta);
      setVehiculos(aLocal(r.propuesta));
      setSinAsignar(r.propuesta.sin_asignar);
      setLiberados(new Set());
      setSucio(false);
      onDespachosCambiaron();
      alertaExito(`${r.despachos.length} despacho${r.despachos.length === 1 ? "" : "s"} listo${r.despachos.length === 1 ? "" : "s"} para revisar en 3D`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudieron generar los despachos."));
    } finally {
      setGenerando(false);
    }
  }

  async function confirmar(id: number) {
    try {
      await confirmarPlano(id);
      alertaExito("Despacho confirmado: sus datos quedan congelados para la guía");
      onDespachosCambiaron();
      await cargar();
    } catch (e) {
      alertaError(extraerMensajeError(e, "El despacho tiene errores: ábrelo en 3D para corregirlos."));
    }
  }

  async function pdf(id: number) {
    try {
      const blob = await descargarPdfPlano(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo generar la guía en PDF."));
    }
  }

  async function abrir3D(id: number) {
    if (await puedeDescartar()) onAbrirDespacho(id);
  }

  async function restablecerRuta(ajusteId: number) {
    if (!(await puedeDescartar())) return;
    try {
      await eliminarAjuste(ajusteId);
      await cargar();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo restablecer la ruta."));
    }
  }

  // ---------------- Render ----------------
  if (!canastillas.length || !furgones.length) {
    return (
      <section className="panel gestion-modulo">
        <EstadoVacio icono={<Truck size={20} />} titulo="Primero registra un vehículo y una canastilla" texto="La planificación calcula la capacidad de cada vehículo con sus medidas reales." />
      </section>
    );
  }

  const usados = new Set(vehiculos.map((v) => v.furgon?.id));
  const libres = furgones.filter((f) => f.activo && !usados.has(f.id));
  const destinosMover = (actual: string | null) => vehiculos.filter((v) => !v.bloqueado && v.clave !== actual && v.furgon);

  return (
    <>
      {/* ---------- Barra del día ---------- */}
      <section className="panel pl-barra-dia" aria-label="Día que se planifica">
        <div className="pl-fecha">
          <button type="button" className="btn-icon" onClick={() => cambiarFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
            <ChevronLeft size={18} />
          </button>
          <label className="pl-fecha-campo">
            <CalendarDays size={16} aria-hidden="true" />
            <input type="date" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} aria-label="Fecha de entrega" />
          </label>
          <button type="button" className="btn-icon" onClick={() => cambiarFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">
            <ChevronRight size={18} />
          </button>
          <div className="pl-fecha-texto">
            <strong>{fechaLarga(fecha)}</strong>
            <span>
              {propuesta?.programacion ? (
                <>
                  <Route size={12} /> Programación «{propuesta.programacion.nombre}»
                </>
              ) : (
                <button type="button" className="pl-enlace" onClick={onIrARutas}>
                  Sin programación activa: configúrala
                </button>
              )}
            </span>
          </div>
        </div>
        <div className="pl-barra-acciones">
          <label className="pl-canastilla">
            <Package size={14} aria-hidden="true" />
            <select value={tipo} onChange={(e) => setTipo(e.target.value ? Number(e.target.value) : "")} aria-label="Canastilla">
              {canastillas
                .filter((c) => c.activa || c.id === tipo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.largo_cm}×{c.ancho_cm}×{c.alto_cm})
                  </option>
                ))}
            </select>
          </label>
          <Tooltip label="Volver a calcular la propuesta" posicion="abajo">
            <button
              type="button"
              className="btn-icon gestion-actualizar-icono"
              aria-label="Volver a calcular"
              disabled={cargando}
              onClick={async () => {
                if (await puedeDescartar()) cargar();
              }}
            >
              <RefreshCw size={16} className={cargando ? "girando" : ""} />
            </button>
          </Tooltip>
          {puedeArmar && (
            <button type="button" className="btn primario" disabled={!puedeGenerar || generando || cargando} onClick={generar}>
              <Wand2 size={16} /> {generando ? "Generando…" : sucio ? "Generar despachos" : "Generar / actualizar despachos"}
            </button>
          )}
        </div>
      </section>

      {/* ---------- Indicadores ---------- */}
      <div className="kpis-gestion">
        <TarjetaKpi tono="neutro" icono={<ClipboardList size={18} />} etiqueta="Pedidos del día" descripcion="Pedidos de la tienda que se entregan este día" valor={cargando ? null : fmt(propuesta?.resumen.pedidos ?? 0)} pie={!cargando && `${propuesta?.resumen.clientes ?? 0} clientes`} />
        <TarjetaKpi
          tono={sinAsignar.length ? "ambar" : "verde"}
          icono={<Inbox size={18} />}
          etiqueta="Sin asignar"
          descripcion="Pedidos fuera de ruta o que se retiraron de su vehículo"
          valor={cargando ? null : fmt(sinAsignar.length)}
          pie={!cargando && (sinAsignar.length ? "requieren decisión manual" : "todos tienen vehículo")}
        />
        <TarjetaKpi
          tono="azul"
          icono={<Truck size={18} />}
          etiqueta="Vehículos con carga"
          descripcion="Vehículos del día que llevan al menos un pedido"
          valor={cargando ? null : `${totales.conPedidos} / ${vehiculos.length}`}
          pie={!cargando && (totales.excedidos ? `${totales.excedidos} sobre su capacidad` : "dentro de su capacidad")}
        />
        <TarjetaKpi tono="violeta" icono={<Package size={18} />} etiqueta="Canastillas" descripcion="Canastillas de todos los vehículos" valor={cargando ? null : fmt(totales.canastillas)} pie={!cargando && "estimadas o fijadas"} />
        <TarjetaKpi
          tono={listos ? "verde" : "neutro"}
          icono={<ShieldCheck size={18} />}
          etiqueta="Despachos"
          descripcion="Despachos confirmados de los generados para este día"
          valor={cargando ? null : `${confirmados} / ${despachos.length}`}
          pie={!cargando && (listos ? `${listos} listo${listos === 1 ? "" : "s"} para confirmar` : "confirmados")}
        />
      </div>

      {sucio && (
        <div className="pl-aviso-cambios" role="status">
          <Sparkles size={16} />
          <span>Cambiaste la distribución. Pulsa <strong>Generar despachos</strong> para crear o actualizar los planos de carga.</span>
          <button
            type="button"
            className="btn secundario sm"
            onClick={async () => {
              if (await puedeDescartar()) cargar();
            }}
          >
            <Undo2 size={14} /> Descartar cambios
          </button>
        </div>
      )}

      <div className="pl-tablero">
        {/* ---------- Pendientes ---------- */}
        <aside
          className={`panel pl-pendientes ${sobre?.clave === "__pendientes" ? "destino" : ""}`}
          aria-label="Pedidos sin asignar"
          onDragOver={(e) => {
            if (!arrastre.current) return;
            e.preventDefault();
            setSobre({ clave: "__pendientes", idx: 0 });
          }}
          onDrop={alSoltarPendientes}
        >
          <div className="pl-col-cab">
            <h2>
              <Inbox size={16} /> Pendientes de asignación
            </h2>
            <span className={`pl-contador ${sinAsignar.length ? "alerta" : ""}`}>{sinAsignar.length}</span>
          </div>
          {sinAsignar.some((p) => vehiculos.some((v) => !v.bloqueado && v.ruta_paradas.some((r) => r.cliente_id === p.cliente_id))) && (
            <button type="button" className="btn secundario sm pl-ancho" onClick={asignarPorRuta}>
              <Route size={14} /> Asignar por ruta
            </button>
          )}
          {cargando ? (
            <div className="skeleton-line skeleton-shimmer" style={{ height: 80 }} />
          ) : sinAsignar.length === 0 ? (
            <p className="pl-vacio-suave">
              <CheckCircle2 size={16} /> Todos los pedidos del día tienen vehículo.
            </p>
          ) : (
            <ul className="pl-pendientes-lista">
              {sinAsignar.map((p) => (
                <li
                  key={p.id}
                  className="pl-pendiente"
                  draggable={puedeArmar}
                  onDragStart={() => (arrastre.current = { tipo: "pedido", id: p.id })}
                  onDragEnd={() => {
                    arrastre.current = null;
                    setSobre(null);
                  }}
                >
                  <div className="pl-pendiente-cab">
                    {puedeArmar && <GripVertical size={14} className="pl-asa" aria-hidden="true" />}
                    <strong>{p.cliente_nombre}</strong>
                    <span className="pl-pedido-num">#{p.id}</span>
                  </div>
                  <small className="pl-motivo">
                    <AlertTriangle size={12} /> {p.motivo}
                  </small>
                  <small className="pl-meta">
                    {p.productos.length} producto{p.productos.length === 1 ? "" : "s"} · ≈ {p.canastillas} canastilla{p.canastillas === 1 ? "" : "s"}
                    {p.direccion ? ` · ${p.direccion}` : ""}
                  </small>
                  {puedeArmar && (
                    <select className="pl-select pl-select-sm" value="" onChange={(e) => e.target.value && asignarPedido(p.id, e.target.value)} aria-label={`Asignar el pedido ${p.id} a un vehículo`}>
                      <option value="">Asignar a vehículo…</option>
                      {destinosMover(null).map((v) => (
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

          {!!propuesta?.rutas_canceladas.length && (
            <div className="pl-canceladas">
              <h3>
                <CircleSlash size={14} /> No salen este día
              </h3>
              {propuesta.rutas_canceladas.map((c) => (
                <div key={c.clave} className="pl-cancelada">
                  <span>
                    <strong>{c.nombre}</strong>
                    {c.motivo && <small>{c.motivo}</small>}
                  </span>
                  {puedeArmar && (
                    <button type="button" className="btn secundario sm" onClick={() => restablecerRuta(c.ajuste_id)}>
                      Restaurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ---------- Vehículos ---------- */}
        <section className="pl-vehiculos" aria-label="Vehículos del día">
          {!cargando && vehiculos.length === 0 && (
            <section className="panel gestion-modulo">
              <EstadoVacio
                icono={<Route size={20} />}
                titulo={`Ninguna ruta programada el ${propuesta?.dia_nombre.toLowerCase() ?? "día"}`}
                texto="Configura la programación semanal, agrega una ruta extra para esta fecha o agrega un vehículo a mano."
                accion={
                  <button type="button" className="btn secundario sm" onClick={onIrARutas}>
                    <Route size={14} /> Ir a la programación semanal
                  </button>
                }
              />
            </section>
          )}
          {vehiculos.map((v) => {
            const m = metricas(v);
            const estado = estadoVehiculo(v, m, sucio);
            const acciones: AccionMenu[] = [];
            if (puedeArmar && !v.bloqueado && (v.origen === "ruta" || v.origen === "ajuste" || v.origen === "extra"))
              acciones.push({ clave: "ajustar", tono: "editar", etiqueta: "Ajustar la ruta solo este día", icono: <Route size={15} />, onSeleccionar: () => setAjuste(v) });
            if (puedeArmar && v.ajuste_id && v.origen === "ajuste")
              acciones.push({ clave: "restablecer", tono: "info", etiqueta: "Volver a la ruta habitual", icono: <Undo2 size={15} />, onSeleccionar: () => restablecerRuta(v.ajuste_id!) });
            if (puedeArmar && v.ajuste_id && v.origen === "extra" && !v.despacho)
              acciones.push({ clave: "eliminar-extra", etiqueta: "Eliminar la ruta extra", icono: <CircleSlash size={15} />, peligro: true, onSeleccionar: () => restablecerRuta(v.ajuste_id!) });
            if (puedeArmar && v.origen === "manual")
              acciones.push({ clave: "quitar", etiqueta: "Quitar este vehículo", icono: <CircleSlash size={15} />, peligro: true, onSeleccionar: () => quitarVehiculoManual(v.clave) });
            return (
              <article
                key={v.clave}
                className={`panel pl-vehiculo ${m.exceso ? "excede" : ""} ${v.bloqueado ? "bloqueado" : ""} ${sobre?.clave === v.clave ? "destino" : ""}`}
                style={{ "--ruta": v.color } as CSSProperties}
                onDragOver={(e) => {
                  if (!arrastre.current || v.bloqueado || !puedeArmar) return;
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
                    <li className="pl-soltar-aqui">{v.bloqueado ? "Despacho confirmado" : "Arrastra aquí un pedido o una parada"}</li>
                  )}
                  {v.paradas.map((par, i) => {
                    const abierta = abiertas.has(`${v.clave}:${par.key}`);
                    const canas = canastillasDe(par);
                    const sinRegla = [...new Set(par.pedidos.flatMap((p) => p.sin_regla))];
                    const productos = consolidar(par.pedidos);
                    return (
                      <li
                        key={par.key}
                        className={`pl-parada-v ${sobre?.clave === v.clave && sobre.idx === i ? "antes" : ""}`}
                        draggable={puedeArmar && !v.bloqueado}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          arrastre.current = { tipo: "parada", clave: v.clave, idx: i };
                        }}
                        onDragEnd={() => {
                          arrastre.current = null;
                          setSobre(null);
                        }}
                        onDragOver={(e) => {
                          if (!arrastre.current || v.bloqueado || !puedeArmar) return;
                          e.preventDefault();
                          e.stopPropagation();
                          if (sobre?.clave !== v.clave || sobre.idx !== i) setSobre({ clave: v.clave, idx: i });
                        }}
                      >
                        <div className="pl-parada-v-cab">
                          {puedeArmar && !v.bloqueado && <GripVertical size={14} className="pl-asa" aria-hidden="true" />}
                          <span className="pl-parada-num" style={{ background: COLORES_GRUPO[i % COLORES_GRUPO.length] }}>
                            {i + 1}
                          </span>
                          <button type="button" className="pl-parada-v-datos" onClick={() => setAbiertas((s) => toggle(s, `${v.clave}:${par.key}`))} aria-expanded={abierta}>
                            <strong>{par.nombre}</strong>
                            <small>
                              {par.pedidos.length} pedido{par.pedidos.length === 1 ? "" : "s"} · {productos.length} producto{productos.length === 1 ? "" : "s"}
                              {!par.en_ruta && v.origen !== "manual" && v.origen !== "despacho" ? " · fuera de ruta" : ""}
                            </small>
                          </button>
                          <label className="pl-canas" title={par.manual ? "Fijadas a mano" : "Estimadas con las reglas de carga"}>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={canas}
                              disabled={!puedeArmar || v.bloqueado}
                              onChange={(e) => fijarCanastillas(v.clave, par.key, Number(e.target.value))}
                              aria-label={`Canastillas de ${par.nombre}`}
                            />
                            <span>{par.manual ? "fijadas" : "estim."}</span>
                          </label>
                          {puedeArmar && !v.bloqueado && (
                            <div className="pl-parada-v-orden">
                              <button type="button" className="btn-icon" disabled={i === 0} onClick={() => moverParada(v.clave, i, v.clave, i - 1)} aria-label={`Entregar antes a ${par.nombre}`}>
                                <ChevronUp size={14} />
                              </button>
                              <button type="button" className="btn-icon" disabled={i === v.paradas.length - 1} onClick={() => moverParada(v.clave, i, v.clave, i + 2)} aria-label={`Entregar después a ${par.nombre}`}>
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
                            {par.direccion && (
                              <p className="pl-meta">
                                <MapPin size={12} /> {par.direccion}
                                {par.telefono ? ` · ${par.telefono}` : ""}
                              </p>
                            )}
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
                                      {pr.pedidos.length > 1 && <small> ({pr.pedidos.map((x) => `#${x.id}: ${x.cantidad}`).join(" · ")})</small>}
                                      {pr.notas.length > 0 && <small className="pl-nota-prod">{pr.notas.join("; ")}</small>}
                                    </td>
                                    <td className="num">{fmt(pr.cantidad)}</td>
                                    <td>{pr.unidad}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <ul className="pl-pedidos">
                              {par.pedidos.map((p) => (
                                <li key={p.id}>
                                  <span className="pl-pedido-num">#{p.id}</span>
                                  <span className="pl-pedido-estado">{p.estado.toLowerCase()}</span>
                                  {(p.observaciones || p.indicaciones) && <small className="pl-meta">{[p.observaciones, p.indicaciones].filter(Boolean).join(" · ")}</small>}
                                  {p.aviso && <small className="pl-aviso-texto">{p.aviso}</small>}
                                  {puedeArmar && !v.bloqueado && (
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
                                      {destinosMover(v.clave).map((o) => (
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
                            {par.manual && puedeArmar && !v.bloqueado && (
                              <button type="button" className="pl-enlace" onClick={() => reestimar(v.clave, par.key)}>
                                Volver a estimar canastillas ({estimar(par.pedidos)})
                              </button>
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
                      <button type="button" className="btn primario sm" onClick={() => abrir3D(v.despacho!.id)}>
                        <Box size={14} /> Constructor 3D
                      </button>
                      <button type="button" className="btn secundario sm" onClick={() => pdf(v.despacho!.id)}>
                        <FileDown size={14} /> Guía PDF
                      </button>
                      {puedeArmar && v.despacho.listo && !sucio && (
                        <button type="button" className="btn secundario sm pl-btn-ok" onClick={() => confirmar(v.despacho!.id)}>
                          <ShieldCheck size={14} /> Confirmar
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="pl-meta">{v.paradas.length ? "Genera los despachos para ver su plano 3D" : "Sin pedidos asignados"}</span>
                  )}
                </footer>
              </article>
            );
          })}

          {puedeArmar && (
            <div className="pl-agregar">
              {agregando ? (
                <div className="panel pl-agregar-lista">
                  <strong>Elige el vehículo</strong>
                  {libres.length === 0 ? (
                    <p className="pl-meta">Todos los vehículos activos ya tienen ruta este día.</p>
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
                <>
                  <button type="button" className="pl-ruta-nueva" onClick={() => setAjuste("extra")}>
                    <Route size={20} />
                    <strong>Ruta extra solo para este día</strong>
                    <span>Se guarda como excepción de la fecha</span>
                  </button>
                  <button type="button" className="pl-ruta-nueva" onClick={() => setAgregando(true)}>
                    <Plus size={20} />
                    <strong>Agregar un vehículo</strong>
                    <span>Para pedidos fuera de ruta o extraordinarios</span>
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {ajuste && (
        <ModalAjuste
          fecha={fecha}
          vehiculo={ajuste === "extra" ? null : ajuste}
          furgones={furgones}
          onCerrar={() => setAjuste(null)}
          onGuardado={async () => {
            setAjuste(null);
            await cargar();
          }}
        />
      )}
    </>
  );
}

// ---------------- Operaciones puras sobre la propuesta ----------------
interface EstadoLocal {
  vs: VehiculoLocal[];
  sa: PedidoPlanificacion[];
  /** Pedidos que estaban en un borrador y se retiraron a mano. */
  lib: Set<number>;
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
        if (!par.pedidos.length) v.paradas = v.paradas.filter((x) => x !== par);
        else par.manual = false;
        return pedido;
      }
    }
  return null;
}

function opAsignar(e: EstadoLocal, id: number, clave: string, idx?: number) {
  const destino = e.vs.find((v) => v.clave === clave);
  if (!destino || destino.bloqueado) return;
  const pedido = opExtraer(e, id);
  if (!pedido) return;
  e.lib.delete(id);
  const existente = destino.paradas.find((p) => pedido.cliente_id !== null && p.cliente_id === pedido.cliente_id);
  if (existente) {
    existente.pedidos.push(pedido);
    existente.manual = false;
    return;
  }
  destino.paradas.splice(idx ?? destino.paradas.length, 0, {
    key: claveParada(pedido.cliente_id, pedido.id),
    cliente_id: pedido.cliente_id,
    nombre: pedido.cliente_nombre,
    direccion: pedido.direccion,
    telefono: pedido.telefono,
    en_ruta: destino.ruta_paradas.some((r) => r.cliente_id === pedido.cliente_id),
    nota_ruta: "",
    pedidos: [pedido],
    manual: false,
    canastillas: 1,
  });
}

function opDesasignar(e: EstadoLocal, id: number) {
  const pedido = opExtraer(e, id);
  if (!pedido) return;
  if (pedido.despacho?.estado === "BORRADOR") e.lib.add(id);
  e.sa.push({ ...pedido, motivo: "Retirado a mano de su vehículo." });
}

const ORIGEN: Record<VehiculoPropuesta["origen"], { texto: string; tono: Tono }> = {
  ruta: { texto: "Ruta habitual", tono: "neutro" },
  ajuste: { texto: "Ajustada este día", tono: "azul" },
  extra: { texto: "Ruta extra", tono: "violeta" },
  despacho: { texto: "Despacho manual", tono: "neutro" },
  manual: { texto: "Agregado hoy", tono: "violeta" },
};

function estadoVehiculo(v: VehiculoLocal, m: Metricas, sucio: boolean): { texto: string; tono: Tono } {
  if (v.bloqueado) return { texto: "Confirmado", tono: "verde" };
  if (m.exceso) return { texto: "Sobrecapacidad", tono: "ambar" };
  if (m.incompleta && v.paradas.length) return { texto: "Ruta incompleta", tono: "ambar" };
  if (!v.despacho) return v.paradas.length ? { texto: "Por generar", tono: "azul" } : { texto: "Sin pedidos", tono: "neutro" };
  if (sucio) return { texto: "Con cambios", tono: "azul" };
  if (v.despacho.listo) return { texto: "Listo para confirmar", tono: "verde" };
  return { texto: "Borrador con errores", tono: "ambar" };
}

function toggle(s: Set<string>, k: string): Set<string> {
  const n = new Set(s);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
}

// =====================================================================
// Ajuste de la ruta solo para esta fecha (o ruta extra)
// =====================================================================
function ModalAjuste({
  fecha,
  vehiculo,
  furgones,
  onCerrar,
  onGuardado,
}: {
  fecha: string;
  vehiculo: VehiculoLocal | null;
  furgones: Furgon[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState(vehiculo?.nombre ?? "Ruta extra");
  const [furgon, setFurgon] = useState<number | "">(vehiculo?.furgon?.id ?? furgones.find((f) => f.activo)?.id ?? "");
  const [color, setColor] = useState(vehiculo?.color ?? "#7c3aed");
  const [motivo, setMotivo] = useState("");
  const [cancelada, setCancelada] = useState(false);
  const [paradas, setParadas] = useState<ParadaEditable[]>(
    (vehiculo?.ruta_paradas ?? []).map((p) => ({ cliente: p.cliente_id, cliente_nombre: p.nombre, direccion: p.direccion, nota: p.nota }))
  );
  const [guardando, setGuardando] = useState(false);
  const ajusteId = vehiculo?.ajuste_id ?? null;

  useEffect(() => {
    obtenerTodosLosClientes()
      .then(setClientes)
      .catch(() => alertaError("No se pudieron cargar los clientes."));
    if (ajusteId)
      listarAjustes(fecha)
        .then((as) => {
          const a = as.find((x) => x.id === ajusteId);
          if (a) setMotivo(a.motivo);
        })
        .catch(() => undefined);
  }, [fecha, ajusteId]);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarAjuste(
        {
          fecha,
          ruta: vehiculo?.ruta_id ?? null,
          cancelada,
          nombre: nombre.trim(),
          furgon: cancelada ? null : furgon === "" ? null : furgon,
          color,
          motivo: motivo.trim(),
          paradas: paradas.map((p) => ({ cliente: p.cliente, nota: p.nota })),
        },
        ajusteId ?? undefined
      );
      alertaExito(cancelada ? "La ruta no sale este día" : "Ruta ajustada solo para esta fecha");
      onGuardado();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar el ajuste."));
    } finally {
      setGuardando(false);
    }
  }

  const titulo = vehiculo ? `Ajustar «${vehiculo.nombre}» solo este día` : "Ruta extra para este día";
  return (
    <Modal
      titulo={titulo}
      subtitulo={`${fechaLarga(fecha)} · la programación habitual no cambia`}
      onCerrar={onCerrar}
      amplio
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn primario" disabled={guardando || (!cancelada && (furgon === "" || !paradas.length))} onClick={guardar}>
            {guardando ? "Guardando…" : cancelada ? "Guardar: no sale" : "Guardar ajuste"}
          </button>
        </>
      }
    >
      <div className="pl-ajuste">
        {vehiculo?.ruta_id && (
          <label className="pl-check">
            <input type="checkbox" checked={cancelada} onChange={(e) => setCancelada(e.target.checked)} />
            <span>
              <strong>Esta ruta no sale este día</strong>
              <small>Sus clientes con pedido quedarán pendientes de asignación.</small>
            </span>
          </label>
        )}
        {!cancelada && (
          <div className="pl-ajuste-grid">
            <label className="plano-campo">
              <span>Nombre</span>
              <input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="plano-campo">
              <span>Vehículo</span>
              <select value={furgon} onChange={(e) => setFurgon(e.target.value ? Number(e.target.value) : "")}>
                {furgones
                  .filter((f) => f.activo || f.id === furgon)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                      {f.placa ? ` · ${f.placa}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="plano-campo pl-campo-color">
              <span>Color</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
          </div>
        )}
        <label className="plano-campo">
          <span>Motivo (opcional)</span>
          <input value={motivo} maxLength={200} placeholder="Ej. Turbo A en mantenimiento" onChange={(e) => setMotivo(e.target.value)} />
        </label>
        {!cancelada && (
          <div>
            <span className="pl-ruta-etq">
              <MapPin size={12} /> Secuencia de entrega de este día
            </span>
            <EditorParadas idBase="ajuste" paradas={paradas} clientes={clientes} editable onCambiar={setParadas} />
          </div>
        )}
        {!!ajusteId && (
          <p className="pl-meta">
            <AlertTriangle size={12} /> Este día ya tiene un ajuste: al guardar se reemplaza. Para volver a la ruta habitual usa «Volver a la ruta habitual» en el menú del vehículo.
          </p>
        )}
      </div>
    </Modal>
  );
}
