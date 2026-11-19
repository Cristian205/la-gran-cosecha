import {
  ArrowDownToLine,
  Box,
  Eye,
  Layers,
  PackageMinus,
  Plus,
  Save,
  Settings2,
  Trash2,
  Truck,
  Wand2,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  consultarRejilla,
  eliminarPlano,
  guardarPlano,
  listarCanastillas,
  listarFurgones,
  listarPlanos,
  obtenerPlano,
  type Furgon,
  type GrupoCarga,
  type PlanoResumen,
  type Posicion,
  type Rejilla,
  type TipoCanastilla,
} from "../../api/logistica";
import { useAuth } from "../../auth/AuthContext";
import { extraerMensajeError, tienePermiso } from "../../utils";
import { alertaError, alertaExito, confirmarAccion, confirmarDescartar, confirmarEliminar } from "../../utils/alertas";
import {
  acomodarAutomatico,
  COLORES_GRUPO,
  depurar,
  intercambiar,
  moverAPila,
  pendientesPorGrupo,
  quitar,
  ubicarPendientes,
} from "./acomodo";
import { ConfigMedidas } from "./ConfigMedidas";
import type { OpcionesVisor, Vista } from "./Furgon3D";
import "./plano.css";

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
  notas: string;
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nuevoId() {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function borradorNuevo(furgones: Furgon[], canastillas: TipoCanastilla[]): Borrador {
  return {
    nombre: "",
    fecha: hoy(),
    furgon: furgones.find((f) => f.activo)?.id ?? "",
    tipo: canastillas.find((c) => c.activa)?.id ?? "",
    grupos: [],
    posiciones: [],
    notas: "",
  };
}

const VISTAS: Array<{ clave: Vista; etiqueta: string }> = [
  { clave: "3d", etiqueta: "3D" },
  { clave: "superior", etiqueta: "Superior" },
  { clave: "lateral", etiqueta: "Lateral" },
  { clave: "trasera", etiqueta: "Desde la puerta" },
];

export default function PlanoPage() {
  const { usuario } = useAuth();
  const puedeArmar = tienePermiso(usuario, ARMAR);
  const puedeAdministrar = tienePermiso(usuario, ADMINISTRAR);

  const [pestana, setPestana] = useState<"despachos" | "medidas">("despachos");
  const [furgones, setFurgones] = useState<Furgon[]>([]);
  const [canastillas, setCanastillas] = useState<TipoCanastilla[]>([]);
  const [planos, setPlanos] = useState<PlanoResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  const [b, setB] = useState<Borrador | null>(null);
  const [rejilla, setRejilla] = useState<Rejilla | null>(null);
  /** Para qué furgón y canastilla es la rejilla actual. */
  const [rejillaDe, setRejillaDe] = useState("");
  const [ajustado, setAjustado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [seleccion, setSeleccion] = useState<Posicion | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("3d");
  const [opciones, setOpciones] = useState<OpcionesVisor>({ techo: false, paredes: true, puertasAbiertas: true });
  const alternar = (k: keyof OpcionesVisor) => setOpciones((o) => ({ ...o, [k]: !o[k] }));

  const cargarCatalogos = useCallback(async () => {
    try {
      const [f, c, p] = await Promise.all([listarFurgones(), listarCanastillas(), listarPlanos()]);
      setFurgones(f);
      setCanastillas(c);
      setPlanos(p);
      return { f, c };
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo cargar el plano de carga."));
      return { f: [], c: [] };
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  // Avisa al salir de la página con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  // Cambió el furgón o la canastilla: se pide la rejilla y se reacomoda.
  useEffect(() => {
    if (!b || b.furgon === "" || b.tipo === "") return;
    const clave = `${b.furgon}:${b.tipo}`;
    if (clave === rejillaDe) return;
    let vigente = true;
    consultarRejilla(b.furgon, b.tipo)
      .then((r) => {
        if (!vigente) return;
        setRejilla(r);
        setRejillaDe(clave);
        setSeleccion(null);
        setAjustado(false);
        setB((x) => (x ? { ...x, posiciones: acomodarAutomatico(x.grupos, r) } : x));
      })
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudo calcular el espacio del furgón.")));
    return () => {
      vigente = false;
    };
  }, [b, rejillaDe]);

  async function puedeDescartar() {
    return !sucio || (await confirmarDescartar("Hay cambios sin guardar en este plano."));
  }

  async function nuevo() {
    if (!(await puedeDescartar())) return;
    setB(borradorNuevo(furgones, canastillas));
    setRejilla(null);
    setRejillaDe("");
    setSucio(false);
    setAjustado(false);
    setSeleccion(null);
  }

  async function abrir(id: number) {
    if (b?.id === id || !(await puedeDescartar())) return;
    try {
      const p = await obtenerPlano(id);
      setB({
        id: p.id,
        nombre: p.nombre,
        fecha: p.fecha,
        furgon: p.furgon,
        tipo: p.tipo_canastilla,
        grupos: p.grupos,
        posiciones: p.posiciones,
        notas: p.notas,
      });
      // Un plano guardado se ve con SU rejilla, aunque el furgón se haya editado después.
      setRejilla(p.medidas);
      setRejillaDe(`${p.furgon}:${p.tipo_canastilla}`);
      setAjustado(true);
      setSucio(false);
      setSeleccion(null);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo abrir el plano."));
    }
  }

  function cambiar(parcial: Partial<Borrador>) {
    setB((x) => (x ? { ...x, ...parcial } : x));
    setSucio(true);
  }

  function cambiarGrupos(grupos: GrupoCarga[]) {
    setSeleccion(null);
    setB((x) => {
      if (!x) return x;
      const posiciones = !ajustado && rejilla ? acomodarAutomatico(grupos, rejilla) : depurar(grupos, x.posiciones);
      return { ...x, grupos, posiciones };
    });
    setSucio(true);
  }

  function agregarGrupo() {
    if (!b) return;
    const usados = new Set(b.grupos.map((g) => g.color));
    const color = COLORES_GRUPO.find((c) => !usados.has(c)) ?? COLORES_GRUPO[b.grupos.length % COLORES_GRUPO.length];
    const orden = b.grupos.reduce((m, g) => Math.max(m, g.orden), 0) + 1;
    cambiarGrupos([...b.grupos, { id: nuevoId(), nombre: `Destino ${b.grupos.length + 1}`, cantidad: 10, orden, color }]);
  }

  function editarGrupo(id: string, parcial: Partial<GrupoCarga>) {
    if (!b) return;
    cambiarGrupos(b.grupos.map((g) => (g.id === id ? { ...g, ...parcial } : g)));
  }

  function setPosiciones(posiciones: Posicion[]) {
    setB((x) => (x ? { ...x, posiciones } : x));
    setAjustado(true);
    setSucio(true);
    setSeleccion(null);
  }

  async function reacomodar() {
    if (!b || !rejilla) return;
    if (ajustado && !(await confirmarAccion("¿Volver a acomodar automáticamente?", "Se pierden los cambios que hiciste a mano.", "Sí, reacomodar"))) return;
    setB({ ...b, posiciones: acomodarAutomatico(b.grupos, rejilla) });
    setAjustado(false);
    setSucio(true);
    setSeleccion(null);
  }

  async function guardar() {
    if (!b || b.furgon === "" || b.tipo === "") return;
    setGuardando(true);
    try {
      const p = await guardarPlano(
        {
          nombre: b.nombre.trim(),
          fecha: b.fecha,
          furgon: b.furgon,
          tipo_canastilla: b.tipo,
          grupos: b.grupos.map((g) => ({ ...g, nombre: g.nombre.trim() || "Sin nombre" })),
          posiciones: b.posiciones,
          notas: b.notas,
        },
        b.id
      );
      setB((x) => (x ? { ...x, id: p.id } : x));
      setRejilla(p.medidas);
      setSucio(false);
      setPlanos(await listarPlanos());
      alertaExito("Plano guardado");
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar el plano."));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!b?.id || !(await confirmarEliminar(`¿Eliminar el plano «${b.nombre}»?`, "Esta acción no se puede deshacer."))) return;
    try {
      await eliminarPlano(b.id);
      setB(null);
      setSucio(false);
      setPlanos(await listarPlanos());
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar el plano."));
    }
  }

  // ---------- Interacción con el 3D ----------
  function alTocarCanastilla(p: Posicion) {
    if (!puedeArmar || !b) return;
    if (!seleccion) return setSeleccion(p);
    const misma = seleccion.fila === p.fila && seleccion.columna === p.columna && seleccion.nivel === p.nivel;
    if (misma) return setSeleccion(null);
    // Dos canastillas: intercambian lugar (si son del mismo destino, no cambia nada).
    if (seleccion.grupo === p.grupo) return setSeleccion(p);
    setPosiciones(intercambiar(b.posiciones, seleccion, p));
  }

  function alTocarPila(fila: number, columna: number) {
    if (!b || !seleccion || !rejilla) return;
    setPosiciones(moverAPila(b.posiciones, seleccion, fila, columna, rejilla));
  }

  // ---------- Derivados ----------
  const pendientes = useMemo(() => (b ? pendientesPorGrupo(b.grupos, b.posiciones) : new Map<string, number>()), [b]);
  const totalPendientes = [...pendientes.values()].reduce((a, n) => a + n, 0);
  const totalCanastillas = b?.grupos.reduce((a, g) => a + g.cantidad, 0) ?? 0;
  const ubicadas = b?.posiciones.length ?? 0;
  const ocupacion = rejilla?.capacidad ? Math.round((ubicadas / rejilla.capacidad) * 100) : 0;
  const filasDe = useMemo(() => {
    const m = new Map<string, { min: number; max: number }>();
    for (const p of b?.posiciones ?? []) {
      const r = m.get(p.grupo);
      m.set(p.grupo, r ? { min: Math.min(r.min, p.fila), max: Math.max(r.max, p.fila) } : { min: p.fila, max: p.fila });
    }
    return m;
  }, [b?.posiciones]);

  const furgonActual = furgones.find((f) => f.id === b?.furgon);
  const editable = puedeArmar;
  const valido = !!b && !!b.nombre.trim() && b.furgon !== "" && b.tipo !== "" && b.grupos.length > 0 && !!rejilla;
  const sinMedidas = furgones.length === 0 || canastillas.length === 0;

  return (
    <div className="pagina plano">
      <div className="plano-cabecera">
        <div>
          <h1>
            <Truck size={22} /> Plano de carga
          </h1>
          <p>Ordena las canastillas en el furgón según el orden de entrega.</p>
        </div>
        <div className="segmentado" role="tablist" aria-label="Sección">
          <button role="tab" aria-selected={pestana === "despachos"} className={pestana === "despachos" ? "activo" : ""} onClick={() => setPestana("despachos")}>
            <Box size={15} /> Despachos
          </button>
          <button role="tab" aria-selected={pestana === "medidas"} className={pestana === "medidas" ? "activo" : ""} onClick={() => setPestana("medidas")}>
            <Settings2 size={15} /> Furgones y canastillas
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="panel">
          <p className="vacio">Cargando…</p>
        </div>
      ) : pestana === "medidas" ? (
        <ConfigMedidas furgones={furgones} canastillas={canastillas} puedeAdministrar={puedeAdministrar} onCambio={cargarCatalogos} />
      ) : sinMedidas ? (
        <div className="panel plano-vacio">
          <Truck size={34} />
          <h2>Primero registra un furgón y una canastilla</h2>
          <p>El plano se arma con sus medidas: cuántas canastillas caben a lo largo, a lo ancho y hacia arriba.</p>
          {puedeAdministrar && (
            <button className="btn" onClick={() => setPestana("medidas")}>
              <Settings2 size={15} /> Configurar medidas
            </button>
          )}
        </div>
      ) : (
        <div className="plano-layout">
          {/* ---------- Despachos guardados ---------- */}
          <aside className="panel plano-lista">
            <div className="cabecera">
              <h2>Despachos</h2>
              {puedeArmar && (
                <button className="btn sm" onClick={nuevo}>
                  <Plus size={14} /> Nuevo
                </button>
              )}
            </div>
            {planos.length === 0 ? (
              <p className="vacio">Aún no hay planos guardados.</p>
            ) : (
              <ul>
                {planos.map((p) => (
                  <li key={p.id}>
                    <button className={b?.id === p.id ? "activo" : ""} onClick={() => abrir(p.id)}>
                      <strong>{p.nombre}</strong>
                      <small>
                        {p.fecha} · {p.furgon_nombre}
                      </small>
                      <small>
                        {p.total_canastillas} de {p.capacidad} canastillas
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* ---------- Editor ---------- */}
          {!b ? (
            <div className="panel plano-vacio">
              <Layers size={34} />
              <h2>Elige un despacho o crea uno nuevo</h2>
              <p>Anota los destinos con su cantidad de canastillas y su orden de entrega: el sistema propone el acomodo y tú lo ajustas.</p>
              {puedeArmar && (
                <button className="btn" onClick={nuevo}>
                  <Plus size={15} /> Nuevo despacho
                </button>
              )}
            </div>
          ) : (
            <div className="plano-editor">
              <section className="panel">
                <div className="plano-form-grid plano-form-grid--4">
                  <div className="campo">
                    <label htmlFor="pl-nombre">Nombre del despacho</label>
                    <input
                      id="pl-nombre"
                      value={b.nombre}
                      maxLength={120}
                      placeholder="Ruta norte · mañana"
                      disabled={!editable}
                      onChange={(e) => cambiar({ nombre: e.target.value })}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="pl-fecha">Fecha</label>
                    <input id="pl-fecha" type="date" value={b.fecha} disabled={!editable} onChange={(e) => cambiar({ fecha: e.target.value })} />
                  </div>
                  <div className="campo">
                    <label htmlFor="pl-furgon">Furgón</label>
                    <select
                      id="pl-furgon"
                      value={b.furgon}
                      disabled={!editable}
                      onChange={(e) => cambiar({ furgon: e.target.value ? Number(e.target.value) : "" })}
                    >
                      {furgones
                        .filter((f) => f.activo || f.id === b.furgon)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nombre}
                            {f.placa ? ` · ${f.placa}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor="pl-canastilla">Canastilla</label>
                    <select
                      id="pl-canastilla"
                      value={b.tipo}
                      disabled={!editable}
                      onChange={(e) => cambiar({ tipo: e.target.value ? Number(e.target.value) : "" })}
                    >
                      {canastillas
                        .filter((c) => c.activa || c.id === b.tipo)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({c.largo_cm}×{c.ancho_cm}×{c.alto_cm})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {rejilla && (
                  <div className="plano-kpis">
                    <div>
                      <span>Capacidad</span>
                      <strong>{rejilla.capacidad}</strong>
                      <small>
                        {rejilla.filas} filas × {rejilla.columnas} × {rejilla.niveles} niveles
                      </small>
                    </div>
                    <div>
                      <span>Ubicadas</span>
                      <strong>
                        {ubicadas} / {totalCanastillas}
                      </strong>
                      <small>canastillas del despacho</small>
                    </div>
                    <div className={ocupacion > 95 ? "alto" : ""}>
                      <span>Ocupación</span>
                      <strong>{ocupacion}%</strong>
                      <div className="plano-barra" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, ocupacion)}%` }} />
                      </div>
                    </div>
                    <div className={totalPendientes > 0 ? "aviso" : ""}>
                      <span>Sin lugar</span>
                      <strong>{totalPendientes}</strong>
                      <small>{totalPendientes > 0 ? "no caben o se quitaron" : "todo va en el furgón"}</small>
                    </div>
                  </div>
                )}
              </section>

              {/* ---------- Destinos ---------- */}
              <section className="panel">
                <div className="cabecera">
                  <h2>Destinos</h2>
                  {editable && (
                    <button className="btn sm secundario" onClick={agregarGrupo}>
                      <Plus size={14} /> Agregar destino
                    </button>
                  )}
                </div>
                <p className="plano-ayuda">
                  El orden 1 se entrega primero y va junto a la puerta; el último va al fondo, contra la cabina.
                </p>
                {b.grupos.length === 0 ? (
                  <p className="vacio">Agrega los destinos o clientes de este despacho.</p>
                ) : (
                  <div className="plano-grupos">
                    <div className="plano-grupos-cabecera" aria-hidden="true">
                      <span />
                      <span>Destino o cliente</span>
                      <span>Canastillas</span>
                      <span>Orden de entrega</span>
                      <span>Ubicación</span>
                      <span />
                    </div>
                    {[...b.grupos]
                      .sort((x, y) => x.orden - y.orden)
                      .map((g) => {
                        const faltan = pendientes.get(g.id) ?? 0;
                        const filas = filasDe.get(g.id);
                        return (
                          <div
                            key={g.id}
                            className={`plano-grupo ${resaltado === g.id ? "resaltado" : ""}`}
                            onMouseEnter={() => setResaltado(g.id)}
                            onMouseLeave={() => setResaltado(null)}
                          >
                            <input
                              type="color"
                              aria-label={`Color de ${g.nombre}`}
                              value={g.color}
                              disabled={!editable}
                              onChange={(e) => editarGrupo(g.id, { color: e.target.value })}
                            />
                            <input
                              aria-label="Destino o cliente"
                              value={g.nombre}
                              maxLength={80}
                              disabled={!editable}
                              onChange={(e) => editarGrupo(g.id, { nombre: e.target.value })}
                            />
                            <input
                              aria-label={`Canastillas de ${g.nombre}`}
                              type="number"
                              min={1}
                              max={2000}
                              value={g.cantidad}
                              disabled={!editable}
                              onChange={(e) => editarGrupo(g.id, { cantidad: Math.max(1, Math.min(2000, Number(e.target.value) || 1)) })}
                            />
                            <input
                              aria-label={`Orden de entrega de ${g.nombre}`}
                              type="number"
                              min={1}
                              max={999}
                              value={g.orden}
                              disabled={!editable}
                              onChange={(e) => editarGrupo(g.id, { orden: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
                            />
                            <span className="plano-grupo-ubicacion">
                              {filas ? (filas.min === filas.max ? `Fila ${filas.min + 1}` : `Filas ${filas.min + 1}–${filas.max + 1}`) : "—"}
                              {faltan > 0 && <em>{faltan} sin lugar</em>}
                            </span>
                            {editable ? (
                              <button
                                className="btn-icon peligro"
                                aria-label={`Quitar ${g.nombre}`}
                                onClick={() => cambiarGrupos(b.grupos.filter((x) => x.id !== g.id))}
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              {/* ---------- Plano 3D ---------- */}
              <section className="panel plano-visor">
                <div className="plano-visor-barra">
                  <div className="segmentado" role="group" aria-label="Vista">
                    {VISTAS.map((v) => (
                      <button key={v.clave} className={vista === v.clave ? "activo" : ""} onClick={() => setVista(v.clave)}>
                        {v.clave === "3d" ? <Eye size={14} /> : null} {v.etiqueta}
                      </button>
                    ))}
                  </div>
                  <div className="segmentado" role="group" aria-label="Mostrar">
                    <button aria-pressed={opciones.techo} className={opciones.techo ? "activo" : ""} onClick={() => alternar("techo")}>
                      Techo
                    </button>
                    <button aria-pressed={opciones.paredes} className={opciones.paredes ? "activo" : ""} onClick={() => alternar("paredes")}>
                      Paredes
                    </button>
                    <button
                      aria-pressed={opciones.puertasAbiertas}
                      className={opciones.puertasAbiertas ? "activo" : ""}
                      onClick={() => alternar("puertasAbiertas")}
                    >
                      Puertas abiertas
                    </button>
                  </div>
                  {editable && (
                    <div className="plano-visor-acciones">
                      {totalPendientes > 0 && ubicadas < (rejilla?.capacidad ?? 0) && (
                        <button className="btn sm secundario" onClick={() => b && rejilla && setPosiciones(ubicarPendientes(b.grupos, b.posiciones, rejilla))}>
                          <ArrowDownToLine size={14} /> Ubicar las que faltan
                        </button>
                      )}
                      <button className="btn sm secundario" onClick={reacomodar} disabled={!rejilla || b.grupos.length === 0}>
                        <Wand2 size={14} /> Acomodar automáticamente
                      </button>
                    </div>
                  )}
                </div>

                {seleccion && editable && (
                  <div className="plano-seleccion" role="status">
                    <span>
                      Canastilla de <strong>{b.grupos.find((g) => g.id === seleccion.grupo)?.nombre}</strong> elegida. Toca
                      otra para intercambiarlas, o un espacio verde para moverla ahí.
                    </span>
                    <button className="btn sm peligro" onClick={() => setPosiciones(quitar(b.posiciones, seleccion))}>
                      <PackageMinus size={14} /> Sacar del furgón
                    </button>
                    <button className="btn-icon" aria-label="Cancelar selección" onClick={() => setSeleccion(null)}>
                      <X size={15} />
                    </button>
                  </div>
                )}

                {rejilla ? (
                  rejilla.capacidad === 0 ? (
                    <p className="vacio">La canastilla no cabe en este furgón: revisa las medidas.</p>
                  ) : (
                    <Suspense fallback={<div className="plano-3d plano-3d--cargando">Cargando el plano 3D…</div>}>
                      <Furgon3D
                        rejilla={rejilla}
                        furgon={furgonActual ?? null}
                        opciones={opciones}
                        grupos={b.grupos}
                        posiciones={b.posiciones}
                        seleccion={seleccion}
                        resaltado={resaltado}
                        vista={vista}
                        editable={editable}
                        onCanastilla={alTocarCanastilla}
                        onPila={alTocarPila}
                        onFondo={() => setSeleccion(null)}
                      />
                    </Suspense>
                  )
                ) : (
                  <div className="plano-3d plano-3d--cargando">Calculando el espacio del furgón…</div>
                )}

                <div className="plano-leyenda">
                  {b.grupos.map((g) => (
                    <button
                      key={g.id}
                      className={resaltado === g.id ? "activo" : ""}
                      onMouseEnter={() => setResaltado(g.id)}
                      onMouseLeave={() => setResaltado(null)}
                      onFocus={() => setResaltado(g.id)}
                      onBlur={() => setResaltado(null)}
                    >
                      <i style={{ background: g.color }} /> {g.orden}. {g.nombre}
                    </button>
                  ))}
                  <span className="plano-leyenda-ayuda">
                    Arrastra para girar · rueda para acercar{editable ? " · toca una canastilla para moverla" : ""}
                  </span>
                </div>
              </section>

              <section className="panel">
                <div className="campo" style={{ marginBottom: 0 }}>
                  <label htmlFor="pl-notas">Notas para quien carga</label>
                  <textarea
                    id="pl-notas"
                    rows={2}
                    value={b.notas}
                    disabled={!editable}
                    placeholder="Ej.: lo refrigerado en la fila de la puerta."
                    onChange={(e) => cambiar({ notas: e.target.value })}
                  />
                </div>
              </section>

              {editable && (
                <div className="plano-pie">
                  {b.id && (
                    <button className="btn peligro" onClick={eliminar}>
                      <Trash2 size={15} /> Eliminar
                    </button>
                  )}
                  <span className="plano-pie-estado">
                    {sucio ? "Cambios sin guardar" : b.id ? "Guardado" : ""}
                    {furgonActual && ` · ${furgonActual.nombre}`}
                  </span>
                  <button className="btn" onClick={guardar} disabled={!valido || guardando || !sucio}>
                    <Save size={15} /> {guardando ? "Guardando…" : "Guardar plano"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
