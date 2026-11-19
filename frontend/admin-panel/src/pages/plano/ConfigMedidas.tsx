import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  eliminarCanastilla,
  eliminarFurgon,
  guardarCanastilla,
  guardarFurgon,
  type Furgon,
  type Modelo3D,
  type TipoCanastilla,
} from "../../api/logistica";
import { Modal } from "../../components/Modal";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarEliminar } from "../../utils/alertas";

/** Furgones y canastillas: las medidas con las que se arma cada plano. */

type Tipo = "furgon" | "canastilla";

interface Borrador {
  id?: number;
  nombre: string;
  placa: string;
  largo_cm: string;
  ancho_cm: string;
  alto_cm: string;
  max_apiladas: string;
  activo: boolean;
  referencia: string;
  modelo_3d: Modelo3D;
  carga_util_kg: string;
  distancia_entre_ejes_mm: string;
  altura_piso_mm: string;
  medidas_verificadas: boolean;
  peso_lleno_kg: string;
}

const VACIO: Borrador = {
  nombre: "", placa: "", largo_cm: "", ancho_cm: "", alto_cm: "", max_apiladas: "0", activo: true,
  referencia: "", modelo_3d: "hino500", carga_util_kg: "", distancia_entre_ejes_mm: "", altura_piso_mm: "",
  medidas_verificadas: false, peso_lleno_kg: "",
};

const MODELOS: Array<{ valor: Modelo3D; etiqueta: string }> = [
  { valor: "hino500", etiqueta: "Hino 500 con furgón" },
  { valor: "foton", etiqueta: "Foton con furgón (próximamente)" },
  { valor: "generico", etiqueta: "Furgón genérico" },
];

