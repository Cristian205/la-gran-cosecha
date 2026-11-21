import {
  CalendarDays,
  ClipboardList,
  Layers,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { listarLotes, obtenerLote, type Lote, type LoteResumido } from "../../api/lotes";
import type { Furgon } from "../../api/logistica";
import { EstadoVacio, TarjetaKpi } from "../../components/gestion/Gestion";
import { Tooltip } from "../../components/Tooltip";
import { extraerMensajeError } from "../../utils";
import { alertaError } from "../../utils/alertas";
import LoteTablero from "./LoteTablero";
import { EstadoDeLote, fechaCorta, fmt, momento } from "./loteUi";

/**
 * La pestaña de lotes de despacho: la lista de lo preparado y el tablero del
 * lote abierto.
 *
 * Los lotes se crean desde la tabla de pedidos («Crear lote de despacho»);
 * aquí se retoman, se corrigen y se cierran. Un lote abierto ocupa la
 * pantalla completa: es la vista centralizada desde la que se termina el
 * despacho del día sin ir y venir entre módulos.
 */

interface Props {
  furgones: Furgon[];
  puedeArmar: boolean;
  /** Lote que la URL pide abrir (`/plano?lote=12`). */
  loteInicial: number | null;
  onLoteAbierto: (id: number | null) => void;
  onAbrirDespacho: (id: number) => void;
  onIrARutas: () => void;
  onIrAPedidos: () => void;
  onDespachosCambiaron: () => void;
}

const VIVOS = new Set(["PREPARACION", "PREPARADO", "CONFIRMADO", "EN_RUTA"]);

export default function LotesDespacho({
  furgones,
  puedeArmar,
  loteInicial,
  onLoteAbierto,
  onAbrirDespacho,
  onIrARutas,
  onIrAPedidos,
  onDespachosCambiaron,
}: Props) {
  const [lista, setLista] = useState<LoteResumido[] | null>(null);
  const [abierto, setAbierto] = useState<Lote | null>(null);
  const [cargando, setCargando] = useState(false);
  const [soloVivos, setSoloVivos] = useState(true);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      setLista(await listarLotes());
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudieron cargar los lotes."));
    } finally {
      setCargando(false);
    }
  }, []);

  const abrir = useCallback(
    async (id: number) => {
      setCargando(true);
      try {
        const lote = await obtenerLote(id);
        setAbierto(lote);
        onLoteAbierto(id);
      } catch (e) {
        alertaError(extraerMensajeError(e, "No se pudo abrir el lote."));
        onLoteAbierto(null);
      } finally {
        setCargando(false);
      }
    },
    [onLoteAbierto]
  );

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  // La URL manda al entrar: `/plano?lote=12` abre ese lote directamente, que
  // es a donde lleva «Crear lote de despacho» desde la tabla de pedidos.
  useEffect(() => {
    if (loteInicial && loteInicial !== abierto?.id) abrir(loteInicial);
    if (!loteInicial && abierto) setAbierto(null);
  }, [loteInicial, abierto, abrir]);

  function volver() {
    setAbierto(null);
    onLoteAbierto(null);
    cargarLista();
  }

  if (abierto)
    return (
      <LoteTablero
        lote={abierto}
        furgones={furgones}
        puedeArmar={puedeArmar}
        onCambiado={(l) => setAbierto(l)}
        onVolver={volver}
        onAbrirDespacho={onAbrirDespacho}
        onIrARutas={onIrARutas}
        onDespachosCambiaron={onDespachosCambiaron}
      />
    );

  const filas = (lista ?? []).filter((l) => !soloVivos || VIVOS.has(l.estado));
  const activos = (lista ?? []).filter((l) => VIVOS.has(l.estado));
  const porConfirmar = activos.filter((l) => l.estado === "PREPARACION" || l.estado === "PREPARADO");
  const enRuta = activos.filter((l) => l.estado === "EN_RUTA");

  return (
    <>
      <div className="kpis-gestion">
        <TarjetaKpi
          tono="neutro"
          icono={<ClipboardList size={18} />}
          etiqueta="Lotes abiertos"
          descripcion="Lotes que todavía se están preparando o ya salieron"
          valor={lista === null ? null : fmt(activos.length)}
          pie={lista !== null && `${fmt(lista.length)} en total`}
        />
        <TarjetaKpi
          tono={porConfirmar.length ? "ambar" : "verde"}
          icono={<Layers size={18} />}
          etiqueta="Por confirmar"
          descripcion="Lotes en preparación o con despachos en borrador"
          valor={lista === null ? null : fmt(porConfirmar.length)}
          pie={lista !== null && (porConfirmar.length ? "requieren revisión" : "nada pendiente")}
        />
        <TarjetaKpi
          tono="azul"
          icono={<Truck size={18} />}
          etiqueta="En ruta"
          descripcion="Lotes cuyos vehículos ya salieron a entregar"
          valor={lista === null ? null : fmt(enRuta.length)}
          pie={lista !== null && (enRuta.length ? "sin cerrar el día" : "ninguno en calle")}
        />
        <TarjetaKpi
          tono="violeta"
          icono={<ShieldCheck size={18} />}
          etiqueta="Pedidos en preparación"
          descripcion="Pedidos reservados en los lotes abiertos"
          valor={lista === null ? null : fmt(activos.reduce((a, l) => a + l.pedidos, 0))}
          pie={lista !== null && `${fmt(activos.reduce((a, l) => a + l.canastillas, 0))} canastillas`}
        />
      </div>

      <section className="panel gestion-modulo">
        <div className="gestion-modulo-cab">
          <div className="gestion-toolbar lote-toolbar">
            <label className="pl-check-inline">
              <input type="checkbox" checked={soloVivos} onChange={(e) => setSoloVivos(e.target.checked)} />
              <span>Solo lotes abiertos</span>
            </label>
            <span className="pl-flex" />
            <Tooltip label="Actualizar" posicion="abajo">
              <button
                type="button"
                className="btn-icon gestion-actualizar-icono"
                onClick={cargarLista}
                disabled={cargando}
                aria-label="Actualizar la lista de lotes"
              >
                <RefreshCw size={16} className={cargando ? "girando" : ""} />
              </button>
            </Tooltip>
            {puedeArmar && (
              <button type="button" className="btn primario sm" onClick={onIrAPedidos}>
                <PackageSearch size={15} /> Crear lote desde pedidos
              </button>
            )}
          </div>
        </div>

        {lista !== null && filas.length === 0 ? (
          <EstadoVacio
            icono={<Layers size={20} />}
            titulo={soloVivos && lista.length ? "No hay lotes abiertos" : "Todavía no has preparado ningún lote"}
            texto="Un lote agrupa los pedidos de un día de entrega, los reparte entre las turbos y deja listos los planos de carga y los documentos."
            accion={
              puedeArmar && (
                <button type="button" className="btn primario sm" onClick={onIrAPedidos}>
                  <PackageSearch size={14} /> Elegir pedidos
                </button>
              )
            }
          />
        ) : (
          <div className="tabla-scroll gestion-tabla-scroll">
            <table className="gestion-tabla">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Entrega</th>
                  <th>Estado</th>
                  <th className="num">Pedidos</th>
                  <th className="num">Vehículos</th>
                  <th className="num">Canastillas</th>
                  <th>Despachos</th>
                  <th>Preparado por</th>
                  <th className="col-acciones">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista === null
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="fila-esqueleto">
                        <td colSpan={9}>
                          <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: `${70 - i * 10}%` }} />
                        </td>
                      </tr>
                    ))
                  : filas.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <span className="celda-id">#{l.numero}</span>
                          {l.nombre && <small className="celda-nombre"> {l.nombre}</small>}
                        </td>
                        <td>
                          <time className="celda-fecha" dateTime={l.fecha}>
                            <CalendarDays size={12} /> {fechaCorta(l.fecha)}
                          </time>
                        </td>
                        <td>
                          <EstadoDeLote estado={l.estado} />
                        </td>
                        <td className="num">{fmt(l.pedidos)}</td>
                        <td className="num">{fmt(l.vehiculos)}</td>
                        <td className="num">{fmt(l.canastillas)}</td>
                        <td>
                          {l.despachos === 0 ? (
                            <span className="celda-tenue">sin generar</span>
                          ) : (
                            `${l.despachos_confirmados} / ${l.despachos} confirmados`
                          )}
                        </td>
                        <td>
                          <span className="celda-tenue">
                            {l.creado_por || "—"}
                            <small> · {momento(l.actualizado)}</small>
                          </span>
                        </td>
                        <td className="col-acciones">
                          <button type="button" className="btn secundario sm" onClick={() => abrir(l.id)}>
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
