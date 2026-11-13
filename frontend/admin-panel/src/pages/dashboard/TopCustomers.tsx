import { ArrowRight, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { CuerpoModulo, EmptyState, Tarjeta } from "./estados";
import { formatoPrecio, iniciales, numero, porcentaje } from "./formato";
import type { ClientesDestacados } from "./tipos";
import { useModulo } from "./useModulo";

/**
 * Los cinco clientes con mayor volumen de compra (pedidos ENTREGADOS) del
 * período, con su participación sobre las ventas. Solo se muestra a quien
 * puede ver clientes: el backend también lo exige.
 */
export function TopCustomers() {
  const { estado, recargar } = useModulo("clientes-destacados", { limite: 5 });
  return (
    <Tarjeta
      titulo="Clientes destacados"
      subtitulo="Mayor volumen de compra del período"
      info="Ordenados por el total de sus pedidos ENTREGADOS en el período. La participación es su parte de las ventas totales."
      className="db-top-clientes"
      actualizando={estado.tipo === "listo" && estado.actualizando}
      accion={
        <Link className="db-enlace" to="/clientes">
          Ver clientes <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      <CuerpoModulo estado={estado} filas={5} error="No pudimos cargar los clientes." onReintentar={recargar}>
        {(d) => <Lista datos={d} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function Lista({ datos }: { datos: ClientesDestacados }) {
  if (datos.clientes.length === 0)
    return <EmptyState icono={Crown} titulo="Sin compras de clientes en el período" />;
  return (
    <ol className="db-top">
      {datos.clientes.map((c, i) => (
        <li key={c.id}>
          <Link to={`/clientes?q=${encodeURIComponent(c.nombre)}`}>
            <span className={`db-avatar ${i === 0 ? "db-avatar--oro" : ""}`} aria-hidden="true">
              {iniciales(c.nombre)}
            </span>
            <span className="db-top-texto">
              <span className="db-top-nombre">{c.nombre}</span>
              <span className="db-tenue">
                {numero(c.pedidos)} {c.pedidos === 1 ? "pedido" : "pedidos"}
              </span>
            </span>
            <span className="db-top-cifras">
              <strong>{formatoPrecio(c.total)}</strong>
              {c.participacion !== null && <span className="db-tenue">{porcentaje(c.participacion)} de ventas</span>}
            </span>
            <span className="db-top-barra" aria-hidden="true">
              <span style={{ transform: `scaleX(${(c.participacion ?? 0) / 100})` }} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