const numeroONulo = (v: string) => (v.trim() === "" ? null : Number(v));

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
  const [editando, setEditando] = useState<{ tipo: Tipo; datos: Borrador } | null>(null);
  const [guardando, setGuardando] = useState(false);

  function abrir(tipo: Tipo, x?: Furgon | TipoCanastilla) {
    if (!x) return setEditando({ tipo, datos: { ...VACIO } });
    setEditando({
      tipo,
      datos: {
        id: x.id,
        nombre: x.nombre,
        placa: "placa" in x ? x.placa : "",
        largo_cm: String(x.largo_cm),
        ancho_cm: String(x.ancho_cm),
        alto_cm: String(x.alto_cm),
        max_apiladas: "max_apiladas" in x ? String(x.max_apiladas) : "0",
        activo: "activo" in x ? x.activo : x.activa,
        referencia: "referencia" in x ? x.referencia : "",
        modelo_3d: "modelo_3d" in x ? x.modelo_3d : "generico",
        carga_util_kg: "carga_util_kg" in x && x.carga_util_kg != null ? String(x.carga_util_kg) : "",
        distancia_entre_ejes_mm:
          "distancia_entre_ejes_mm" in x && x.distancia_entre_ejes_mm != null ? String(x.distancia_entre_ejes_mm) : "",
        altura_piso_mm: "altura_piso_mm" in x && x.altura_piso_mm != null ? String(x.altura_piso_mm) : "",
        medidas_verificadas: "medidas_verificadas" in x ? x.medidas_verificadas : false,
        peso_lleno_kg: "peso_lleno_kg" in x && x.peso_lleno_kg != null ? String(x.peso_lleno_kg) : "",
      },
    });
  }

  async function guardar() {
    if (!editando) return;
    const d = editando.datos;
    const base = {
      id: d.id,
      nombre: d.nombre.trim(),
      largo_cm: Number(d.largo_cm),
      ancho_cm: Number(d.ancho_cm),
      alto_cm: Number(d.alto_cm),
    };
    setGuardando(true);
    try {
      if (editando.tipo === "furgon") {
        await guardarFurgon({
          ...base,
          placa: d.placa.trim(),
          activo: d.activo,
          referencia: d.referencia.trim(),
          modelo_3d: d.modelo_3d,
          carga_util_kg: numeroONulo(d.carga_util_kg),
          distancia_entre_ejes_mm: numeroONulo(d.distancia_entre_ejes_mm),
          altura_piso_mm: numeroONulo(d.altura_piso_mm),
          medidas_verificadas: d.medidas_verificadas,
        });
      } else {
        await guardarCanastilla({
          ...base,
          max_apiladas: Number(d.max_apiladas) || 0,
          activa: d.activo,
          peso_lleno_kg: d.peso_lleno_kg.trim() === "" ? null : d.peso_lleno_kg.trim(),
        });
      }
      alertaExito(editando.tipo === "furgon" ? "Furgón guardado" : "Canastilla guardada");
      setEditando(null);
      onCambio();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(tipo: Tipo, x: Furgon | TipoCanastilla) {
    if (!(await confirmarEliminar(`¿Eliminar «${x.nombre}»?`, "Si ya se usa en planos guardados, desactívalo en su lugar."))) return;
    try {
      await (tipo === "furgon" ? eliminarFurgon(x.id) : eliminarCanastilla(x.id));
      onCambio();
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar."));
    }
  }

  const medidas = (x: { largo_cm: number; ancho_cm: number; alto_cm: number }) =>
    `${x.largo_cm} × ${x.ancho_cm} × ${x.alto_cm} cm`;

  const d = editando?.datos;
  const set = (campo: keyof Borrador, valor: string | boolean) =>
    setEditando((e) => (e ? { ...e, datos: { ...e.datos, [campo]: valor } } : e));
  const valido =
    d && d.nombre.trim() && [d.largo_cm, d.ancho_cm, d.alto_cm].every((v) => Number(v) > 0);

  return (
    <div className="plano-config">
      {(["furgon", "canastilla"] as Tipo[]).map((tipo) => {
        const items: Array<Furgon | TipoCanastilla> = tipo === "furgon" ? furgones : canastillas;
        return (
          <section className="panel" key={tipo}>
            <div className="cabecera">
              <h2>{tipo === "furgon" ? "Furgones" : "Canastillas"}</h2>
              {puedeAdministrar && (
                <button className="btn sm" onClick={() => abrir(tipo)}>
                  <Plus size={14} /> {tipo === "furgon" ? "Nuevo furgón" : "Nueva canastilla"}
                </button>
              )}
            </div>
            <p className="plano-ayuda">
              {tipo === "furgon"
                ? "Mide el espacio de carga por DENTRO: largo (de la cabina a la puerta), ancho y alto."
                : "Medidas exteriores de la canastilla y cuántas se pueden apilar sin aplastar el producto."}
            </p>
            {items.length === 0 ? (
              <p className="vacio">{tipo === "furgon" ? "Aún no hay furgones." : "Aún no hay canastillas."}</p>
            ) : (
              <ul className="plano-config-lista">
                {items.map((x) => {
                  const activo = "activo" in x ? x.activo : x.activa;
                  return (
                    <li key={x.id} className={activo ? "" : "inactivo"}>
                      <div>
                        <strong>{x.nombre}</strong>
                        {"placa" in x && x.placa && <span className="plano-placa">{x.placa}</span>}
                        {!activo && <span className="plano-placa">Inactivo</span>}
                        {"referencia" in x && x.referencia && <span className="plano-placa">{x.referencia}</span>}
                        {"medidas_verificadas" in x && !x.medidas_verificadas && (
                          <span className="plano-placa plano-placa--aviso">Medidas sin verificar</span>
                        )}
                        <small>
                          Interior {medidas(x)}
                          {"volumen_m3" in x && ` · ${x.volumen_m3} m³`}
                          {"carga_util_kg" in x && ` · carga útil ${x.carga_util_kg != null ? `${x.carga_util_kg} kg` : "sin dato"}`}
                          {"max_apiladas" in x && ` · ${x.max_apiladas ? `máx. ${x.max_apiladas} apiladas` : "apiladas hasta el techo"}`}
                          {"peso_lleno_kg" in x && ` · ${x.peso_lleno_kg != null ? `${Number(x.peso_lleno_kg)} kg llena` : "peso sin dato"}`}
                        </small>
                      </div>
                      {puedeAdministrar && (
                        <div className="acciones">
                          <button className="btn-icon editar" aria-label={`Editar ${x.nombre}`} onClick={() => abrir(tipo, x)}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon peligro" aria-label={`Eliminar ${x.nombre}`} onClick={() => eliminar(tipo, x)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {editando && d && (
        <Modal
          titulo={`${d.id ? "Editar" : "Nuevo"} ${editando.tipo === "furgon" ? "furgón" : "tipo de canastilla"}`}
          onCerrar={() => setEditando(null)}
          amplio
          medio
          cerrarConEscape
          footer={
            <>
              <button className="btn secundario" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button className="btn" disabled={!valido || guardando} onClick={guardar}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div className="plano-form-grid">
            <div className="campo">
              <label htmlFor="pm-nombre">Nombre</label>
              <input
                id="pm-nombre"
                value={d.nombre}
                maxLength={80}
                placeholder={editando.tipo === "furgon" ? "NHR blanco" : "Canastilla plástica"}
                onChange={(e) => set("nombre", e.target.value)}
              />
            </div>
            {editando.tipo === "furgon" ? (
              <div className="campo">
                <label htmlFor="pm-placa">Placa (opcional)</label>
                <input id="pm-placa" value={d.placa} maxLength={15} onChange={(e) => set("placa", e.target.value.toUpperCase())} />
              </div>
            ) : (
              <div className="campo">
                <label htmlFor="pm-apiladas">Máximo apiladas</label>
                <input
                  id="pm-apiladas"
                  type="number"
                  min={0}
                  max={50}
                  value={d.max_apiladas}
                  onChange={(e) => set("max_apiladas", e.target.value)}
                />
                <p className="campo-ayuda">0 = las que quepan hasta el techo.</p>
              </div>
            )}
            {editando.tipo === "furgon" && (
              <>
                <div className="campo">
                  <label htmlFor="pm-ref">Referencia (tarjeta de propiedad)</label>
                  <input id="pm-ref" value={d.referencia} maxLength={120} placeholder="Hino 500 FC9J…" onChange={(e) => set("referencia", e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="pm-modelo">Modelo 3D</label>
                  <select id="pm-modelo" value={d.modelo_3d} onChange={(e) => set("modelo_3d", e.target.value)}>
                    {MODELOS.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {(["largo_cm", "ancho_cm", "alto_cm"] as const).map((campo) => (
              <div className="campo" key={campo}>
                <label htmlFor={`pm-${campo}`}>
                  {{ largo_cm: "Largo", ancho_cm: "Ancho", alto_cm: "Alto" }[campo]}
                  {editando.tipo === "furgon" ? " interior" : ""} (cm)
                </label>
                <input
                  id={`pm-${campo}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={d[campo]}
                  onChange={(e) => set(campo, e.target.value)}
                />
              </div>
            ))}
            {editando.tipo === "furgon" && (Number(d.ancho_cm) > 260 || Number(d.alto_cm) > 300) && (
              <p className="plano-aviso-medida" role="alert">
                Revisa las medidas: un furgón en Colombia no supera 2,60 m de ancho exterior, así que su interior suele
                rondar 2,30–2,45 m de ancho y 2,0–2,4 m de alto. Si las tomaste en metros, escríbelas en centímetros.
              </p>
            )}
            {editando.tipo === "furgon" ? (
              <>
                <div className="campo">
                  <label htmlFor="pm-carga">Carga útil (kg)</label>
                  <input id="pm-carga" type="number" min={0} inputMode="numeric" value={d.carga_util_kg} onChange={(e) => set("carga_util_kg", e.target.value)} />
                  <p className="campo-ayuda">De la ficha técnica o la tarjeta. Vacío = no se valida el peso.</p>
                </div>
                <div className="campo">
                  <label htmlFor="pm-ejes">Distancia entre ejes (mm)</label>
                  <input id="pm-ejes" type="number" min={1500} max={9000} inputMode="numeric" value={d.distancia_entre_ejes_mm} onChange={(e) => set("distancia_entre_ejes_mm", e.target.value)} />
                  <p className="campo-ayuda">Ubica el eje trasero en el modelo 3D.</p>
                </div>
                <label className="plano-check">
                  <input type="checkbox" checked={d.medidas_verificadas} onChange={(e) => set("medidas_verificadas", e.target.checked)} />
                  Las medidas interiores se tomaron con metro en el vehículo
                </label>
              </>
            ) : (
              <div className="campo">
                <label htmlFor="pm-peso">Peso de la canastilla llena (kg)</label>
                <input id="pm-peso" type="number" min={0} step="0.1" inputMode="decimal" value={d.peso_lleno_kg} onChange={(e) => set("peso_lleno_kg", e.target.value)} />
                <p className="campo-ayuda">Vacío = no se puede estimar el peso del despacho.</p>
              </div>
            )}
            <label className="plano-check">
              <input type="checkbox" checked={d.activo} onChange={(e) => set("activo", e.target.checked)} />
              {editando.tipo === "furgon" ? "Activo (aparece al armar planos)" : "Activa (aparece al armar planos)"}
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
