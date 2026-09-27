import { LineChart as IconoGrafica } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../../theme/ThemeContext";
import { formatoPrecio } from "../../utils";
import { EmptyState, ErrorState, LoadingState, Tarjeta } from "./estados";
import { comparar, useValorAnimado, type Comparacion } from "./KpiCard";
import type { EstadoPanel } from "./usePanel";
import { etiquetaDeCubeta, fechaCorta } from "./periodo";

/**
 * Rendimiento de ventas: el total del período arriba y su evolución debajo.
 *
 * Con menos de dos puntos con ventas no se dibuja nada: una línea plana
 * ocupando media pantalla no dice nada y parece un error. En su lugar se
 * explica qué falta. Por hora (un solo día) van barras —las horas son
 * cubetas separadas, no una curva—; por día o semana, un área.
 */
const COMPACTO = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 1,
});

const NOMBRE_GRANO = { hora: "por hora", dia: "por día", semana: "por semana" } as const;
const CUBETA = { hora: "hora", dia: "día", semana: "semana" } as const;

export function ChartCard({
  estado,
  contra,
  onReintentar,
}: {
  estado: EstadoPanel;
  contra: string;
  onReintentar: () => void;
}) {
  const { tema } = useTheme();
  const colores = tema === "oscuro"
    ? { eje: "#94a3b8", grid: "#2a3556", linea: "#22c55e" }
    : { eje: "#64748b", grid: "#e8edf3", linea: "#15803d" };

  const datos = estado.tipo === "listo" ? estado.datos : null;
  const puntos = useMemo(
    () =>
      datos?.serie.map((c) => ({
        ...c,
        etiqueta: etiquetaDeCubeta(c.inicio, datos.granularidad),
        eje:
          datos.granularidad === "hora"
            ? c.inicio.slice(11, 13)
            : fechaCorta(c.inicio),
      })) ?? [],
    [datos]
  );
  const conVentas = puntos.filter((p) => p.total > 0).length;
  const total = useValorAnimado(datos?.ventas.total ?? 0);

  let cuerpo;
  if (estado.tipo === "cargando") cuerpo = <LoadingState filas={5} alto={14} />;
  else if (estado.tipo === "error")
    cuerpo = <ErrorState mensaje="No pudimos cargar las ventas." onReintentar={onReintentar} />;
  else if (conVentas < 2)
    cuerpo = (
      <EmptyState
        icono={IconoGrafica}
        titulo={conVentas === 0 ? "Aún no hay ventas en este período" : "Aún no hay suficientes ventas"}
        texto={
          conVentas === 0
            ? "Cuando se entreguen pedidos del período, aquí verás cómo evolucionan tus ventas."
            : `Las ventas del período cayeron en una sola ${CUBETA[datos!.granularidad]}. Con más ventas podrás ver aquí la evolución de tu negocio.`
        }
      />
    );
  else
    cuerpo = (
      <div className="db-grafica" role="img" aria-label={`Ventas ${NOMBRE_GRANO[datos!.granularidad]} del período`}>
        <ResponsiveContainer width="100%" height="100%">
          {datos!.granularidad === "hora" ? (
            <BarChart data={puntos} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colores.grid} />
              <XAxis dataKey="eje" tick={{ fontSize: 11, fill: colores.eje }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tickFormatter={(v) => COMPACTO.format(v)} width={64} tick={{ fontSize: 11, fill: colores.eje }} axisLine={false} tickLine={false} />
              <Tooltip content={<Globo />} cursor={{ fill: colores.grid, opacity: 0.5 }} />
              <Bar dataKey="total" fill={colores.linea} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          ) : (
            <AreaChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="db-degradado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colores.linea} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={colores.linea} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colores.grid} />
              <XAxis dataKey="eje" tick={{ fontSize: 11, fill: colores.eje }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={(v) => COMPACTO.format(v)} width={64} tick={{ fontSize: 11, fill: colores.eje }} axisLine={false} tickLine={false} />
              <Tooltip content={<Globo />} cursor={{ stroke: colores.eje, strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="total"
                stroke={colores.linea}
                strokeWidth={2.2}
                fill="url(#db-degradado)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--superficie)" }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );

  const comparacion: Comparacion | null = datos
    ? comparar(datos.ventas.total, datos.ventas.anterior, contra, {
        formatear: formatoPrecio,
        sinDatos: "Sin ventas en este ni en el período anterior",
      })
    : null;

  return (
    <Tarjeta
      titulo="Rendimiento de ventas"
      subtitulo={datos ? `Pedidos entregados, ${NOMBRE_GRANO[datos.granularidad]}` : undefined}
      className="db-ventas"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      {datos && (
        <div className="db-ventas-resumen">
          <p className="db-ventas-total">{formatoPrecio(total)}</p>
          {comparacion &&
            (comparacion.tipo === "neutra" ? (
              <p className="db-tendencia db-tendencia--neutra">{comparacion.texto}</p>
            ) : (
              <p className={`db-tendencia db-tendencia--${comparacion.tipo}`}>
                <span className="db-tendencia-chip">{comparacion.tipo === "baja" ? "↓" : comparacion.tipo === "sube" ? "↑" : "="} {comparacion.valor}</span>
                <span>{comparacion.contra}</span>
              </p>
            ))}
        </div>
      )}
      {cuerpo}
    </Tarjeta>
  );
}

// Recharts inyecta `active` y `payload` al clonar el contenido del tooltip.
function Globo({ active, payload }: { active?: boolean; payload?: { payload: unknown }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { etiqueta: string; total: number; pedidos: number };
  return (
    <div className="db-globo">
      <p className="db-globo-fecha">{p.etiqueta}</p>
      <p className="db-globo-valor">{formatoPrecio(p.total)}</p>
      <p className="db-globo-sub">
        {p.pedidos} {p.pedidos === 1 ? "pedido entregado" : "pedidos entregados"}
      </p>
    </div>
  );
}
