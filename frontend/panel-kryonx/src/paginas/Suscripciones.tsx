/**
 * La operación de los contratos.
 *
 * La tabla de empresas responde "quién es este cliente"; esta responde "qué
 * vence y qué hay que cobrar". Son dos trabajos distintos y por eso está
 * ordenada por fecha de término: lo que se acaba primero, arriba.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usarPlataforma } from "../datos/plataforma";
import {
  ETIQUETA_SUSCRIPCION,
  metricas,
  type Tono,
} from "../datos/derivados";
import { diasHasta, fechaCorta, moneda, numero, relativo } from "../datos/formato";
import type { EstadoSuscripcion } from "../api/tipos";
import { Aviso, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { EstadoSuscripcionInsignia } from "../componentes/piezas";

const ESTADOS: EstadoSuscripcion[] = ["ACTIVA", "PRUEBA", "VENCIDA", "CANCELADA"];

/** Cuándo una renovación deja de ser una fecha y pasa a ser una tarea. */
const HORIZONTE = 30;

export function Suscripciones() {
  const { negocios, planes, suscripciones, cargando, error } = usarPlataforma();
  const [estado, setEstado] = useState<EstadoSuscripcion | "">("");

  const cifras = useMemo(
    () => metricas(negocios, planes, suscripciones),
    [negocios, planes, suscripciones]
  );

  const filas = useMemo(() => {
    const porId = new Map(planes.map((p) => [p.id, p]));
    return suscripciones
      .filter((s) => !estado || s.estado === estado)
      .map((suscripcion) => ({
        suscripcion,
        plan: porId.get(suscripcion.plan) ?? null,
        dias: diasHasta(suscripcion.fecha_fin),
      }))
      // Sin fecha de término no hay nada que vigilar: al final.
      .sort((a, b) => (a.dias ?? 99_999) - (b.dias ?? 99_999));
  }, [suscripciones, planes, estado]);

  const porRenovar = suscripciones.filter((s) => {
    const dias = diasHasta(s.fecha_fin);
    return dias !== null && dias >= 0 && dias <= HORIZONTE;
  }).length;
  const vencidas = suscripciones.filter((s) => s.estado === "VENCIDA").length;

  if (cargando) {
    return (
      <div className="marco-tabla">
        <div className="esqueleto-tabla">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="esqueleto-tabla__fila">
              <Esqueleto alto={12} ancho="30%" />
              <Esqueleto alto={12} ancho="16%" />
              <Esqueleto alto={12} ancho="16%" />
              <Esqueleto alto={12} ancho="12%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Suscripciones</h1>
          <p className="tenue">
            Qué plan tiene cada empresa contratado, desde cuándo y hasta cuándo.
          </p>
        </div>
        <dl className="resumen-linea">
          <div>
            <dt>MRR</dt>
            <dd>{moneda(cifras.mrr, cifras.moneda)}</dd>
          </div>
          <div>
            <dt>Renuevan en {HORIZONTE} días</dt>
            <dd className={porRenovar ? "es-aviso" : undefined}>{numero(porRenovar)}</dd>
          </div>
          <div>
            <dt>Vencidas</dt>
            <dd className={vencidas ? "es-malo" : undefined}>{numero(vencidas)}</dd>
          </div>
        </dl>
      </header>

      {error && <Aviso>{error}</Aviso>}

      <div className="filtros">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoSuscripcion | "")}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_SUSCRIPCION[e]}
            </option>
          ))}
        </select>
        <span className="filtros__cuenta">
          {numero(filas.length)} de {numero(suscripciones.length)}
        </span>
      </div>

      {filas.length === 0 ? (
        <EstadoVacio titulo="Ninguna suscripción">
          Se crea una en cuanto se asigna un plan a una empresa.
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th>Estado</th>
                <th className="num">Importe</th>
                <th>Inicio</th>
                <th>Término</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ suscripcion, plan, dias }) => (
                <tr key={suscripcion.id}>
                  <td>
                    <Link to={`/empresas/${suscripcion.tenant}/suscripcion`} className="empresa__nombre">
                      {suscripcion.negocio}
                    </Link>
                  </td>
                  <td>{suscripcion.plan_nombre}</td>
                  <td>
                    <EstadoSuscripcionInsignia estado={suscripcion.estado} />
                  </td>
                  <td className="num">
                    {plan && Number(plan.precio_mensual) > 0 ? (
                      `${moneda(plan.precio_mensual, plan.moneda)}/mes`
                    ) : (
                      <span className="tenue">gratis</span>
                    )}
                  </td>
                  <td>{fechaCorta(suscripcion.fecha_inicio)}</td>
                  <td>
                    {suscripcion.fecha_fin ? (
                      <span className="termino">
                        <Insignia tono={tonoRenovacion(dias)}>
                          {relativo(suscripcion.fecha_fin)}
                        </Insignia>
                        <span className="tenue">{fechaCorta(suscripcion.fecha_fin)}</span>
                      </span>
                    ) : (
                      <span className="tenue">sin vencimiento</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function tonoRenovacion(dias: number | null): Tono {
  if (dias === null) return "neutro";
  if (dias < 0) return "malo";
  if (dias <= 7) return "malo";
  if (dias <= HORIZONTE) return "aviso";
  return "neutro";
}
