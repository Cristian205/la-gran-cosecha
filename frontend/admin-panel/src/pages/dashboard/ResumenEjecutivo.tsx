import { ClipboardList, Receipt, Users, Wallet } from "lucide-react";
import { ErrorState, ESTADOS_PEDIDO, LoadingState } from "./estados";
import { formatoPrecio, numero, variacion } from "./formato";
import { KpiCard } from "./KpiCard";
import { referenciaAnterior } from "./periodo";
import type { Resumen } from "./tipos";
import { datosDe, useModulo } from "./useModulo";
import type { EstadoPedido } from "../../types";

/**
 * Los cuatro KPI: ventas, clientes compradores, pedidos y ticket promedio.
 * Una sola petición (`/admin/analitica/resumen/`), la primera del dashboard.
 */
export function ResumenEjecutivo({ puedeVerPedidos, puedeVerClientes }: { puedeVerPedidos: boolean; puedeVerClientes: boolean }) {
  const { estado, recargar } = useModulo("resumen");
  const datos = datosDe(estado);

  return (
    <section
      className={`db-kpis ${estado.tipo === "listo" && estado.actualizando ? "db-actualizando" : ""}`}
      aria-label="Indicadores principales"
    >
      {estado.tipo === "cargando" &&
        Array.from({ length: 4 }).map((_, i) => (
          <div className="db-kpi" key={i}>
            <LoadingState filas={3} alto={i === 0 ? 14 : 12} />
          </div>
        ))}
      {estado.tipo === "error" && (
        <div className="db-kpis-error">
          <ErrorState mensaje="No pudimos cargar los indicadores." onReintentar={recargar} />
        </div>
      )}
      {datos && <Tarjetas datos={datos} puedeVerPedidos={puedeVerPedidos} puedeVerClientes={puedeVerClientes} />}
    </section>
  );
}

function Tarjetas({ datos, puedeVerPedidos, puedeVerClientes }: { datos: Resumen; puedeVerPedidos: boolean; puedeVerClientes: boolean }) {
  const ref = referenciaAnterior(datos.periodo);
  const ant = datos.anterior;
  const { desde, hasta } = datos.periodo;
  const c = datos.clientes;

  return (
    <>
      <KpiCard
        indice={0}
        etiqueta="Ventas totales"
        icono={Wallet}
        valor={datos.ventas.total}
        formatear={formatoPrecio}
        info="Suma de los pedidos ENTREGADOS del período. Los pedidos pendientes, editados, cerrados o impresos aún no cuentan como venta."
        variacion={variacion(datos.ventas.total, ant?.ventas, formatoPrecio)}
        referencia={ref}
        serie={datos.ventas.serie}
        detalle={`${numero(datos.ventas.entregados)} ${datos.ventas.entregados === 1 ? "pedido entregado" : "pedidos entregados"}`}
        href={puedeVerPedidos ? `/pedidos?estado=ENTREGADO&desde=${desde}&hasta=${hasta}` : undefined}
        hrefTexto="Ver detalle de ventas"
      />
      <KpiCard
        indice={1}
        etiqueta="Clientes activos"
        icono={Users}
        tono="azul"
        valor={c.activos}
        formatear={numero}
        info="Clientes con al menos una compra entregada en el período. Nuevos: su primera compra histórica cae en el período. Recurrentes: ya habían comprado antes."
        variacion={variacion(c.activos, ant?.clientes_activos)}
        referencia={ref}
        serie={c.serie}
        detalle={
          <span className="db-desglose">
            <span className="db-desglose-parte">
              <span className="db-punto db-tono-verde" aria-hidden="true" />
              {numero(c.nuevos)} {c.nuevos === 1 ? "nuevo" : "nuevos"}
            </span>
            <span className="db-desglose-parte">
              <span className="db-punto db-tono-azul" aria-hidden="true" />
              {numero(c.recurrentes)} {c.recurrentes === 1 ? "recurrente" : "recurrentes"}
            </span>
          </span>
        }
        href={puedeVerClientes ? "/clientes" : undefined}
        hrefTexto="Ver clientes"
      />
      <KpiCard
        indice={2}
        etiqueta="Pedidos realizados"
        icono={ClipboardList}
        tono="ambar"
        valor={datos.pedidos.total}
        formatear={numero}
        info="Todos los pedidos creados en el período, en cualquier estado. Su avance se ve en el desglose por estado."
        variacion={variacion(datos.pedidos.total, ant?.pedidos)}
        referencia={ref}
        serie={datos.pedidos.serie}
        detalle={<DesglosePedidos porEstado={datos.pedidos.por_estado} />}
        href={puedeVerPedidos ? `/pedidos?desde=${desde}&hasta=${hasta}` : undefined}
        hrefTexto="Ver pedidos"
      />
      <KpiCard
        indice={3}
        etiqueta="Ticket promedio"
        icono={Receipt}
        valor={datos.ticket.promedio}
        formatear={formatoPrecio}
        info="Ventas del período divididas entre los pedidos entregados. Sin pedidos entregados no hay promedio que calcular."
        variacion={variacion(datos.ticket.promedio, ant ? ant.ticket : undefined, formatoPrecio)}
        referencia={ref}
        serie={datos.ticket.serie}
        detalle={datos.ventas.entregados === 0 ? "Sin pedidos entregados en el período" : "Por pedido entregado"}
      />
    </>
  );
}

/** "3 entregados · 2 pendientes · 1 impreso": los estados reales, sin inventar ninguno. */
const ORDEN_ESTADOS: EstadoPedido[] = ["ENTREGADO", "PENDIENTE", "EDITADO", "CERRADO", "IMPRESO"];

function DesglosePedidos({ porEstado }: { porEstado: Record<EstadoPedido, number> }) {
  const partes = ORDEN_ESTADOS.filter((e) => porEstado[e]).map((e) => {
    const n = porEstado[e];
    const etiqueta = ESTADOS_PEDIDO[e].etiqueta.toLowerCase();
    return (
      <span key={e} className="db-desglose-parte">
        <span className={`db-punto db-tono-${ESTADOS_PEDIDO[e].tono}`} aria-hidden="true" />
        {n} {n === 1 ? etiqueta : `${etiqueta}s`}
      </span>
    );
  });
  return partes.length ? <span className="db-desglose">{partes}</span> : <>Sin pedidos en el período</>;
}
