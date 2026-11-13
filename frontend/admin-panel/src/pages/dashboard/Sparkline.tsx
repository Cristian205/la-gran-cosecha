import { useId } from "react";

/**
 * Minigráfica de tendencia para las tarjetas KPI. SVG a mano, sin Recharts:
 * son cuatro líneas de 24–366 puntos que no necesitan ejes ni tooltips, y así
 * no montan cuatro instancias de una librería de gráficas.
 *
 * Los `null` (cubetas sin base, p. ej. ticket sin pedidos) cortan la línea en
 * vez de inventar un cero.
 */
export function Sparkline({ valores, tono = "verde" }: { valores: (number | null)[]; tono?: "verde" | "azul" | "ambar" }) {
  const id = useId();
  const definidos = valores.filter((v): v is number => v !== null);
  if (valores.length < 2 || definidos.filter((v) => v > 0).length < 2) return <div className="db-spark db-spark--vacia" aria-hidden="true" />;

  const ancho = 120;
  const alto = 36;
  const max = Math.max(...definidos);
  const min = Math.min(0, ...definidos);
  const rango = max - min || 1;
  const x = (i: number) => (i / (valores.length - 1)) * ancho;
  const y = (v: number) => alto - 3 - ((v - min) / rango) * (alto - 6);

  // Tramos continuos (un null corta la línea).
  const tramos: [number, number][][] = [];
  valores.forEach((v, i) => {
    if (v === null) return;
    const anterior = valores[i - 1];
    if (i === 0 || anterior === null || anterior === undefined) tramos.push([]);
    tramos[tramos.length - 1].push([x(i), y(v)]);
  });
  const linea = tramos.map((t) => t.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")).join("");
  const areas = tramos
    .filter((t) => t.length > 1)
    .map((t) => `M${t[0][0]},${alto}` + t.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join("") + `L${t[t.length - 1][0]},${alto}Z`)
    .join("");

  return (
    <svg className={`db-spark db-spark--${tono}`} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areas} fill={`url(#${id})`} />
      <path d={linea} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
