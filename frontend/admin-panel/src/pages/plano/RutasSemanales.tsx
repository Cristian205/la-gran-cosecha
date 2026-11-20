import { CalendarDays, CheckCircle2, Copy, MapPin, Pencil, Plus, Route, Save, Star, Trash2, Truck, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  activarProgramacion,
  DIAS_SEMANA,
  duplicarProgramacion,
  eliminarProgramacion,
  eliminarRuta,
  guardarProgramacion,
  guardarRuta,
  listarProgramaciones,
  listarRutas,
  type Furgon,
  type ProgramacionSemanal,
  type Ruta,
} from "../../api/logistica";
import { obtenerTodosLosClientes } from "../../api/resources";
import { EstadoVacio, MenuFila, Pastilla, type AccionMenu } from "../../components/gestion/Gestion";
import { Modal } from "../../components/Modal";
import type { Cliente } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarDescartar, confirmarEliminar } from "../../utils/alertas";
import { COLORES_GRUPO } from "./acomodo";
import { EditorParadas, type ParadaEditable } from "./EditorParadas";

/**
 * Programación semanal: qué vehículo visita a qué clientes, en qué orden,
 * cada día. Se guarda por plantillas («Semana normal», «Diciembre»); la
 * ACTIVA es la que usa el centro de planificación. Los cambios de un solo día
 * se hacen desde el centro (ajuste por fecha), sin tocar esta programación.
 */

interface BorradorRuta {
  /** id de la ruta guardada; undefined = nueva. */
  id?: number;
  clave: string;
  dia_semana: number;
  nombre: string;
  furgon: number | "";
  color: string;
  notas: string;
  paradas: ParadaEditable[];
}

const aBorrador = (r: Ruta): BorradorRuta => ({
  id: r.id,
  clave: `r${r.id}`,
  dia_semana: r.dia_semana,
  nombre: r.nombre,
  furgon: r.furgon,
  color: r.color,
  notas: r.notas,
  paradas: r.paradas.map((p) => ({ cliente: p.cliente, cliente_nombre: p.cliente_nombre, direccion: p.direccion, nota: p.nota })),
});

const igual = (a: BorradorRuta, b: BorradorRuta) => JSON.stringify(a) === JSON.stringify(b);
const hoyDia = () => (new Date().getDay() + 6) % 7;

interface Props {
  furgones: Furgon[];
  puedeAdministrar: boolean;
}

