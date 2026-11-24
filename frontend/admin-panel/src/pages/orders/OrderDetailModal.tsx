import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { descargarPdfPedido } from "../../api/resources";
import { EstadoVacio } from "../../components/gestion/Gestion";
import { Modal } from "../../components/Modal";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarDescartar, elegirEntreDos } from "../../utils/alertas";
import { MetaPedido, PestanasPedido, type Pestana } from "./gestion/CabeceraPedido";
import { EntregaPedido } from "./gestion/EntregaPedido";
import { HistorialPedido } from "./gestion/HistorialPedido";
import { PiePedido } from "./gestion/PiePedido";
import { Esqueleto } from "./gestion/piezas";
import { ProductosPedido } from "./gestion/ProductosPedido";
import { ResumenPedido } from "./gestion/ResumenPedido";
import { useGestionPedido, type EstadoAccion } from "./gestion/useGestionPedido";
import "./gestion/gestionPedido.css";

interface Props {
  pedidoId: number;
  soloLectura?: boolean;
  onCerrar: () => void;
  /** Tras guardar: el modal sigue abierto y la lista de fondo se refresca. */
  onGuardado: () => void;
}

/**
 * El centro de gestión de un pedido: cabecera y pie fijos, cuatro pestañas
 * entre las que nada se pierde (todo el estado vive en `useGestionPedido`) y
 * un único «Guardar» que envía la versión definitiva.
 */
