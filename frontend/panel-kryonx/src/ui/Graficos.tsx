/**
 * Gráficas mínimas.
 *
 * Pocas y sobrias: una línea suave, barras y una barra segmentada. Sin rejilla,
 * sin leyendas que repitan lo que ya dicen las etiquetas y con un solo color
 * —el de la marca— salvo cuando el color es un estado. Son SVG y HTML a mano
 * porque cuatro gráficas no justifican una librería de cien kilobytes, y así
 * consumen los mismos tokens que el resto de la interfaz.
 */
import { useId, type ReactNode } from "react";
import type { Tono } from "../datos/derivados";

interface Punto {
  etiqueta: string;
  valor: number;
}

/** Curva que pasa por todos los puntos sin pasarse de ellos (monótona). */
function trazo(xs: number[], ys: number[]): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return `M${xs[0]},${ys[0]}`;
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const medio = (xs[i] + xs[i + 1]) / 2;
    d += ` C${medio},${ys[i]} ${medio},${ys[i + 1]} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

function escala(puntos: Punto[], ancho: number, alto: number, margen = 4) {
  const max = Math.max(1, ...puntos.map((p) => p.valor));
  const paso = puntos.length > 1 ? (ancho - margen * 2) / (puntos.length - 1) : 0;
  const xs = puntos.map((_, i) => margen + i * paso);
  const ys = puntos.map((p) => alto - margen - (p.valor / max) * (alto - margen * 2));
  return { xs, ys, max };
}

/** Línea con área, para una evolución en el tiempo. */
export function GraficoArea({
  puntos,
  alto = 140,
  formato = (n: number) => String(n),
  etiqueta,
}: {
  puntos: Punto[];
  alto?: number;
  formato?: (n: number) => string;
  etiqueta: string;
}) {
  const id = useId();
  const ancho = 520;
  const { xs, ys } = escala(puntos, ancho, alto, 8);
  const linea = trazo(xs, ys);
  const area = `${linea} L${xs[xs.length - 1]},${alto} L${xs[0]},${alto} Z`;
  const ultimo = puntos.length - 1;

  return (
    <figure className="grafico" aria-label={etiqueta}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="grafico__lienzo" role="img">
        <title>{`${etiqueta}: ${puntos.map((p) => `${p.etiqueta} ${formato(p.valor)}`).join(", ")}`}</title>
        <defs>
          <linearGradient id={`${id}-relleno`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}-relleno)`} className="grafico__area" />
        <path d={linea} className="grafico__linea" pathLength={1} />
      </svg>
      {ultimo >= 0 && (
        <span
          className="grafico__punto"
          style={{ left: `${(xs[ultimo] / ancho) * 100}%`, top: `${(ys[ultimo] / alto) * 100}%` }}
          aria-hidden="true"
        />
      )}
      <figcaption className="grafico__ejes">
        {puntos.map((p, i) => (
          <span key={`${p.etiqueta}${i}`} className={i === ultimo ? "es-ultimo" : undefined}>
            {p.etiqueta}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Una tendencia en miniatura dentro de una KPI. */
export function Sparkline({ valores }: { valores: number[] }) {
  const ancho = 96;
  const alto = 28;
  const { xs, ys } = escala(
    valores.map((valor, i) => ({ etiqueta: String(i), valor })),
    ancho,
    alto,
    3
  );
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="sparkline" aria-hidden="true">
      <path d={trazo(xs, ys)} className="grafico__linea" pathLength={1} />
    </svg>
  );
}

/** Barras horizontales: comparar pocas categorías. */
export function BarrasHorizontales({
  filas,
  formato = (n: number) => String(n),
}: {
  filas: { etiqueta: string; valor: number; detalle?: ReactNode }[];
  formato?: (n: number) => string;
}) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="barras">
      {filas.map((fila, i) => (
        <li key={fila.etiqueta} className="barras__fila">
          <div className="barras__textos">
            <span className="barras__etiqueta">{fila.etiqueta}</span>
            {fila.detalle && <span className="barras__detalle">{fila.detalle}</span>}
            <span className="barras__valor">{formato(fila.valor)}</span>
          </div>
          <span className="barras__pista">
            <span
              className="barras__relleno"
              style={{ width: `${(fila.valor / max) * 100}%`, animationDelay: `${i * 70}ms` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Un total repartido en estados, con su leyenda. */
export function BarraSegmentada({
  partes,
}: {
  partes: { etiqueta: string; valor: number; tono: Tono }[];
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  return (
    <div className="segmentos">
      <div className="segmentos__barra" role="img" aria-label={partes.map((p) => `${p.etiqueta}: ${p.valor}`).join(", ")}>
        {total === 0 ? (
          <span className="segmentos__parte segmentos__parte--neutro" style={{ flex: 1 }} />
        ) : (
          partes
            .filter((p) => p.valor > 0)
            .map((p) => (
              <span
                key={p.etiqueta}
                className={`segmentos__parte segmentos__parte--${p.tono}`}
                style={{ flex: p.valor }}
              />
            ))
        )}
      </div>
      <ul className="segmentos__leyenda">
        {partes.map((p) => (
          <li key={p.etiqueta}>
            <i className={`punto-estado punto-estado--${p.tono}`} />
            {p.etiqueta}
            <strong>{p.valor}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
