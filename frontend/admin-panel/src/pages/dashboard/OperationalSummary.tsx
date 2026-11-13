import { ArrowRight, CheckCircle2, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { CuerpoModulo, ESTADOS_PEDIDO, InfoTip, Tarjeta } from "./estados";
import { numero, porcentaje } from "./formato";
import type { ResumenOperativo } from "./tipos";
import { useModulo } from "./useModulo";
import type { EstadoPedido } from "../../types";

/**
 * Actividad operativa, en dos partes que no se mezclan:
 *
 * - Del PERÍODO: cuántos pedidos entraron, cómo se reparten por estado y qué
 *   porcentaje ya se entregó (cumplimiento).
 * - De HOY, sin importar el período: el trabajo abierto —un pendiente de ayer
 *   sigue siendo trabajo de hoy— y lo entregado hoy.
 *
 * Los estados son los del modelo, en el orden en que un pedido los recorre.
 * No existe «en preparación»: no se inventa.
 */
const ORDEN: EstadoPedido[] = ["PENDIENTE", "EDITADO", "CERRADO", "IMPRESO", "ENTREGADO"];
const ABIERTOS = ["PENDIENTE", "EDITADO", "CERRADO", "IMPRESO"] as const;

export function OperationalSummary({ puedeVerPedidos }: { puedeVerPedidos: boolean }) {
  const { estado, recargar } = useModulo("operacion");
  return (
    <Tarjeta
      titulo="Actividad operativa"
      subtitulo="Estado de los pedidos del período y trabajo abierto"
      className="db-operacion"
      actualizando={estado.tipo === "listo" && estado.actualizando}
      accion={
        puedeVerPedidos ? (
          <Link className="db-enlace" to="/pedidos">
            Ir a pedidos <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      <CuerpoModulo estado={estado} filas={6} error="No pudimos cargar la operación." onReintentar={recargar}>
        {(d) => <Contenido datos={d} puedeVerPedidos={puedeVerPedidos} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function Contenido({ datos, puedeVerPedidos }: { datos: ResumenOperativo; puedeVerPedidos: boolean }) {
  const { desde, hasta } = datos.periodo;
  const abiertos = ABIERTOS.reduce((s, e) => s + datos.abiertos[e], 0);
  const cumplimiento = datos.cumplimiento;

  return (
    <div className="db-op">
      <div className="db-op-periodo">
        <div className="db-op-cabeza">
          <div>
            <p className="db-op-etiqueta">Pedidos recibidos</p>
            <p className="db-op-total">{numero(datos.recibidos)}</p>
          </div>
          <div
            className="db-anillo"
            style={{ "--avance": `${cumplimiento ?? 0}` } as React.CSSProperties}
            role="img"
            aria-label={cumplimiento === null ? "Sin pedidos en el período" : `Cumplimiento ${porcentaje(cumplimiento)}`}
          >
            <span>
              <strong>{cumplimiento === null ? "—" : porcentaje(cumplimiento, 0)}</strong>
              cumplimiento
            </span>
          </div>
        </div>

        {datos.recibidos > 0 && (
          <div className="db-op-barra" aria-hidden="true">
            {ORDEN.map((e) =>
              datos.por_estado[e] ? (
                <span key={e} className={`db-tono-${ESTADOS_PEDIDO[e].tono}`} style={{ flexGrow: datos.por_estado[e] }} />
              ) : null
            )}
          </div>
        )}

        <ul className="db-op-lista">
          {ORDEN.map((e) => {
            const n = datos.por_estado[e];
            const fila = (
              <>
                <span className={`db-punto db-tono-${ESTADOS_PEDIDO[e].tono}`} aria-hidden="true" />
                <span className="db-op-nombre">{ESTADOS_PEDIDO[e].etiqueta}s</span>
                <span className="db-op-pct">{datos.recibidos ? porcentaje((n / datos.recibidos) * 100, 0) : ""}</span>
                <span className="db-op-n">{numero(n)}</span>
              </>
            );
            return (
              <li key={e} className={n ? "" : "db-cero"}>
                {puedeVerPedidos && n ? (
                  <Link to={`/pedidos?estado=${e}&desde=${desde}&hasta=${hasta}`}>{fila}</Link>
                ) : (
                  <div>{fila}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="db-op-hoy">
        <h3>
          Hoy
          <InfoTip texto="No depende del período elegido: cuenta todos los pedidos que todavía esperan a alguien, sean del día que sean." />
        </h3>
        {abiertos === 0 ? (
          <p className="db-op-aldia">
            <CheckCircle2 size={16} aria-hidden="true" /> Todo al día: no hay pedidos por atender.
          </p>
        ) : (
          <p className="db-op-abiertos">
            <strong>{numero(abiertos)}</strong> {abiertos === 1 ? "pedido por atender" : "pedidos por atender"}
            <span className="db-tenue">
              {ABIERTOS.filter((e) => datos.abiertos[e])
                .map((e) => `${datos.abiertos[e]} ${ESTADOS_PEDIDO[e].etiqueta.toLowerCase()}${datos.abiertos[e] === 1 ? "" : "s"}`)
                .join(" · ")}
            </span>
          </p>
        )}
        <p className="db-op-entregados">
          <PackageCheck size={16} aria-hidden="true" />
          Entregados hoy <strong>{numero(datos.entregados_hoy)}</strong>
        </p>
      </div>
    </div>
  );
}
