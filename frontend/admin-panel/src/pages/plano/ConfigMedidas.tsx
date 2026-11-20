import { AlertTriangle, BadgeCheck, Box, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  eliminarCanastilla,
  eliminarFurgon,
  guardarCanastilla,
  guardarFurgon,
  vistaPreviaEsquema,
  type ConfigEsquema,
  type Furgon,
  type Modelo3D,
  type Rejilla,
  type TipoCanastilla,
} from "../../api/logistica";
import { Modal } from "../../components/Modal";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarEliminar } from "../../utils/alertas";
import Plano2D from "./Plano2D";

const CanastillaVista3D = lazy(() => import("./CanastillaVista3D"));

/**
 * Furgones y canastillas: las medidas y la distribución con las que se arma
 * cada despacho. Se reutilizan en todos los despachos.
 */

const MODELOS: Array<{ valor: Modelo3D; etiqueta: string; imagen?: string }> = [
  { valor: "hino500", etiqueta: "Hino 500 con furgón", imagen: "/modelos/hino500.png" },
  { valor: "foton", etiqueta: "Foton con furgón (próximamente)" },
  { valor: "generico", etiqueta: "Furgón genérico" },
];

type Distribucion = "rejilla" | "frente_columnas";

interface BorradorFurgon {
  id?: number;
  nombre: string;
  placa: string;
  referencia: string;
  modelo_3d: Modelo3D;
  largo_cm: string;
  ancho_cm: string;
  alto_cm: string;
  carga_util_kg: string;
  distancia_entre_ejes_mm: string;
  medidas_verificadas: boolean;
  activo: boolean;
  distribucion: Distribucion;
  frente: string;
  izquierda: string;
  derecha: string;
  niveles: string;
  pasillo_min_cm: string;
  orientacion_laterales: "longitudinal" | "transversal";
}

interface BorradorCanastilla {
  id?: number;
  nombre: string;
  largo_cm: string;
  ancho_cm: string;
  alto_cm: string;
  max_apiladas: string;
  peso_lleno_kg: string;
  activa: boolean;
}

const texto = (v: number | null | undefined) => (v == null ? "" : String(v));
const numeroONulo = (v: string) => (v.trim() === "" ? null : Number(v));

function aBorradorFurgon(f?: Furgon): BorradorFurgon {
  const e = (f?.esquema_carga ?? {}) as Partial<Extract<ConfigEsquema, { tipo: "frente_columnas" }>> & { tipo?: string };
  return {
    id: f?.id,
    nombre: f?.nombre ?? "",
    placa: f?.placa ?? "",
    referencia: f?.referencia ?? "",
    modelo_3d: f?.modelo_3d ?? "hino500",
    largo_cm: texto(f?.largo_cm),
    ancho_cm: texto(f?.ancho_cm),
    alto_cm: texto(f?.alto_cm),
    carga_util_kg: texto(f?.carga_util_kg),
    distancia_entre_ejes_mm: texto(f?.distancia_entre_ejes_mm),
    medidas_verificadas: f?.medidas_verificadas ?? false,
    activo: f?.activo ?? true,
    distribucion: !f || e.tipo === "frente_columnas" ? "frente_columnas" : "rejilla",
    frente: texto(e.frente),
    izquierda: texto(e.izquierda),
    derecha: texto(e.derecha),
    niveles: texto(e.niveles ?? 5),
    pasillo_min_cm: texto(e.pasillo_min_cm ?? 40),
    orientacion_laterales: e.orientacion_laterales ?? "transversal",
  };
}

function esquemaDe(d: BorradorFurgon): ConfigEsquema {
  if (d.distribucion === "rejilla") return { tipo: "rejilla" };
  return {
    tipo: "frente_columnas",
    frente: numeroONulo(d.frente),
    izquierda: numeroONulo(d.izquierda),
    derecha: numeroONulo(d.derecha),
    niveles: Number(d.niveles) || 5,
    pasillo_min_cm: Number(d.pasillo_min_cm) || 0,
    orientacion_laterales: d.orientacion_laterales,
  };
}

const describirEsquema = (f: Furgon) =>
  (f.esquema_carga as { tipo?: string })?.tipo === "frente_columnas" ? "Fila delantera + laterales con pasillo" : "Rejilla uniforme";

