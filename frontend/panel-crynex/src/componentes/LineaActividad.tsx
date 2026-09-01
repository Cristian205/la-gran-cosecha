/**
 * La línea de tiempo.
 *
 * Acepta la forma que tendrá el registro de auditoría cuando exista —momento,
 * qué pasó, a quién y quién lo hizo—, y hoy la alimenta lo único que el backend
 * guarda con fecha: el alta de una empresa y el inicio de su suscripción. El
 * pie lo dice; no se disfraza de auditoría completa.
 */
import { Building2, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import type { Evento } from "../datos/derivados";
import { fechaCorta, relativo } from "../datos/formato";
import { EstadoVacio } from "../ui/basicos";

const ICONO = { alta: Building2, suscripcion: Receipt } as const;

export function LineaActividad({
  eventos,
  conEmpresa = true,
}: {
  eventos: Evento[];
  conEmpresa?: boolean;
}) {
  if (eventos.length === 0) {
    return (
      <EstadoVacio titulo="Sin actividad registrada">
        No hay altas ni suscripciones con fecha todavía.
      </EstadoVacio>
    );
  }

  return (
    <ol className="linea">
      {eventos.map((evento) => {
        const Icono = ICONO[evento.tipo];
        return (
          <li key={evento.id} className="linea__punto">
            <span className="linea__icono" aria-hidden="true">
              <Icono size={13} />
            </span>
            <div className="linea__cuerpo">
              <p className="linea__titulo">
                {evento.titulo}
                {conEmpresa && (
                  <>
                    {" · "}
                    <Link to={`/empresas/${evento.negocioId}`}>{evento.negocio}</Link>
                  </>
                )}
              </p>
              <p className="tenue">{evento.detalle}</p>
            </div>
            <time className="linea__fecha" dateTime={evento.fecha} title={fechaCorta(evento.fecha)}>
              {relativo(evento.fecha)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
