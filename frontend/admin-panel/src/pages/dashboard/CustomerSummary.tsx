import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { formatoPrecio } from "../../utils";
import { EmptyState, ErrorState, LoadingState, Tarjeta } from "./estados";
import type { EstadoPanel } from "./usePanel";

/**
 * Clientes del período: cuántos pidieron, cuántos son nuevos y cuántos
 * volvieron (ya habían pedido antes). Al lado, quiénes movieron más.
 */
function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function CustomerSummary({
  estado,
  onReintentar,
  puedeVerClientes,
}: {
  estado: EstadoPanel;
  onReintentar: () => void;
  puedeVerClientes: boolean;
}) {
  const accion = puedeVerClientes ? (
    <Link className="db-enlace" to="/clientes">
      Ver clientes <ArrowRight size={14} aria-hidden="true" />
    </Link>
  ) : undefined;

  let cuerpo;
  if (estado.tipo === "cargando") cuerpo = <LoadingState filas={4} />;
  else if (estado.tipo === "error")
    cuerpo = <ErrorState mensaje="No pudimos cargar los clientes." onReintentar={onReintentar} />;
  else {
    const c = estado.datos.clientes;
    cuerpo = (
      <div className="db-clientes">
        <dl className="db-clientes-cifras">
          <div>
            <dt>Clientes activos</dt>
            <dd>{c.activos}</dd>
            <p>Hicieron al menos un pedido</p>
          </div>
          <div>
            <dt>Nuevos</dt>
            <dd>{c.nuevos}</dd>
            <p>Registrados en el período</p>
          </div>
          <div>
            <dt>Volvieron a pedir</dt>
            <dd>{c.recurrentes}</dd>
            <p>
              {c.activos > 0
                ? `${Math.round((c.recurrentes / c.activos) * 100)} % de los activos`
                : "Ya habían pedido antes"}
            </p>
          </div>
        </dl>

        <div className="db-clientes-top">
          <h3>Mayor actividad</h3>
          {c.top.length === 0 ? (
            <EmptyState icono={Users} titulo="Sin pedidos de clientes en el período" />
          ) : (
            <ol>
              {c.top.map((t) => {
                const contenido = (
                  <>
                    <span className="db-avatar" aria-hidden="true">
                      {iniciales(t.nombre)}
                    </span>
                    <span className="db-clientes-nombre">{t.nombre}</span>
                    <span className="db-tenue">
                      {t.pedidos} {t.pedidos === 1 ? "pedido" : "pedidos"}
                    </span>
                    <span className="db-fuerte">{formatoPrecio(t.total)}</span>
                  </>
                );
                return (
                  <li key={t.id}>
                    {puedeVerClientes ? (
                      <Link to={`/clientes?q=${encodeURIComponent(t.nombre)}`}>{contenido}</Link>
                    ) : (
                      <div>{contenido}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    );
  }

  return (
    <Tarjeta
      titulo="Clientes"
      accion={accion}
      className="db-clientes-tarjeta"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      {cuerpo}
    </Tarjeta>
  );
}