export function ConfigMedidas({
  furgones,
  canastillas,
  puedeAdministrar,
  onCambio,
}: {
  furgones: Furgon[];
  canastillas: TipoCanastilla[];
  puedeAdministrar: boolean;
  onCambio: () => void;
}) {
  const [furgon, setFurgon] = useState<BorradorFurgon | null>(null);
  const [canastilla, setCanastilla] = useState<BorradorCanastilla | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function borrar(tipo: "furgon" | "canastilla", x: Furgon | TipoCanastilla) {
    if (!(await confirmarEliminar(`¿Eliminar «${x.nombre}»?`, "Si ya se usa en despachos guardados, desactívalo en su lugar."))) return;
    try {
      await (tipo === "furgon" ? eliminarFurgon(x.id) : eliminarCanastilla(x.id));
      onCambio();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar."));
    }
  }

  async function guardarF() {
    if (!furgon) return;
    setGuardando(true);
    try {
      await guardarFurgon({
        id: furgon.id,
        nombre: furgon.nombre.trim(),
        placa: furgon.placa.trim(),
        referencia: furgon.referencia.trim(),
        modelo_3d: furgon.modelo_3d,
        largo_cm: Number(furgon.largo_cm),
        ancho_cm: Number(furgon.ancho_cm),
        alto_cm: Number(furgon.alto_cm),
        carga_util_kg: numeroONulo(furgon.carga_util_kg),
        distancia_entre_ejes_mm: numeroONulo(furgon.distancia_entre_ejes_mm),
        medidas_verificadas: furgon.medidas_verificadas,
        activo: furgon.activo,
        esquema_carga: esquemaDe(furgon),
      });
      alertaExito("Vehículo guardado");
      setFurgon(null);
      onCambio();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar el vehículo."));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarC() {
    if (!canastilla) return;
    setGuardando(true);
    try {
      await guardarCanastilla({
        id: canastilla.id,
        nombre: canastilla.nombre.trim(),
        largo_cm: Number(canastilla.largo_cm),
        ancho_cm: Number(canastilla.ancho_cm),
        alto_cm: Number(canastilla.alto_cm),
        max_apiladas: Number(canastilla.max_apiladas) || 0,
        peso_lleno_kg: canastilla.peso_lleno_kg.trim() === "" ? null : canastilla.peso_lleno_kg.trim(),
        activa: canastilla.activa,
      });
      alertaExito("Canastilla guardada");
      setCanastilla(null);
      onCambio();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar la canastilla."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="cm">
      {/* ---------- Vehículos ---------- */}
      <section>
        <div className="cm-titulo">
          <div>
            <h2>
              <Truck size={18} /> Vehículos
            </h2>
            <p>Medidas INTERIORES del furgón (las pone el carrocero: se miden con metro) y cómo se carga.</p>
          </div>
          {puedeAdministrar && (
            <button className="btn" onClick={() => setFurgon(aBorradorFurgon())}>
              <Plus size={15} /> Nuevo vehículo
            </button>
          )}
        </div>
        {furgones.length === 0 ? (
          <div className="panel plano-vacio">
            <Truck size={30} />
            <h2>Sin vehículos</h2>
            <p>Registra el furgón con sus medidas interiores para empezar a armar despachos.</p>
          </div>
        ) : (
          <div className="cm-tarjetas">
            {furgones.map((f) => {
              const modelo = MODELOS.find((m) => m.valor === f.modelo_3d);
              return (
                <article key={f.id} className={`cm-tarjeta ${f.activo ? "" : "inactiva"}`}>
                  <div className="cm-tarjeta-imagen">
                    {modelo?.imagen ? <img src={modelo.imagen} alt="" loading="lazy" /> : <Truck size={46} aria-hidden="true" />}
                    <span className={`cm-chip ${f.medidas_verificadas ? "ok" : "aviso"}`}>
                      {f.medidas_verificadas ? <BadgeCheck size={13} /> : <AlertTriangle size={13} />}
                      {f.medidas_verificadas ? "Medidas verificadas" : "Medidas sin verificar"}
                    </span>
                  </div>
                  <div className="cm-tarjeta-cuerpo">
                    <h3>
                      {f.nombre}
                      {f.placa && <span className="plano-placa">{f.placa}</span>}
                      {!f.activo && <span className="plano-placa">Inactivo</span>}
                    </h3>
                    <p className="cm-ref">{f.referencia || modelo?.etiqueta}</p>
                    <dl className="cm-datos">
                      <div>
                        <dt>Interior</dt>
                        <dd>
                          {f.largo_cm} × {f.ancho_cm} × {f.alto_cm} cm
                        </dd>
                      </div>
                      <div>
                        <dt>Volumen</dt>
                        <dd>{f.volumen_m3} m³</dd>
                      </div>
                      <div>
                        <dt>Carga útil</dt>
                        <dd>{f.carga_util_kg != null ? `${f.carga_util_kg.toLocaleString("es-CO")} kg` : "Sin dato"}</dd>
                      </div>
                      <div>
                        <dt>Entre ejes</dt>
                        <dd>{f.distancia_entre_ejes_mm != null ? `${f.distancia_entre_ejes_mm.toLocaleString("es-CO")} mm` : "Sin dato"}</dd>
                      </div>
                      <div className="ancho">
                        <dt>Distribución</dt>
                        <dd>{describirEsquema(f)}</dd>
                      </div>
                    </dl>
                    {puedeAdministrar && (
                      <div className="cm-tarjeta-acciones">
                        <button className="btn sm editar" onClick={() => setFurgon(aBorradorFurgon(f))}>
                          <Pencil size={13} /> Editar
                        </button>
                        <button className="btn-icon peligro" aria-label={`Eliminar ${f.nombre}`} onClick={() => borrar("furgon", f)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Canastillas ---------- */}
      <section>
        <div className="cm-titulo">
          <div>
            <h2>
              <Box size={18} /> Canastillas
            </h2>
            <p>Medidas exteriores, peso lleno y cuántas se pueden apilar sin aplastar el producto.</p>
          </div>
          {puedeAdministrar && (
            <button
              className="btn"
              onClick={() => setCanastilla({ nombre: "", largo_cm: "", ancho_cm: "", alto_cm: "", max_apiladas: "5", peso_lleno_kg: "", activa: true })}
            >
              <Plus size={15} /> Nueva canastilla
            </button>
          )}
        </div>
        {canastillas.length === 0 ? (
          <div className="panel plano-vacio">
            <Box size={30} />
            <h2>Sin canastillas</h2>
            <p>Registra la canastilla que usa la empresa con sus medidas reales.</p>
          </div>
        ) : (
          <div className="cm-tarjetas cm-tarjetas--chicas">
            {canastillas.map((c) => (
              <article key={c.id} className={`cm-tarjeta cm-tarjeta--fila ${c.activa ? "" : "inactiva"}`}>
                <div className="cm-icono">
                  <Box size={26} aria-hidden="true" />
                </div>
                <div className="cm-tarjeta-cuerpo">
                  <h3>{c.nombre}</h3>
                  <dl className="cm-datos">
                    <div>
                      <dt>Medidas</dt>
                      <dd>
                        {c.largo_cm} × {c.ancho_cm} × {c.alto_cm} cm
                      </dd>
                    </div>
                    <div>
                      <dt>Peso lleno</dt>
                      <dd>{c.peso_lleno_kg != null ? `${Number(c.peso_lleno_kg)} kg` : "Sin dato"}</dd>
                    </div>
                    <div>
                      <dt>Apilado máx.</dt>
                      <dd>{c.max_apiladas ? `${c.max_apiladas} niveles` : "Hasta el techo"}</dd>
                    </div>
                  </dl>
                </div>
                {puedeAdministrar && (
                  <div className="cm-tarjeta-acciones cm-tarjeta-acciones--col">
                    <button
                      className="btn-icon editar"
                      aria-label={`Editar ${c.nombre}`}
                      onClick={() =>
                        setCanastilla({
                          id: c.id,
                          nombre: c.nombre,
                          largo_cm: String(c.largo_cm),
                          ancho_cm: String(c.ancho_cm),
                          alto_cm: String(c.alto_cm),
                          max_apiladas: String(c.max_apiladas),
                          peso_lleno_kg: c.peso_lleno_kg != null ? String(c.peso_lleno_kg) : "",
                          activa: c.activa,
                        })
                      }
                    >
                      <Pencil size={15} />
                    </button>
                    <button className="btn-icon peligro" aria-label={`Eliminar ${c.nombre}`} onClick={() => borrar("canastilla", c)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {furgon && (
        <EditorFurgon
          d={furgon}
          setD={setFurgon}
          canastillas={canastillas}
          guardando={guardando}
          onGuardar={guardarF}
          onCerrar={() => setFurgon(null)}
        />
      )}
      {canastilla && (
        <Modal
          titulo={canastilla.id ? "Editar canastilla" : "Nueva canastilla"}
          onCerrar={() => setCanastilla(null)}
          amplio
          cerrarConEscape
          footer={
            <>
              <button className="btn secundario" onClick={() => setCanastilla(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                disabled={guardando || !canastilla.nombre.trim() || ![canastilla.largo_cm, canastilla.ancho_cm, canastilla.alto_cm].every((v) => Number(v) > 0)}
                onClick={guardarC}
              >
                {guardando ? "Guardando…" : "Guardar canastilla"}
              </button>
            </>
          }
        >
          <div className="cm-editor">
            <div className="cm-form">
              <fieldset>
                <legend>Identificación</legend>
                <div className="campo">
                  <label htmlFor="cc-nombre">Nombre</label>
                  <input id="cc-nombre" value={canastilla.nombre} maxLength={80} placeholder="Canastilla plástica estándar" onChange={(e) => setCanastilla({ ...canastilla, nombre: e.target.value })} />
                </div>
              </fieldset>
              <fieldset>
                <legend>Medidas exteriores (cm)</legend>
                <div className="cm-grid3">
                  {(["largo_cm", "ancho_cm", "alto_cm"] as const).map((k) => (
                    <div className="campo" key={k}>
                      <label htmlFor={`cc-${k}`}>{{ largo_cm: "Largo", ancho_cm: "Ancho", alto_cm: "Alto" }[k]}</label>
                      <input id={`cc-${k}`} type="number" min={1} inputMode="numeric" value={canastilla[k]} onChange={(e) => setCanastilla({ ...canastilla, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Carga y apilado</legend>
                <div className="cm-grid2">
                  <div className="campo">
                    <label htmlFor="cc-peso">Peso llena (kg)</label>
                    <input id="cc-peso" type="number" min={0} step="0.1" inputMode="decimal" value={canastilla.peso_lleno_kg} onChange={(e) => setCanastilla({ ...canastilla, peso_lleno_kg: e.target.value })} />
                    <p className="campo-ayuda">Vacío = no se puede validar el peso del despacho.</p>
                  </div>
                  <div className="campo">
                    <label htmlFor="cc-apil">Apilado máximo</label>
                    <input id="cc-apil" type="number" min={0} max={50} value={canastilla.max_apiladas} onChange={(e) => setCanastilla({ ...canastilla, max_apiladas: e.target.value })} />
                    <p className="campo-ayuda">0 = hasta el techo del furgón.</p>
                  </div>
                </div>
                <label className="plano-check">
                  <input type="checkbox" checked={canastilla.activa} onChange={(e) => setCanastilla({ ...canastilla, activa: e.target.checked })} />
                  Activa (aparece al armar despachos)
                </label>
              </fieldset>
            </div>
            <div className="cm-preview">
              <h4>Vista previa</h4>
              <Suspense fallback={<div className="cm-vista3d" />}>
                <CanastillaVista3D
                  largo={Number(canastilla.largo_cm) || 0}
                  ancho={Number(canastilla.ancho_cm) || 0}
                  alto={Number(canastilla.alto_cm) || 0}
                  maxApiladas={Number(canastilla.max_apiladas) || 0}
                />
              </Suspense>
              <p className="campo-ayuda">Pila con el apilado máximo, en sus proporciones reales.</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de vehículo, con la distribución calculada en vivo por el servidor
// ---------------------------------------------------------------------------
function EditorFurgon({
  d,
  setD,
  canastillas,
  guardando,
  onGuardar,
  onCerrar,
}: {
  d: BorradorFurgon;
  setD: (d: BorradorFurgon) => void;
  canastillas: TipoCanastilla[];
  guardando: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const [tipoPrevia, setTipoPrevia] = useState<number | "">(canastillas.find((c) => c.activa)?.id ?? "");
  const [previa, setPrevia] = useState<Rejilla | null>(null);
  const [errorPrevia, setErrorPrevia] = useState<string | null>(null);
  const set = <K extends keyof BorradorFurgon>(k: K, v: BorradorFurgon[K]) => setD({ ...d, [k]: v });
  const medidasOk = [d.largo_cm, d.ancho_cm, d.alto_cm].every((v) => Number(v) > 0);

  // La vista previa la calcula el SERVIDOR con las mismas reglas que el despacho.
  useEffect(() => {
    if (!medidasOk || tipoPrevia === "") return;
    let vigente = true;
    const t = setTimeout(() => {
      vistaPreviaEsquema(
        { largo_cm: Number(d.largo_cm), ancho_cm: Number(d.ancho_cm), alto_cm: Number(d.alto_cm), esquema_carga: esquemaDe(d) },
        tipoPrevia
      )
        .then((r) => vigente && (setPrevia(r), setErrorPrevia(null)))
        .catch((e) => vigente && (setPrevia(null), setErrorPrevia(extraerMensajeError(e, "Revisa las medidas."))));
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [d, tipoPrevia, medidasOk]);

  const ancho = Number(d.ancho_cm);
  const valido = d.nombre.trim() && medidasOk && !(previa?.errores?.length);

  return (
    <Modal
      titulo={d.id ? "Editar vehículo" : "Nuevo vehículo"}
      subtitulo="Las medidas son INTERIORES. La distribución se valida con las medidas reales de la canastilla."
      onCerrar={onCerrar}
      amplio
      ancho
      expandible
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn" disabled={guardando || !valido} onClick={onGuardar}>
            {guardando ? "Guardando…" : "Guardar vehículo"}
          </button>
        </>
      }
    >
      <div className="cm-editor cm-editor--furgon">
        <div className="cm-form">
          <fieldset>
            <legend>Identificación</legend>
            <div className="cm-grid2">
              <div className="campo">
                <label htmlFor="cf-nombre">Nombre</label>
                <input id="cf-nombre" value={d.nombre} maxLength={80} placeholder="Hino 500 blanco" onChange={(e) => set("nombre", e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="cf-placa">Placa</label>
                <input id="cf-placa" value={d.placa} maxLength={15} onChange={(e) => set("placa", e.target.value.toUpperCase())} />
              </div>
              <div className="campo">
                <label htmlFor="cf-ref">Referencia (tarjeta de propiedad)</label>
                <input id="cf-ref" value={d.referencia} maxLength={120} placeholder="Hino 500 FC9J" onChange={(e) => set("referencia", e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="cf-modelo">Modelo 3D</label>
                <select id="cf-modelo" value={d.modelo_3d} onChange={(e) => set("modelo_3d", e.target.value as Modelo3D)}>
                  {MODELOS.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Medidas interiores del furgón (cm)</legend>
            <div className="cm-grid3">
              {(["largo_cm", "ancho_cm", "alto_cm"] as const).map((k) => (
                <div className="campo" key={k}>
                  <label htmlFor={`cf-${k}`}>{{ largo_cm: "Largo", ancho_cm: "Ancho", alto_cm: "Alto" }[k]}</label>
                  <input id={`cf-${k}`} type="number" min={1} inputMode="numeric" value={d[k]} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
            </div>
            {ancho > 260 && (
              <p className="plano-aviso-medida" role="alert">
                Un furgón en Colombia no supera 2,60 m de ancho exterior: revisa el ancho interior (¿lo escribiste en metros?).
              </p>
            )}
            <label className="plano-check">
              <input type="checkbox" checked={d.medidas_verificadas} onChange={(e) => set("medidas_verificadas", e.target.checked)} />
              Las medidas interiores se tomaron con metro en el vehículo
            </label>
          </fieldset>

          <fieldset>
            <legend>Capacidad</legend>
            <div className="cm-grid2">
              <div className="campo">
                <label htmlFor="cf-carga">Carga útil (kg)</label>
                <input id="cf-carga" type="number" min={0} inputMode="numeric" value={d.carga_util_kg} onChange={(e) => set("carga_util_kg", e.target.value)} />
                <p className="campo-ayuda">De la ficha o la tarjeta. Vacío = no se valida el peso.</p>
              </div>
              <div className="campo">
                <label htmlFor="cf-ejes">Distancia entre ejes (mm)</label>
                <input id="cf-ejes" type="number" min={1500} max={9000} inputMode="numeric" value={d.distancia_entre_ejes_mm} onChange={(e) => set("distancia_entre_ejes_mm", e.target.value)} />
                <p className="campo-ayuda">Ubica el eje trasero en el modelo 3D.</p>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Distribución de carga</legend>
            <div className="segmentado cm-segmentado" role="radiogroup" aria-label="Distribución">
              <button type="button" role="radio" aria-checked={d.distribucion === "frente_columnas"} className={d.distribucion === "frente_columnas" ? "activo" : ""} onClick={() => set("distribucion", "frente_columnas")}>
                Fila delantera + laterales
              </button>
              <button type="button" role="radio" aria-checked={d.distribucion === "rejilla"} className={d.distribucion === "rejilla" ? "activo" : ""} onClick={() => set("distribucion", "rejilla")}>
                Rejilla uniforme
              </button>
            </div>
            {d.distribucion === "frente_columnas" ? (
              <>
                <p className="campo-ayuda">
                  Fila delantera contra la pared de la cabina ocupando el ancho; después, dos laterales independientes con un pasillo central. Deja una cantidad
                  vacía para que se calcule con las medidas reales.
                </p>
                <div className="cm-grid3">
                  <div className="campo">
                    <label htmlFor="cf-frente">Fila delantera</label>
                    <input id="cf-frente" type="number" min={0} max={12} placeholder="Auto" value={d.frente} onChange={(e) => set("frente", e.target.value)} />
                  </div>
                  <div className="campo">
                    <label htmlFor="cf-izq">Lateral izquierdo</label>
                    <input id="cf-izq" type="number" min={0} max={40} placeholder="Auto" value={d.izquierda} onChange={(e) => set("izquierda", e.target.value)} />
                  </div>
                  <div className="campo">
                    <label htmlFor="cf-der">Lateral derecho</label>
                    <input id="cf-der" type="number" min={0} max={40} placeholder="Auto" value={d.derecha} onChange={(e) => set("derecha", e.target.value)} />
                  </div>
                  <div className="campo">
                    <label htmlFor="cf-niv">Niveles de apilado</label>
                    <input id="cf-niv" type="number" min={1} max={20} value={d.niveles} onChange={(e) => set("niveles", e.target.value)} />
                  </div>
                  <div className="campo">
                    <label htmlFor="cf-pas">Pasillo mínimo (cm)</label>
                    <input id="cf-pas" type="number" min={0} max={200} value={d.pasillo_min_cm} onChange={(e) => set("pasillo_min_cm", e.target.value)} />
                  </div>
                  <div className="campo">
                    <label htmlFor="cf-orient">Laterales</label>
                    <select id="cf-orient" value={d.orientacion_laterales} onChange={(e) => set("orientacion_laterales", e.target.value as BorradorFurgon["orientacion_laterales"])}>
                      <option value="longitudinal">Longitudinales</option>
                      <option value="transversal">Transversales</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <p className="campo-ayuda">Todo el piso en rejilla, con la orientación que mete más canastillas. Se descarga desde las puertas.</p>
            )}
            <label className="plano-check">
              <input type="checkbox" checked={d.activo} onChange={(e) => set("activo", e.target.checked)} />
              Activo (aparece al armar despachos)
            </label>
          </fieldset>
        </div>

        <div className="cm-preview">
          <div className="cm-preview-cab">
            <h4>Vista previa de la distribución</h4>
            <select aria-label="Canastilla para la vista previa" value={tipoPrevia} onChange={(e) => setTipoPrevia(e.target.value ? Number(e.target.value) : "")}>
              {canastillas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.largo_cm}×{c.ancho_cm}×{c.alto_cm})
                </option>
              ))}
            </select>
          </div>
          {!canastillas.length ? (
            <p className="vacio">Registra una canastilla para ver cómo cabe.</p>
          ) : !medidasOk ? (
            <p className="vacio">Escribe las medidas interiores.</p>
          ) : errorPrevia ? (
            <p className="plano-aviso-medida">{errorPrevia}</p>
          ) : previa ? (
            <>
              <Plano2D rejilla={previa} grupos={[]} posiciones={[]} bloqueos={[]} pilaSeleccionada={null} resaltado={null} editable={false} onSeleccionar={() => {}} onMover={() => {}} />
              <div className="cm-preview-datos">
                <span>
                  <strong>{previa.capacidad}</strong> canastillas
                </span>
                <span>
                  <strong>{previa.pilas.length}</strong> posiciones × {previa.niveles}
                </span>
                {previa.esquema === "frente_columnas" && (
                  <>
                    <span>
                      Fila delantera <strong>{previa.pilas.filter((p) => p.zona === "frente").length}</strong>
                    </span>
                    <span>
                      Izq. <strong>{previa.pilas.filter((p) => p.zona === "izquierda").length}</strong> · Der.{" "}
                      <strong>{previa.pilas.filter((p) => p.zona === "derecha").length}</strong>
                    </span>
                    <span>
                      Pasillo <strong>{previa.pasillo_cm} cm</strong>
                    </span>
                  </>
                )}
              </div>
              {(previa.errores.length > 0 || previa.avisos.length > 0) && (
                <ul className="cm-preview-avisos">
                  {previa.errores.map((t) => (
                    <li key={t} className="error">
                      {t}
                    </li>
                  ))}
                  {previa.avisos.map((t) => (
                    <li key={t} className="aviso">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="vacio">Calculando…</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
