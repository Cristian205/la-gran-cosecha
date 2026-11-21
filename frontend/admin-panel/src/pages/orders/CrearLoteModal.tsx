import { AlertTriangle, CalendarDays, CheckCircle2, Layers, Package, Truck, Users, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { consultarElegibles, crearLote, type Elegibles } from "../../api/lotes";
import { listarCanastillas, type TipoCanastilla } from "../../api/logistica";
import { Modal } from "../../components/Modal";
import { EstadoVacio } from "../../components/gestion/Gestion";
import { extraerMensajeError } from "../../utils";
import { alertaError } from "../../utils/alertas";

/**
 * «Crear lote de despacho» desde la tabla de pedidos.
 *
 * Un lote agrupa pedidos de UNA fecha de entrega: es lo que hace que el
 * reparto entre turbos tenga sentido, porque las rutas son de un día de la
 * semana. Así que lo primero es elegir la fecha —el modal muestra las que
 * tienen pedidos sin planificar— y después qué pedidos de ese día entran.
 *
 * Lo que el servidor decide y aquí solo se muestra: qué pedidos son
 * elegibles (no entregados, sin lote vivo y sin despacho), su fecha de
 * entrega y cuántas canastillas ocupan según las reglas de carga.
 */

interface Props {
  /** Los pedidos marcados en la tabla: se preseleccionan si son elegibles. */
  seleccion: number[];
  onCerrar: () => void;
  /** El lote quedó creado: lleva al centro de preparación. */
  onCreado: (loteId: number) => void;
}

const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

export function CrearLoteModal({ seleccion, onCerrar, onCreado }: Props) {
  const [fechas, setFechas] = useState<Elegibles["fechas"] | null>(null);
  const [fecha, setFecha] = useState("");
  const [dia, setDia] = useState<Elegibles | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [canastillas, setCanastillas] = useState<TipoCanastilla[]>([]);
  const [tipo, setTipo] = useState<number | "">("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);

  // 1. Las fechas con pedidos sin planificar y las canastillas del negocio.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const [e, c] = await Promise.all([consultarElegibles(), listarCanastillas()]);
        if (!vigente) return;
        setFechas(e.fechas);
        setCanastillas(c);
        setTipo(c.find((x) => x.activa)?.id ?? "");
        // La fecha por omisión es la del primer pedido marcado en la tabla; si
        // no hay marcados (o no son elegibles), la primera fecha pendiente.
        setFecha(e.fechas[0]?.fecha ?? "");
      } catch (err) {
        if (vigente) alertaError(extraerMensajeError(err, "No se pudieron consultar los pedidos planificables."));
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // 2. Los pedidos de la fecha elegida.
  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    setCargando(true);
    (async () => {
      try {
        const d = await consultarElegibles(fecha);
        if (!vigente) return;
        setDia(d);
        const delDia = new Set(d.pedidos.map((p) => p.id));
        const previos = seleccion.filter((id) => delDia.has(id));
        setMarcados(new Set(previos.length ? previos : delDia));
      } catch (err) {
        if (vigente) alertaError(extraerMensajeError(err, "No se pudieron cargar los pedidos del día."));
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [fecha, seleccion]);

  const pedidos = dia?.pedidos ?? [];
  const elegidos = useMemo(() => pedidos.filter((p) => marcados.has(p.id)), [pedidos, marcados]);
  const totales = useMemo(
    () => ({
      pedidos: elegidos.length,
      clientes: new Set(elegidos.map((p) => p.cliente_id).filter((x) => x !== null)).size,
      canastillas: elegidos.reduce((a, p) => a + p.canastillas, 0),
      peso: elegidos.every((p) => p.peso_kg != null) ? elegidos.reduce((a, p) => a + (p.peso_kg ?? 0), 0) : null,
      sinRegla: [...new Set(elegidos.flatMap((p) => p.sin_regla))],
    }),
    [elegidos]
  );
  /** Marcados en la tabla que no se pueden planificar (ya van en otro despacho). */
  const descartados = useMemo(() => {
    if (!fechas) return [];
    const todos = new Set(pedidos.map((p) => p.id));
    return fecha && dia ? seleccion.filter((id) => !todos.has(id)) : [];
  }, [seleccion, pedidos, fechas, fecha, dia]);

  function alternar(id: number) {
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function crear() {
    if (tipo === "" || !fecha || !elegidos.length) return;
    setCreando(true);
    try {
      const lote = await crearLote({
        fecha,
        pedidos: elegidos.map((p) => p.id),
        tipo_canastilla: tipo,
        nombre: nombre.trim(),
      });
      onCreado(lote.id);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo crear el lote de despacho."));
    } finally {
      setCreando(false);
    }
  }

  const sinCanastilla = !cargando && canastillas.length === 0;
  const todos = pedidos.length > 0 && pedidos.every((p) => marcados.has(p.id));

  return (
    <Modal
      titulo="Crear lote de despacho"
      subtitulo="Agrupa los pedidos de una fecha de entrega y el sistema los reparte entre las turbos de ese día"
      onCerrar={onCerrar}
      amplio
      ancho
      cerrarConEscape
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primario"
            disabled={creando || cargando || !elegidos.length || tipo === ""}
            onClick={crear}
          >
            <Wand2 size={15} />{" "}
            {creando
              ? "Creando…"
              : `Crear lote y repartir ${totales.pedidos} pedido${totales.pedidos === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      {sinCanastilla ? (
        <EstadoVacio
          icono={<Package size={20} />}
          titulo="Falta registrar una canastilla"
          texto="El reparto calcula cuánto cabe en cada vehículo con las medidas de la canastilla. Regístrala en Plano de carga → Vehículos y reglas."
        />
      ) : fechas !== null && fechas.length === 0 ? (
        <EstadoVacio
          icono={<CheckCircle2 size={20} />}
          titulo="No hay pedidos pendientes de planificación"
          texto="Todos los pedidos están ya en un lote, en un despacho o entregados."
        />
      ) : (
        <div className="lote-crear">
          <div className="lote-crear-fechas" role="radiogroup" aria-label="Fecha de entrega">
            {(fechas ?? []).map((f) => (
              <button
                key={f.fecha}
                type="button"
                role="radio"
                aria-checked={f.fecha === fecha}
                className={`lote-fecha ${f.fecha === fecha ? "activa" : ""}`}
                onClick={() => setFecha(f.fecha)}
              >
                <CalendarDays size={14} />
                <strong>{fechaLarga(f.fecha)}</strong>
                <small>
                  {f.pedidos} pedido{f.pedidos === 1 ? "" : "s"} · {f.clientes} cliente{f.clientes === 1 ? "" : "s"}
                </small>
              </button>
            ))}
          </div>

          <div className="pl-ajuste-grid">
            <label className="plano-campo">
              <span>Canastilla con la que se carga</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value ? Number(e.target.value) : "")}>
                {canastillas
                  .filter((c) => c.activa || c.id === tipo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.largo_cm}×{c.ancho_cm}×{c.alto_cm} cm)
                    </option>
                  ))}
              </select>
            </label>
            <label className="plano-campo">
              <span>Nombre del lote (opcional)</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Despacho del martes" />
            </label>
          </div>

          {descartados.length > 0 && (
            <p className="pl-aviso-texto">
              <AlertTriangle size={12} /> {descartados.length} de los pedidos que marcaste no están en esta fecha o ya
              van en otro despacho: {descartados.slice(0, 8).map((id) => `#${id}`).join(", ")}.
            </p>
          )}

          <div className="lote-crear-cifras">
            <span>
              <Layers size={13} /> <strong>{fmt(totales.pedidos)}</strong> pedidos
            </span>
            <span>
              <Users size={13} /> <strong>{fmt(totales.clientes)}</strong> clientes
            </span>
            <span>
              <Package size={13} /> ≈ <strong>{fmt(totales.canastillas)}</strong> canastillas
            </span>
            <span>
              <Truck size={13} /> {totales.peso != null ? `≈ ${fmt(Math.round(totales.peso))} kg` : "peso sin regla"}
            </span>
            <span className="pl-flex" />
            <button type="button" className="pl-enlace" onClick={() => setMarcados(todos ? new Set() : new Set(pedidos.map((p) => p.id)))}>
              {todos ? "Quitar todos" : "Seleccionar todos"}
            </button>
          </div>

          {totales.sinRegla.length > 0 && (
            <p className="pl-aviso-texto">
              <AlertTriangle size={12} /> Sin regla de carga: {totales.sinRegla.slice(0, 6).join(", ")}
              {totales.sinRegla.length > 6 ? "…" : ""}. Sus canastillas se estiman por defecto y habrá que revisarlas.
            </p>
          )}

          <div className="tabla-scroll lote-crear-tabla">
            <table className="gestion-tabla">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={todos}
                      onChange={() => setMarcados(todos ? new Set() : new Set(pedidos.map((p) => p.id)))}
                      aria-label="Seleccionar todos los pedidos del día"
                    />
                  </th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th className="num">Canastillas</th>
                  <th className="num">Peso</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="fila-esqueleto">
                      <td colSpan={6}>
                        <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: `${75 - i * 8}%` }} />
                      </td>
                    </tr>
                  ))
                ) : pedidos.length === 0 ? (
                  <tr className="fila-vacia">
                    <td colSpan={6}>Ningún pedido pendiente para esta fecha.</td>
                  </tr>
                ) : (
                  pedidos.map((p) => (
                    <tr key={p.id} className={marcados.has(p.id) ? "seleccionada" : ""}>
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={marcados.has(p.id)}
                          onChange={() => alternar(p.id)}
                          aria-label={`Incluir el pedido ${p.id}`}
                        />
                      </td>
                      <td>
                        <span className="celda-id">#{p.id}</span>
                      </td>
                      <td>
                        <span className="celda-nombre">{p.cliente_nombre}</span>
                        {p.direccion && <small className="celda-tenue"> {p.direccion}</small>}
                      </td>
                      <td className="celda-tenue">
                        {p.productos
                          .slice(0, 3)
                          .map((pr) => `${pr.cantidad} ${pr.unidad} ${pr.producto}`)
                          .join(" · ")}
                        {p.productos.length > 3 ? ` +${p.productos.length - 3}` : ""}
                      </td>
                      <td className="num">{p.canastillas}</td>
                      <td className="num">{p.peso_kg != null ? `${fmt(p.peso_kg)} kg` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
