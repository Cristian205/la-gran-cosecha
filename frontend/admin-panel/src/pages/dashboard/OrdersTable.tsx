import { ArrowRight, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { formatoPrecio } from "../../utils";
import { EmptyState, ErrorState, LoadingState, StatusBadge, Tarjeta } from "./estados";
import { fechaCorta, fechaLocal } from "./periodo";
import type { EstadoPanel } from "./usePanel";

/**
 * Los últimos pedidos, sin importar el período: es "qué acaba de entrar".
 * "Ver" abre el mismo detalle que la página de Pedidos, sin salir de aquí.
 */
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

/** ["Hoy" | "Ayer" | "13 sept", "1:45 p. m."], en la fecha LOCAL del pedido. */
function cuando(iso: string): [string, string] {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const mismo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const dia = mismo(fecha, hoy)
    ? "Hoy"
    : mismo(fecha, ayer)
      ? "Ayer"
      : fechaCorta(fechaLocal(fecha));
  return [dia, HORA.format(fecha)];
}

export function OrdersTable({
  estado,
  onReintentar,
  onVer,
  puedeVerPedidos,
}: {
  estado: EstadoPanel;
  onReintentar: () => void;
  onVer: (id: number) => void;
  puedeVerPedidos: boolean;
}) {
  const accion = puedeVerPedidos ? (
    <Link className="db-enlace" to="/pedidos">
      Ver todos <ArrowRight size={14} aria-hidden="true" />
    </Link>
  ) : undefined;

  let cuerpo;
  if (estado.tipo === "cargando") cuerpo = <LoadingState filas={6} />;
  else if (estado.tipo === "error")
    cuerpo = <ErrorState mensaje="No pudimos cargar los pedidos." onReintentar={onReintentar} />;
  else if (estado.datos.recientes.length === 0)
    cuerpo = <EmptyState icono={Inbox} titulo="Aún no hay pedidos" texto="Los pedidos nuevos aparecerán aquí apenas entren." />;
  else
    cuerpo = (
      <div className="db-tabla-scroll">
        <table className="db-tabla">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Cliente</th>
              <th scope="col">Estado</th>
              <th scope="col">Fecha</th>
              <th scope="col" className="db-num">Total</th>
              {puedeVerPedidos && (
                <th scope="col" className="db-accion">
                  <span className="db-sr">Acción</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {estado.datos.recientes.map((p) => (
              <tr key={p.id}>
                <td className="db-pedido-id">#{p.id}</td>
                <td className="db-pedido-cliente">
                  {p.cliente || <span className="db-tenue">Sin cliente</span>}
                  <span className="db-pedido-items">
                    {p.num_items} {p.num_items === 1 ? "producto" : "productos"}
                  </span>
                </td>
                <td>
                  <StatusBadge estado={p.estado} />
                </td>
                <td className="db-pedido-fecha">
                  {cuando(p.fecha)[0]}
                  <span className="db-pedido-items">{cuando(p.fecha)[1]}</span>
                </td>
                <td className="db-num db-fuerte">{formatoPrecio(p.total)}</td>
                {puedeVerPedidos && (
                  <td className="db-accion">
                    <button type="button" className="db-boton-fila" onClick={() => onVer(p.id)} aria-label={`Ver el pedido ${p.id}`}>
                      Ver
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <Tarjeta
      titulo="Pedidos recientes"
      accion={accion}
      className="db-recientes"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      {cuerpo}
    </Tarjeta>
  );
}