export default function RutasSemanales({ furgones, puedeAdministrar }: Props) {
  const [programaciones, setProgramaciones] = useState<ProgramacionSemanal[]>([]);
  const [progId, setProgId] = useState<number | null>(null);
  const [guardadas, setGuardadas] = useState<BorradorRuta[]>([]);
  const [borradores, setBorradores] = useState<BorradorRuta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [dia, setDia] = useState(hoyDia());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ modo: "nueva" | "renombrar" | "duplicar"; nombre: string } | null>(null);

  const cargarProgramaciones = useCallback(async (seleccionar?: number) => {
    const lista = await listarProgramaciones();
    setProgramaciones(lista);
    setProgId((actual) => seleccionar ?? (lista.some((p) => p.id === actual) ? actual : (lista.find((p) => p.activa) ?? lista[0])?.id ?? null));
  }, []);

  useEffect(() => {
    Promise.all([cargarProgramaciones(), obtenerTodosLosClientes().then(setClientes)])
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudo cargar la programación.")))
      .finally(() => setCargando(false));
  }, [cargarProgramaciones]);

  useEffect(() => {
    if (progId === null) {
      setGuardadas([]);
      setBorradores([]);
      return;
    }
    let vigente = true;
    listarRutas(progId)
      .then((rutas) => {
        if (!vigente) return;
        const b = rutas.map(aBorrador);
        setGuardadas(b);
        setBorradores(b);
      })
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudieron cargar las rutas.")));
    return () => {
      vigente = false;
    };
  }, [progId]);

  const prog = programaciones.find((p) => p.id === progId) ?? null;
  const editable = puedeAdministrar && !!prog;
  const sucias = borradores.filter((b) => {
    const g = guardadas.find((x) => x.clave === b.clave);
    return !g || !igual(g, b);
  });
  const delDia = borradores.filter((b) => b.dia_semana === dia);

  /** Por día: rutas y paradas, para las pestañas de la semana. */
  const resumenSemana = useMemo(
    () =>
      DIAS_SEMANA.map((_, d) => {
        const rutas = borradores.filter((b) => b.dia_semana === d);
        return { rutas: rutas.length, paradas: rutas.reduce((a, r) => a + r.paradas.length, 0) };
      }),
    [borradores]
  );

  /** Clientes que más de una ruta visita el mismo día (aviso, no error). */
  const enOtraRuta = useCallback(
    (clave: string) => {
      const m = new Map<number, string>();
      for (const r of delDia) if (r.clave !== clave) for (const p of r.paradas) m.set(p.cliente, r.nombre || "otra ruta");
      return m;
    },
    [delDia]
  );

  async function puedeCambiar() {
    return !sucias.length || (await confirmarDescartar("Hay rutas con cambios sin guardar."));
  }

  function cambiarRuta(clave: string, parcial: Partial<BorradorRuta>) {
    setBorradores((bs) => bs.map((b) => (b.clave === clave ? { ...b, ...parcial } : b)));
  }

  function agregarRuta() {
    const ocupados = new Set(delDia.map((r) => r.furgon));
    const libre = furgones.find((f) => f.activo && !ocupados.has(f.id));
    if (!libre) {
      alertaError("Todos los vehículos activos ya tienen ruta ese día. Registra otro vehículo o elimina una ruta.");
      return;
    }
    const usados = new Set(delDia.map((r) => r.color));
    setBorradores((bs) => [
      ...bs,
      {
        clave: `n${Date.now().toString(36)}`,
        dia_semana: dia,
        nombre: `${libre.nombre} · ${DIAS_SEMANA[dia].toLowerCase()}`,
        furgon: libre.id,
        color: COLORES_GRUPO.find((c) => !usados.has(c)) ?? COLORES_GRUPO[0],
        notas: "",
        paradas: [],
      },
    ]);
  }

  async function guardar(b: BorradorRuta) {
    if (!prog || b.furgon === "") return;
    setGuardando(b.clave);
    try {
      const r = await guardarRuta(
        {
          programacion: prog.id,
          dia_semana: b.dia_semana,
          nombre: b.nombre.trim() || "Ruta",
          furgon: b.furgon,
          color: b.color,
          notas: b.notas,
          paradas: b.paradas.map((p) => ({ cliente: p.cliente, nota: p.nota })),
        },
        b.id
      );
      const nueva = aBorrador(r);
      setGuardadas((gs) => [...gs.filter((g) => g.clave !== nueva.clave), nueva]);
      setBorradores((bs) => bs.map((x) => (x.clave === b.clave ? nueva : x)));
      setProgramaciones((ps) => ps.map((p) => (p.id === prog.id && !b.id ? { ...p, total_rutas: p.total_rutas + 1 } : p)));
      alertaExito("Ruta guardada");
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar la ruta."));
    } finally {
      setGuardando(null);
    }
  }

  function descartar(b: BorradorRuta) {
    const g = guardadas.find((x) => x.clave === b.clave);
    setBorradores((bs) => (g ? bs.map((x) => (x.clave === b.clave ? g : x)) : bs.filter((x) => x.clave !== b.clave)));
  }

  async function eliminar(b: BorradorRuta) {
    if (!b.id) return descartar(b);
    if (!(await confirmarEliminar(`¿Eliminar la ruta «${b.nombre}»?`, "Los despachos ya generados conservan su copia de la ruta."))) return;
    try {
      await eliminarRuta(b.id);
      setGuardadas((gs) => gs.filter((g) => g.clave !== b.clave));
      setBorradores((bs) => bs.filter((x) => x.clave !== b.clave));
      setProgramaciones((ps) => ps.map((p) => (p.id === prog?.id ? { ...p, total_rutas: Math.max(0, p.total_rutas - 1) } : p)));
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar la ruta."));
    }
  }

  async function confirmarDialogo() {
    if (!dialogo) return;
    const nombre = dialogo.nombre.trim();
    if (!nombre) return;
    try {
      if (dialogo.modo === "nueva") {
        const p = await guardarProgramacion({ nombre });
        await cargarProgramaciones(p.id);
      } else if (dialogo.modo === "renombrar" && prog) {
        await guardarProgramacion({ id: prog.id, nombre });
        await cargarProgramaciones(prog.id);
      } else if (dialogo.modo === "duplicar" && prog) {
        const p = await duplicarProgramacion(prog.id, nombre);
        await cargarProgramaciones(p.id);
        alertaExito("Programación duplicada con todas sus rutas");
      }
      setDialogo(null);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar la programación."));
    }
  }

  async function activar() {
    if (!prog) return;
    try {
      await activarProgramacion(prog.id);
      await cargarProgramaciones(prog.id);
      alertaExito(`«${prog.nombre}» es ahora la programación activa`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo activar la programación."));
    }
  }

  async function eliminarProg() {
    if (!prog || !(await confirmarEliminar(`¿Eliminar la programación «${prog.nombre}»?`, "Se eliminan sus rutas. Los despachos ya generados no cambian."))) return;
    try {
      await eliminarProgramacion(prog.id);
      setProgId(null);
      await cargarProgramaciones();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar la programación."));
    }
  }

  const accionesProg: AccionMenu[] = prog && puedeAdministrar
    ? [
        { clave: "renombrar", tono: "editar", etiqueta: "Renombrar", icono: <Pencil size={15} />, onSeleccionar: () => setDialogo({ modo: "renombrar", nombre: prog.nombre }) },
        { clave: "duplicar", tono: "copiar", etiqueta: "Duplicar como plantilla nueva", icono: <Copy size={15} />, onSeleccionar: () => setDialogo({ modo: "duplicar", nombre: `${prog.nombre} (copia)` }) },
        ...(!prog.activa ? [{ clave: "eliminar", etiqueta: "Eliminar programación", icono: <Trash2 size={15} />, peligro: true, onSeleccionar: eliminarProg } as AccionMenu] : []),
      ]
    : [];

  if (cargando) return <div className="panel pl-cargando">Cargando la programación semanal…</div>;

  if (!programaciones.length) {
    return (
      <section className="panel gestion-modulo">
        <EstadoVacio
          icono={<Route size={20} />}
          titulo="Aún no hay programación semanal"
          texto="Crea la programación habitual: para cada día, qué vehículo sale y a qué clientes visita en orden. El centro de planificación la usa para repartir los pedidos solos."
          accion={
            puedeAdministrar && (
              <button type="button" className="btn primario sm" onClick={() => setDialogo({ modo: "nueva", nombre: "Semana habitual" })}>
                <Plus size={14} /> Crear programación
              </button>
            )
          }
        />
        {dialogo && <DialogoNombre dialogo={dialogo} onCambiar={(nombre) => setDialogo({ ...dialogo, nombre })} onCerrar={() => setDialogo(null)} onConfirmar={confirmarDialogo} />}
      </section>
    );
  }

  return (
    <>
      <section className="panel gestion-modulo pl-prog">
        <div className="pl-prog-cab">
          <div className="pl-prog-selector">
            <CalendarDays size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="pl-prog">
              Programación
            </label>
            <select
              id="pl-prog"
              className="pl-select"
              value={progId ?? ""}
              onChange={async (e) => {
                if (await puedeCambiar()) setProgId(Number(e.target.value));
              }}
            >
              {programaciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.activa ? "· activa" : ""}
                </option>
              ))}
            </select>
            {prog?.activa ? (
              <Pastilla tono="verde">
                <CheckCircle2 size={12} /> En uso por el centro
              </Pastilla>
            ) : (
              <Pastilla tono="neutro">Plantilla guardada</Pastilla>
            )}
            <span className="pl-meta">{prog?.total_rutas ?? 0} rutas en la semana</span>
          </div>
          <div className="pl-prog-acciones">
            {puedeAdministrar && prog && !prog.activa && (
              <button type="button" className="btn secundario sm" onClick={activar}>
                <Star size={14} /> Usar esta programación
              </button>
            )}
            {puedeAdministrar && (
              <button type="button" className="btn secundario sm" onClick={() => setDialogo({ modo: "nueva", nombre: "" })}>
                <Plus size={14} /> Nueva plantilla
              </button>
            )}
            {accionesProg.length > 0 && <MenuFila etiqueta="Más acciones de la programación" acciones={accionesProg} />}
          </div>
        </div>

        <div className="pl-semana" role="tablist" aria-label="Día de la semana">
          {DIAS_SEMANA.map((nombre, d) => (
            <button
              key={nombre}
              type="button"
              role="tab"
              aria-selected={dia === d}
              className={`pl-dia ${dia === d ? "activo" : ""} ${d === hoyDia() ? "hoy" : ""}`}
              onClick={() => setDia(d)}
            >
              <span className="pl-dia-nombre">{nombre}</span>
              <span className="pl-dia-cifras">
                <b>{resumenSemana[d].rutas}</b> {resumenSemana[d].rutas === 1 ? "ruta" : "rutas"} · {resumenSemana[d].paradas} paradas
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="pl-rutas-grid">
        {delDia.map((b) => {
          const g = guardadas.find((x) => x.clave === b.clave);
          const sucia = !g || !igual(g, b);
          const ocupados = new Set(delDia.filter((x) => x.clave !== b.clave).map((x) => x.furgon));
          return (
            <article key={b.clave} className={`panel pl-ruta ${sucia ? "sucia" : ""}`} style={{ "--ruta": b.color } as CSSProperties}>
              <header className="pl-ruta-cab">
                <input
                  type="color"
                  value={b.color}
                  disabled={!editable}
                  aria-label="Color de la ruta"
                  onChange={(e) => cambiarRuta(b.clave, { color: e.target.value })}
                />
                <input
                  className="pl-ruta-nombre"
                  value={b.nombre}
                  maxLength={80}
                  disabled={!editable}
                  aria-label="Nombre de la ruta"
                  onChange={(e) => cambiarRuta(b.clave, { nombre: e.target.value })}
                />
                {sucia && <Pastilla tono="ambar">Sin guardar</Pastilla>}
              </header>
              <label className="plano-campo pl-ruta-vehiculo">
                <span>
                  <Truck size={12} /> Vehículo
                </span>
                <select value={b.furgon} disabled={!editable} onChange={(e) => cambiarRuta(b.clave, { furgon: Number(e.target.value) })}>
                  {furgones
                    .filter((f) => (f.activo && !ocupados.has(f.id)) || f.id === b.furgon)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                        {f.placa ? ` · ${f.placa}` : ""}
                        {!f.activo ? " (inactivo)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <div className="pl-ruta-secuencia">
                <span className="pl-ruta-etq">
                  <MapPin size={12} /> Secuencia de entrega · {b.paradas.length} parada{b.paradas.length === 1 ? "" : "s"}
                </span>
                <EditorParadas
                  idBase={`ruta-${b.clave}`}
                  paradas={b.paradas}
                  clientes={clientes}
                  editable={editable}
                  enOtraRuta={enOtraRuta(b.clave)}
                  onCambiar={(paradas) => cambiarRuta(b.clave, { paradas })}
                />
              </div>
              {editable && (
                <footer className="pl-ruta-pie">
                  <button type="button" className="btn-icon peligro" onClick={() => eliminar(b)} aria-label={`Eliminar la ruta ${b.nombre}`}>
                    <Trash2 size={15} />
                  </button>
                  <span className="pl-flex" />
                  {sucia && (
                    <button type="button" className="btn secundario sm" onClick={() => descartar(b)}>
                      <Undo2 size={14} /> Descartar
                    </button>
                  )}
                  <button type="button" className="btn primario sm" disabled={!sucia || guardando === b.clave || b.furgon === ""} onClick={() => guardar(b)}>
                    <Save size={14} /> {guardando === b.clave ? "Guardando…" : "Guardar ruta"}
                  </button>
                </footer>
              )}
            </article>
          );
        })}
        {editable && (
          <button type="button" className="pl-ruta-nueva" onClick={agregarRuta}>
            <Plus size={22} />
            <strong>Agregar ruta del {DIAS_SEMANA[dia].toLowerCase()}</strong>
            <span>Un vehículo con su secuencia de clientes</span>
          </button>
        )}
        {!editable && delDia.length === 0 && (
          <section className="panel gestion-modulo">
            <EstadoVacio icono={<Route size={20} />} titulo={`Sin rutas el ${DIAS_SEMANA[dia].toLowerCase()}`} texto="Ese día no sale ningún vehículo en esta programación." />
          </section>
        )}
      </div>

      {dialogo && <DialogoNombre dialogo={dialogo} onCambiar={(nombre) => setDialogo({ ...dialogo, nombre })} onCerrar={() => setDialogo(null)} onConfirmar={confirmarDialogo} />}
    </>
  );
}

function DialogoNombre({
  dialogo,
  onCambiar,
  onCerrar,
  onConfirmar,
}: {
  dialogo: { modo: "nueva" | "renombrar" | "duplicar"; nombre: string };
  onCambiar: (nombre: string) => void;
  onCerrar: () => void;
  onConfirmar: () => void;
}) {
  const titulos = { nueva: "Nueva programación semanal", renombrar: "Renombrar programación", duplicar: "Duplicar programación" };
  return (
    <Modal
      titulo={titulos[dialogo.modo]}
      onCerrar={onCerrar}
      cerrarConEscape
      amplio
      medio
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="btn primario" disabled={!dialogo.nombre.trim()} onClick={onConfirmar}>
            {dialogo.modo === "duplicar" ? "Duplicar" : "Guardar"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar();
        }}
      >
        <label className="plano-campo">
          <span>Nombre</span>
          <input autoFocus value={dialogo.nombre} maxLength={80} placeholder="Ej. Semana habitual, Temporada de diciembre" onChange={(e) => onCambiar(e.target.value)} />
        </label>
        {dialogo.modo === "duplicar" && <p className="pl-meta">Se copian todas las rutas y paradas. La copia queda guardada sin usarse hasta que la actives.</p>}
      </form>
    </Modal>
  );
}
