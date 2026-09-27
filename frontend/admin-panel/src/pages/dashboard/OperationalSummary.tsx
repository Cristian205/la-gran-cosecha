import { ArrowRight, CheckCircle2, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, ESTADOS_PEDIDO, LoadingState, Tarjeta } from "./estados";
import type { EstadoPanel } from "./usePanel";

/**
 * Operación de hoy: lo que está esperando a alguien, por estado.
 *
 * No depende del período elegido: un pedido pendiente de ayer sigue siendo
 * trabajo de hoy. Los estados son los del modelo —Pendiente, Editado,
 * Cerrado, Impreso— en el orden en que un pedido suele recorrerlos, y la
 * barra muestra de un vistazo dónde se está acumulando.
 */
const ORDEN = ["PENDIENTE", "EDITADO", "CERRADO", "IMPRESO"] as const;

export function OperationalSummary({
  estado,
  onReintentar,
  puedeVerPedidos,
}: {
  estado: EstadoPanel;
  onReintentar: () => void;
  puedeVerPedidos: boolean;
}) {
  const enlace = puedeVerPedidos ? (
    <Link className="db-enlace" to="/pedidos">
      Ver todos los pedidos <ArrowRight size={14} aria-hidden="true" />
    </Link>
  ) : null;

  if (estado.tipo !== "listo")
    return (
      <Tarjeta titulo="Operación de hoy" className="db-operacion">
        {estado.tipo === "cargando" ? (
          <LoadingState filas={5} />
        ) : (
          <ErrorState mensaje="No pudimos cargar la operación." onReintentar={onReintentar} />
        )}
      </Tarjeta>
    );

  const { abiertos, entregados_hoy } = estado.datos.operacion;
  const total = ORDEN.reduce((s, e) => s + (abiertos[e] ?? 0), 0);

  return (
    <Tarjeta
      titulo="Operación de hoy"
      subtitulo={total === 0 ? "Sin pedidos por atender" : `${total} ${total === 1 ? "pedido por atender" : "pedidos por atender"}`}
      className="db-operacion"
      actualizando={estado.actualizando}
    >
      {total === 0 ? (
        <EmptyState icono={CheckCircle2} titulo="Todo al día" texto="No hay pedidos esperando a nadie." />
      ) : (
        <>
          <div className="db-operacion-barra" aria-hidden="true">
            {ORDEN.map((e) =>
              abiertos[e] ? (
                <span
                  key={e}
                  className={`db-tono-${ESTADOS_PEDIDO[e].tono}`}
                  style={{ flexGrow: abiertos[e] }}
                />
              ) : null
            )}
          </div>
          <ul className="db-operacion-lista">
            {ORDEN.map((e) => (
              <li key={e} className={abiertos[e] ? "" : "db-cero"}>
                <span className={`db-punto db-tono-${ESTADOS_PEDIDO[e].tono}`} aria-hidden="true" />
                <span className="db-operacion-nombre">{ESTADOS_PEDIDO[e].etiqueta}s</span>
                <span className="db-operacion-n">{abiertos[e] ?? 0}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="db-operacion-hoy">
        <span className="db-operacion-hoy-icono" aria-hidden="true">
          <PackageCheck size={16} />
        </span>
        <span className="db-operacion-nombre">Entregados hoy</span>
        <span className="db-operacion-n">{entregados_hoy}</span>
      </div>
      {enlace && <div className="db-tarjeta-pie">{enlace}</div>}
    </Tarjeta>
  );
}