export function OrderDetailModal({ pedidoId, soloLectura = false, onCerrar, onGuardado }: Props) {
  const idBase = useId().replace(/:/g, "");
  const g = useGestionPedido(pedidoId, soloLectura, onGuardado);
  const [pestana, setPestana] = useState<Pestana>("resumen");
  // Cada pestaña se monta la primera vez que se visita y después solo se
  // oculta: su desplazamiento y lo escrito en ella siguen ahí al volver.
  const [visitadas, setVisitadas] = useState<Set<Pestana>>(() => new Set(["resumen"]));
  const [estadoImpresion, setEstadoImpresion] = useState<EstadoAccion>("inactivo");
  const temporizadorImpresion = useRef<number>();

  const irA = useCallback((p: Pestana) => {
    setPestana(p);
    setVisitadas((prev) => (prev.has(p) ? prev : new Set(prev).add(p)));
  }, []);

  useEffect(() => () => window.clearTimeout(temporizadorImpresion.current), []);

  async function cerrar() {
    if (g.cambios.total > 0 && !soloLectura) {
      if (!(await confirmarDescartar(`Tienes ${g.cambios.total} cambio(s) sin guardar en este pedido.`))) return;
    }
    onCerrar();
  }

  async function guardar() {
    const fallo = await g.guardar();
    if (fallo === "productos" || fallo === "entrega") irA(fallo);
    if (fallo === null) void alertaExito(`Pedido #${pedidoId} guardado`);
    return fallo === null;
  }

  async function imprimir() {
    if (!g.pedido) return;
    // La factura sale de lo GUARDADO. Con cambios pendientes, se decide antes.
    if (g.cambios.total > 0 && !soloLectura) {
      const eleccion = await elegirEntreDos(
        "Hay cambios sin guardar",
        "La factura se genera con la versión guardada del pedido. ¿Guardar primero para que la factura los incluya?",
        "Guardar e imprimir",
        "Imprimir lo guardado"
      );
      if (eleccion === null) return;
      if (eleccion === "principal" && !(await guardar())) return;
    }
    setEstadoImpresion("cargando");
    try {
      await descargarPdfPedido(pedidoId);
      setEstadoImpresion("exito");
      void g.cargarEventos();
    } catch (err) {
      setEstadoImpresion("error");
      void alertaError(extraerMensajeError(err, "No se pudo generar la factura del pedido."));
    } finally {
      window.clearTimeout(temporizadorImpresion.current);
      temporizadorImpresion.current = window.setTimeout(() => setEstadoImpresion("inactivo"), 2400);
    }
  }

  // Ctrl/⌘ + S guarda sin salir del teclado.
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  useEffect(() => {
    if (soloLectura) return;
    function alPulsar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void guardarRef.current();
      }
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [soloLectura]);

  const cargado = Boolean(g.pedido && g.entrega);
  const totalGuardado = g.pedido ? Number(g.pedido.total_pedido) : null;
  const productosConError = g.errores.size > 0;
  const entregaConError = Object.keys(g.erroresEntrega).length > 0;

  function panel(p: Pestana, contenido: () => JSX.Element) {
    if (!visitadas.has(p)) return null;
    return (
      <div
        role="tabpanel"
        id={`${idBase}-panel-${p}`}
        aria-labelledby={`${idBase}-tab-${p}`}
        hidden={pestana !== p}
        className={`gp-panel-pestana gp-panel-${p}`}
      >
        {contenido()}
      </div>
    );
  }

  return (
    <Modal
      amplio
      ancho
      expandible
      cerrarConEscape
      clase="modal-pedido"
      titulo={`Pedido #${String(pedidoId).padStart(4, "0")}`}
      subtitulo={<MetaPedido pedido={g.pedido} />}
      onCerrar={cerrar}
      // `cerrar` ya pregunta antes de descartar: el modal no repite la pregunta.
      preguntaAlCerrar
      subcabecera={
        <PestanasPedido
          idBase={idBase}
          activa={pestana}
          onCambiar={irA}
          contadores={{
            productos: cargado ? g.activas.length : null,
            historial: g.eventos ? g.eventos.length : null,
          }}
          pendientes={{
            productos: g.cambios.agregadas + g.cambios.editadas + g.cambios.eliminadas > 0,
            entrega: g.cambios.entrega > 0,
          }}
          conError={{ productos: productosConError, entrega: entregaConError }}
        />
      }
      footer={
        <PiePedido
          total={g.total}
          totalGuardado={totalGuardado}
          cambios={g.cambios}
          soloLectura={soloLectura}
          cargado={cargado}
          estadoGuardado={g.estadoGuardado}
          estadoImpresion={estadoImpresion}
          onCerrar={cerrar}
          onImprimir={imprimir}
          onGuardar={() => void guardar()}
          onDescartar={g.descartarCambios}
        />
      }
    >
      {g.errorGuardado && (
        <div className={`gp-banner ${g.conflicto ? "conflicto" : ""}`} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{g.errorGuardado}</span>
          {g.conflicto && (
            <button type="button" className="btn secundario sm" onClick={() => void g.recargar()}>
              <RefreshCw size={14} aria-hidden="true" /> Cargar la versión actual
            </button>
          )}
        </div>
      )}

      {g.errorCarga ? (
        <EstadoVacio
          icono={<AlertTriangle size={22} />}
          titulo="No se pudo abrir el pedido"
          texto={g.errorCarga}
          accion={
            <button type="button" className="btn secundario sm" onClick={() => void g.recargar()}>
              Reintentar
            </button>
          }
        />
      ) : !cargado ? (
        <EsqueletoPedido />
      ) : (
        <>
          {panel("resumen", () => <ResumenPedido g={g} soloLectura={soloLectura} onIr={irA} />)}
          {panel("productos", () => <ProductosPedido g={g} soloLectura={soloLectura} />)}
          {panel("entrega", () => <EntregaPedido g={g} soloLectura={soloLectura} />)}
          {panel("historial", () => (
            <HistorialPedido eventos={g.eventos} error={g.errorEventos} onReintentar={() => void g.cargarEventos()} />
          ))}
        </>
      )}
    </Modal>
  );
}

function EsqueletoPedido() {
  return (
    <div className="gp-esqueleto-pedido" aria-busy="true" aria-label="Cargando pedido">
      <div className="gp-kpis">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="gp-kpi">
            <Esqueleto ancho="45%" alto={11} />
            <Esqueleto ancho="70%" alto={24} />
            <Esqueleto ancho="55%" alto={11} />
          </div>
        ))}
      </div>
      <div className="gp-resumen-cuerpo">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="gp-superficie" style={{ display: "grid", gap: 12 }}>
            <Esqueleto ancho="35%" alto={14} />
            <Esqueleto />
            <Esqueleto ancho="80%" />
            <Esqueleto ancho="60%" />
          </div>
        ))}
      </div>
    </div>
  );
}
