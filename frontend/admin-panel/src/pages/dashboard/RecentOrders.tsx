import { ArrowRight, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { fechaISO } from "../../utils/fechas";
import { CuerpoModulo, EmptyState, StatusBadge, Tarjeta } from "./estados";
import { formatoPrecio } from "./formato";
import type { ActividadReciente } from "./tipos";
import { useModulo } from "./useModulo";

/**
 * Los últimos pedidos registrados, sin importar el período: es «qué acaba de
 * entrar». «Ver» abre el mismo detalle que la página de Pedidos sin salir de
 * aquí. En pantallas estrechas la tabla pasa a tarjetas compactas (CSS).
 */
function cuando(iso: string): [string, string] {
  const [dia, hora] = fechaISO(iso, true).split(" ");
  return [dia, hora ?? ""];
}

export function RecentOrders({ onVer, version }: { onVer: (id: number) => void; version: number }) {
  // `version` cambia cuando se edita un pedido desde el detalle: se refresca.
  const { estado, recargar } = useModulo("recientes", { limite: 8, v: version }, { sinPeriodo: true });
  return (
    <Tarjeta
      titulo="Actividad reciente"
      subtitulo="Últimos pedidos registrados"
      className="db-recientes"
      actualizando={estado.tipo === "listo" && estado.actualizando}
      accion={
        <Link className="db-enlace" to="/pedidos">
          Ver todos <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      <CuerpoModulo estado={estado} filas={6} error="No pudimos cargar los pedidos." onReintentar={recargar}>
        {(d) => <Tabla datos={d} onVer={onVer} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function Tabla({ datos, onVer }: { datos: ActividadReciente; onVer: (id: number) => void }) {
  if (datos.pedidos.length === 0)
    return <EmptyState icono={Inbox} titulo="Aún no hay pedidos" texto="Los pedidos nuevos aparecerán aquí apenas entren." />;
  return (
    <div className="db-tabla-scroll">
      <table className="db-tabla">
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Cliente</th>
            <th scope="col">Fecha</th>
            <th scope="col">Estado</th>
            <th scope="col" className="db-num">Total</th>
            <th scope="col" className="db-accion">
              <span className="db-sr">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {datos.pedidos.map((p) => {
            const [dia, hora] = cuando(p.fecha);
            return (
              <tr key={p.id}>
                <td className="db-pedido-id" data-col="Pedido">#{p.id}</td>
                <td className="db-pedido-cliente" data-col="Cliente">
                  {p.cliente || <span className="db-tenue">Sin cliente</span>}
                  <span className="db-pedido-items">
                    {p.num_items} {p.num_items === 1 ? "producto" : "productos"}
                  </span>
                </td>
                <td className="db-pedido-fecha" data-col="Fecha">
                  {dia}
                  <span className="db-pedido-items">{hora}</span>
                </td>
                <td data-col="Estado">
                  <StatusBadge estado={p.estado} />
                </td>
                <td className="db-num db-fuerte" data-col="Total">
                  {formatoPrecio(p.total)}
                </td>
                <td className="db-accion">
                  <button type="button" className="db-boton-fila" onClick={() => onVer(p.id)} aria-label={`Ver el pedido ${p.id}`}>
                    Ver
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
