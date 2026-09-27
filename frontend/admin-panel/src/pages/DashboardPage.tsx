import { ClipboardList, Receipt, UserPlus, Wallet } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { formatoPrecio, tienePermiso } from "../utils";
import { ChartCard } from "./dashboard/ChartCard";
import { CustomerSummary } from "./dashboard/CustomerSummary";
import { ErrorState, ESTADOS_PEDIDO, LoadingState } from "./dashboard/estados";
import { ExportMenu } from "./dashboard/ExportMenu";
import { comparar, compararConteo, KpiCard } from "./dashboard/KpiCard";
import { OperationalSummary } from "./dashboard/OperationalSummary";
import { OrdersTable } from "./dashboard/OrdersTable";
import { PeriodSelector } from "./dashboard/PeriodSelector";
import { ProductRanking } from "./dashboard/ProductRanking";
import { etiquetaComparacion, rangoDesdePreset, saludo, type Preset, type Rango } from "./dashboard/periodo";
import { usePanel } from "./dashboard/usePanel";
import { OrderDetailModal } from "./orders/OrderDetailModal";
import "./dashboard/dashboard.css";

/**
 * El centro de control de la operación.
 *
 * Arriba lo que se mira primero (cuánto se vende, cuántos pedidos, ticket y
 * clientes nuevos, cada uno contra el período anterior); después ventas y
 * operación lado a lado, y más abajo lo que pide acción: los pedidos que
 * acaban de entrar, lo que más se pide y quién está comprando.
 *
 * Todo sale de UNA petición por período (`/admin/stats/panel/`, ver
 * `dashboard/usePanel.ts`) calculada en el backend.
 */
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const numero = (n: number) => Math.round(n).toLocaleString("es-CO");

/** "jueves, 24 de septiembre…" → "Jueves, 24 de septiembre…" (no "De Septiembre"). */
const mayusculaInicial = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function DashboardPage() {
  const { usuario } = useAuth();
  const [preset, setPreset] = useState<Preset>("30d");
  const [rango, setRango] = useState<Rango>(() => rangoDesdePreset("30d"));
  const { estado, recargar } = usePanel(rango);
  const [pedidoAbierto, setPedidoAbierto] = useState<number | null>(null);

  const puedeVerPedidos = tienePermiso(usuario ?? null, "orders.view_pedido");
  const puedeVerClientes = tienePermiso(usuario ?? null, "orders.view_cliente");
  const nombre = usuario?.nombre_usuario?.trim().split(/\s+/)[0];
  const contra = etiquetaComparacion(preset);
  const datos = estado.tipo === "listo" ? estado.datos : null;

  return (
    <div className="db">
      <header className="db-cabecera">
        <div>
          <h1>
            {saludo()}
            {nombre ? `, ${nombre}` : ""}
          </h1>
          <p>
            Resumen de tu operación · {mayusculaInicial(FECHA_LARGA.format(new Date()))}
          </p>
        </div>
        <div className="db-cabecera-acciones">
          <PeriodSelector
            preset={preset}
            rango={rango}
            onCambiar={(p, r) => {
              setPreset(p);
              setRango(r);
            }}
          />
          <ExportMenu rango={rango} />
        </div>
      </header>

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
            <ErrorState mensaje={estado.mensaje} onReintentar={recargar} />
          </div>
        )}
        {datos && (
          <>
            <KpiCard
              indice={0}
              etiqueta="Ventas"
              icono={Wallet}
              valor={datos.ventas.total}
              formatear={formatoPrecio}
              detalle={datos.ventas.total === 0 ? "Sin ventas en el período" : undefined}
              comparacion={comparar(datos.ventas.total, datos.ventas.anterior, contra, {
                formatear: formatoPrecio,
                sinDatos: "Sin ventas en el período anterior",
              })}
            />
            <KpiCard
              indice={1}
              etiqueta="Pedidos"
              icono={ClipboardList}
              valor={datos.pedidos.total}
              formatear={numero}
              detalle={<DesglosePedidos porEstado={datos.pedidos.por_estado} />}
              href={puedeVerPedidos ? "/pedidos" : undefined}
              hrefTexto="Ver pedidos"
            />
            <KpiCard
              indice={2}
              etiqueta="Ticket promedio"
              icono={Receipt}
              valor={datos.ticket.promedio}
              formatear={formatoPrecio}
              sinValor="—"
              detalle={
                datos.ticket.entregados === 0
                  ? "Sin pedidos entregados"
                  : `${datos.ticket.entregados} ${datos.ticket.entregados === 1 ? "pedido entregado" : "pedidos entregados"}`
              }
              comparacion={
                datos.ticket.promedio !== null && datos.ticket.anterior !== null
                  ? comparar(datos.ticket.promedio, datos.ticket.anterior, contra, {
                      formatear: formatoPrecio,
                      sinDatos: "",
                    })
                  : undefined
              }
            />
            <KpiCard
              indice={3}
              etiqueta="Clientes nuevos"
              icono={UserPlus}
              valor={datos.clientes.nuevos}
              formatear={numero}
              comparacion={compararConteo(
                datos.clientes.nuevos,
                datos.clientes.nuevos_anterior,
                contra,
                "Sin registros nuevos en ninguno de los dos períodos"
              )}
            />
          </>
        )}
      </section>

      <div className="db-fila db-fila--ventas">
        <ChartCard estado={estado} contra={contra} onReintentar={recargar} />
        <OperationalSummary estado={estado} onReintentar={recargar} puedeVerPedidos={puedeVerPedidos} />
      </div>

      <div className="db-fila db-fila--detalle">
        <OrdersTable
          estado={estado}
          onReintentar={recargar}
          onVer={setPedidoAbierto}
          puedeVerPedidos={puedeVerPedidos}
        />
        <ProductRanking estado={estado} onReintentar={recargar} />
      </div>

      <CustomerSummary estado={estado} onReintentar={recargar} puedeVerClientes={puedeVerClientes} />

      {pedidoAbierto !== null && (
        <OrderDetailModal
          pedidoId={pedidoAbierto}
          soloLectura={!tienePermiso(usuario ?? null, "orders.change_pedido")}
          onCerrar={() => setPedidoAbierto(null)}
          onGuardado={() => {
            setPedidoAbierto(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}

/** "3 pendientes · 1 editado": lo que aún no se entrega, sin inventar estados. */
function DesglosePedidos({ porEstado }: { porEstado: Record<string, number | undefined> }) {
  const partes = (["PENDIENTE", "EDITADO", "CERRADO", "IMPRESO", "ENTREGADO"] as const)
    .filter((e) => porEstado[e])
    .map((e) => {
      const n = porEstado[e]!;
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
