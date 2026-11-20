import { Info, PackageCheck, Save, Search, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { guardarReglasCarga, listarReglasCarga, type ReglaCarga } from "../../api/logistica";
import { EstadoVacio, Pastilla } from "../../components/gestion/Gestion";
import { extraerMensajeError, normalizarTexto } from "../../utils";
import { alertaError, alertaExito } from "../../utils/alertas";

/**
 * Reglas de carga por presentación del catálogo: cuántas unidades de esa
 * presentación llenan una canastilla y cuánto pesa una unidad. Son la ÚNICA
 * base para estimar canastillas y peso en la planificación: sin regla no se
 * convierte nada y la parada se marca para revisar a mano.
 */

type Fila = ReglaCarga & { upc: string; peso: string };

const aFila = (r: ReglaCarga): Fila => ({ ...r, upc: r.unidades_por_canastilla ?? "", peso: r.peso_kg_por_unidad ?? "" });
const limpio = (v: string) => (v.trim() === "" ? null : v.trim().replace(",", "."));
const cambiada = (f: Fila) => limpio(f.upc) !== f.unidades_por_canastilla || limpio(f.peso) !== f.peso_kg_por_unidad;
const valida = (v: string) => v.trim() === "" || (Number(v.replace(",", ".")) > 0 && Number.isFinite(Number(v.replace(",", "."))));

export default function ReglasCarga({ puedeAdministrar }: { puedeAdministrar: boolean }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [soloSin, setSoloSin] = useState(false);

  useEffect(() => {
    listarReglasCarga()
      .then((r) => setFilas(r.map(aFila)))
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudieron cargar las reglas de carga.")))
      .finally(() => setCargando(false));
  }, []);

  const sucias = filas.filter(cambiada);
  const invalidas = sucias.filter((f) => !valida(f.upc) || !valida(f.peso));
  const conRegla = filas.filter((f) => f.unidades_por_canastilla).length;
  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    return filas.filter(
      (f) => (!soloSin || !f.unidades_por_canastilla) && (!q || normalizarTexto(`${f.producto} ${f.presentacion_nombre} ${f.categoria}`).includes(q))
    );
  }, [filas, busqueda, soloSin]);

  function editar(id: number, parcial: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.presentacion === id ? { ...f, ...parcial } : f)));
  }

  async function guardar() {
    setGuardando(true);
    try {
      const r = await guardarReglasCarga(
        sucias.map((f) => ({ presentacion: f.presentacion, unidades_por_canastilla: limpio(f.upc), peso_kg_por_unidad: limpio(f.peso) }))
      );
      setFilas(r.map(aFila));
      alertaExito("Reglas de carga guardadas");
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudieron guardar las reglas."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="panel gestion-modulo pl-reglas" aria-label="Reglas de carga">
      <div className="cm-titulo">
        <div>
          <h2>
            <PackageCheck size={18} /> Reglas de carga por producto
          </h2>
          <p>
            Cuántas unidades de cada presentación llenan una canastilla y cuánto pesa una unidad. Con ellas la planificación estima canastillas y peso;
            sin ellas no se convierte nada.
          </p>
        </div>
        {!cargando && (
          <Pastilla tono={conRegla === filas.length ? "verde" : "ambar"}>
            {conRegla} de {filas.length} con regla
          </Pastilla>
        )}
      </div>

      <div className="gestion-toolbar">
        <div className="buscador gestion-buscador">
          <Search size={16} />
          <input type="search" placeholder="Buscar producto o presentación…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar producto" />
          {busqueda && (
            <button type="button" className="gestion-buscador-fin gestion-buscador-limpiar" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">
              <X size={14} />
            </button>
          )}
        </div>
        <label className="pl-check pl-check-inline">
          <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} />
          <span>Solo sin regla</span>
        </label>
        {puedeAdministrar && sucias.length > 0 && (
          <>
            <button type="button" className="btn secundario sm" onClick={() => setFilas((fs) => fs.map((f) => aFila(f)))}>
              <Undo2 size={14} /> Descartar
            </button>
            <button type="button" className="btn primario sm" disabled={guardando || invalidas.length > 0} onClick={guardar}>
              <Save size={14} /> {guardando ? "Guardando…" : `Guardar ${sucias.length} cambio${sucias.length === 1 ? "" : "s"}`}
            </button>
          </>
        )}
      </div>

      <p className="pl-meta pl-reglas-ayuda">
        <Info size={13} /> Ejemplo: si 25 «Kilo» de papa llenan una canastilla, escribe 25 y 1 kg por unidad. Si un «Bulto de 50 kg» ocupa dos canastillas, escribe 0,5.
      </p>

      <div className="tabla-scroll gestion-tabla-scroll">
        <table className="gestion-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Se vende por</th>
              <th className="num">Unidades por canastilla</th>
              <th className="num">Kg por unidad</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr className="fila-esqueleto">
                <td colSpan={4}>
                  <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: "60%" }} />
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr className="fila-vacia">
                <td colSpan={4}>
                  <EstadoVacio icono={<PackageCheck size={20} />} titulo={filas.length ? "Nada coincide" : "Sin productos activos"} texto={filas.length ? "Prueba con otra búsqueda." : "Las reglas se definen por presentación del catálogo."} />
                </td>
              </tr>
            ) : (
              visibles.map((f) => (
                <tr key={f.presentacion} className={cambiada(f) ? "pl-fila-cambiada" : ""}>
                  <td>
                    <span className="celda-nombre">{f.producto}</span>
                    {f.categoria && <small className="celda-tenue"> · {f.categoria}</small>}
                  </td>
                  <td>{f.unidad}</td>
                  <td className="num">
                    <input
                      className={`pl-input-num ${valida(f.upc) ? "" : "invalido"}`}
                      inputMode="decimal"
                      value={f.upc}
                      placeholder="sin regla"
                      disabled={!puedeAdministrar}
                      aria-label={`Unidades por canastilla de ${f.producto} (${f.unidad})`}
                      onChange={(e) => editar(f.presentacion, { upc: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      className={`pl-input-num ${valida(f.peso) ? "" : "invalido"}`}
                      inputMode="decimal"
                      value={f.peso}
                      placeholder="—"
                      disabled={!puedeAdministrar}
                      aria-label={`Kg por unidad de ${f.producto} (${f.unidad})`}
                      onChange={(e) => editar(f.presentacion, { peso: e.target.value })}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
