/**
 * Consumo frente a límite.
 *
 * Una barra y dos números. El color no decora: solo aparece cuando el consumo
 * pasa del 75%, porque si todo estuviera coloreado el rojo del que va al 95%
 * no destacaría. Y cuando la API no reporta el consumo, la barra no se dibuja
 * medio llena por estética: se dice que no hay medición.
 */
import { nivelDe, razonDe, type Indicador } from "../datos/derivados";
import { numero, tamano } from "../datos/formato";

function valor(n: number | null, indicador: Indicador): string {
  if (n === null) return "—";
  return indicador.unidad === "mb" ? tamano(n) : numero(n);
}

export function IndicadorUso({
  indicador,
  compacto = false,
}: {
  indicador: Indicador;
  compacto?: boolean;
}) {
  const razon = razonDe(indicador);
  const nivel = nivelDe(indicador);
  const sinMedicion = indicador.sinDato || indicador.usado === null;

  return (
    <div className={`uso ${compacto ? "uso--compacto" : ""}`}>
      <div className="uso__linea">
        <span className="uso__etiqueta">{indicador.etiqueta}</span>
        <span className="uso__cifra">
          {sinMedicion ? (
            <span className="tenue">sin medición</span>
          ) : (
            <>
              <strong>{valor(indicador.usado, indicador)}</strong>
              <span className="tenue">
                {" / "}
                {indicador.limite === null
                  ? "sin límite"
                  : valor(indicador.limite, indicador)}
              </span>
            </>
          )}
        </span>
      </div>
      <div
        className={`barra barra--${nivel} ${sinMedicion ? "barra--vacia" : ""}`}
        role="progressbar"
        aria-label={indicador.etiqueta}
        aria-valuenow={razon === null ? undefined : Math.round(razon * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${(razon ?? 0) * 100}%` }} />
      </div>
    </div>
  );
}

/** La versión de una celda de tabla: solo la barra y el porcentaje. */
export function UsoEnLinea({ indicador }: { indicador: Indicador }) {
  const razon = razonDe(indicador);
  if (razon === null) return <span className="tenue">—</span>;
  return (
    <span className="uso-linea" title={`${indicador.usado} de ${indicador.limite}`}>
      <span className={`barra barra--${nivelDe(indicador)}`}>
        <span style={{ width: `${razon * 100}%` }} />
      </span>
      <span className="uso-linea__cifra">{Math.round(razon * 100)}%</span>
    </span>
  );
}
