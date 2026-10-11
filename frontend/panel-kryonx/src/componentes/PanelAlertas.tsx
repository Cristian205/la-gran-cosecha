/**
 * Lo que hay que mirar hoy.
 *
 * Es lo contrario de un feed: si esta lista está vacía, la plataforma está
 * bien y la pantalla lo dice claramente en vez de quedarse en blanco. Cada
 * línea lleva a la empresa concreta, porque una alerta sin destino obliga a
 * buscarla a mano y deja de usarse.
 */
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Alerta } from "../datos/derivados";
import { EstadoVacio } from "../ui/basicos";

export function PanelAlertas({
  alertas,
  cuantas = 5,
}: {
  alertas: Alerta[];
  cuantas?: number;
}) {
  if (alertas.length === 0) {
    return (
      <EstadoVacio icono={CheckCircle2} titulo="Nada requiere atención">
        Ninguna empresa está suspendida, sin plan ni cerca de sus límites.
      </EstadoVacio>
    );
  }

  return (
    <ul className="alertas">
      {alertas.slice(0, cuantas).map((alerta) => (
        <li key={alerta.id}>
          <Link to={`/empresas/${alerta.negocioId}`} className={`alerta alerta--${alerta.nivel}`}>
            <span className="alerta__icono" aria-hidden="true">
              <AlertTriangle size={15} />
            </span>
            <span className="alerta__texto">
              <strong>{alerta.titulo}</strong>
              <span className="tenue">
                {alerta.negocio} · {alerta.detalle}
              </span>
            </span>
            <ChevronRight size={15} className="alerta__flecha" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
