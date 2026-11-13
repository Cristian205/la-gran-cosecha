import { ArrowRight, CalendarCheck, CalendarDays, ClipboardCheck, LineChart as IconoGrafica, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../theme/ThemeContext";
import { CuerpoModulo, EmptyState, Tarjeta } from "./estados";
import { formatoPrecio, numero, precioCompacto, variacion } from "./formato";
import { useValorAnimado } from "./KpiCard";
import { aFecha, etiquetaDeCubeta, etiquetaDeEje, NOMBRE_GRANO, referenciaAnterior } from "./periodo";
import type { AnalisisVentas, Granularidad } from "./tipos";
import { useModulo } from "./useModulo";
import { VariacionChip } from "./Variacion";

/**
 * Análisis de ventas: la evolución del período (y la del anterior, punteada,
 * en las mismas cubetas) con tres métricas a elegir, y debajo los indicadores
 * que la complementan.
 *
 * La métrica es un filtro PROPIO del módulo (no de fecha): cambiarla no pide
 * nada al servidor, porque la serie ya trae las tres.
 */
type Metrica = "ventas" | "pedidos" | "ticket";

const METRICAS: { valor: Metrica; etiqueta: string; formatear: (n: number) => string; eje: (n: number) => string }[] = [
  { valor: "ventas", etiqueta: "Ventas", formatear: formatoPrecio, eje: precioCompacto },
  { valor: "pedidos", etiqueta: "Pedidos", formatear: numero, eje: numero },
  { valor: "ticket", etiqueta: "Ticket promedio", formatear: formatoPrecio, eje: precioCompacto },
];

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });

export function SalesOverviewChart({ puedeVerPedidos }: { puedeVerPedidos: boolean }) {
  const { estado, recargar } = useModulo("ventas");
  const [metrica, setMetrica] = useState<Metrica>("ventas");

  const selector = (
    <div className="db-segmentado db-segmentado--sm" role="radiogroup" aria-label="Métrica de la gráfica">
      {METRICAS.map((m) => (
        <button
          key={m.valor}
          type="button"
          role="radio"
          aria-checked={metrica === m.valor}
          className={metrica === m.valor ? "activo" : ""}
          onClick={() => setMetrica(m.valor)}
        >
          {m.etiqueta}
        </button>
      ))}
    </div>
  );

  const datos = estado.tipo === "listo" ? estado.datos : null;

  return (
    <Tarjeta
      titulo="Análisis de ventas"
      subtitulo={datos ? `Pedidos entregados, ${NOMBRE_GRANO[datos.periodo.granularidad]}` : "Evolución del período"}
      info="Solo cuentan los pedidos ENTREGADOS, por la fecha en que se hicieron. La línea punteada es el período anterior de igual duración, alineado cubeta a cubeta."
      accion={selector}
      className="db-ventas"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      <CuerpoModulo estado={estado} filas={7} error="No pudimos cargar las ventas." onReintentar={recargar}>
        {(d) => <Contenido datos={d} metrica={metrica} puedeVerPedidos={puedeVerPedidos} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function Contenido({ datos, metrica, puedeVerPedidos }: { datos: AnalisisVentas; metrica: Metrica; puedeVerPedidos: boolean }) {
  const { tema } = useTheme();
  const oscuro = tema === "oscuro";
  const colores = oscuro
    ? { eje: "#8b95a7", grid: "#232b3a", actual: "#34d399", anterior: "#64748b", punto: "#121826" }
    : { eje: "#64748b", grid: "#e8edf3", actual: "#15803d", anterior: "#94a3b8", punto: "#ffffff" };
  const def = METRICAS.find((m) => m.valor === metrica)!;
  const g = datos.periodo.granularidad;
  const comparando = datos.anterior !== null;

  const puntos = useMemo(
    () =>
      datos.serie.map((p) => ({
        inicio: p.inicio,
        eje: etiquetaDeEje(p.inicio, g),
        actual: p[metrica],
        anterior: p.anterior ? p.anterior[metrica] : undefined,
        pedidos: p.pedidos,
        pedidosAnterior: p.anterior?.pedidos,
      })),
    [datos, metrica, g]
  );
  const conDatos = datos.serie.filter((p) => p.pedidos > 0).length;
  const total = datos.totales[metrica];
  const animado = useValorAnimado(total ?? 0);
  const ref = referenciaAnterior(datos.periodo);

  const ind = datos.indicadores;
  const cuerpo =
    conDatos === 0 ? (
      <EmptyState
        icono={IconoGrafica}
        titulo="Aún no hay ventas en este período"
        texto="Cuando se entreguen pedidos del período, aquí verás cómo evolucionan tus ventas."
      />
    ) : (
      <div
        className="db-grafica"
        role="img"
        aria-label={`${def.etiqueta} ${NOMBRE_GRANO[g]} del período${comparando ? ", comparadas con el período anterior" : ""}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="db-area-ventas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colores.actual} stopOpacity={0.2} />
                <stop offset="100%" stopColor={colores.actual} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={colores.grid} />
            <XAxis
              dataKey="eje"
              tick={{ fontSize: 11, fill: colores.eje }}
              axisLine={false}
              tickLine={false}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => def.eje(v)}
              width={metrica === "pedidos" ? 36 : 64}
              tick={{ fontSize: 11, fill: colores.eje }}
              axisLine={false}
              tickLine={false}
              allowDecimals={metrica !== "pedidos"}
            />
            <Tooltip
              content={<Globo granularidad={g} formatear={def.formatear} metrica={metrica} comparando={comparando} />}
              cursor={{ stroke: colores.eje, strokeDasharray: "3 3" }}
            />
            {comparando && (
              <Line
                type="monotone"
                dataKey="anterior"
                stroke={colores.anterior}
                strokeWidth={1.6}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive
                animationDuration={500}
                name="Período anterior"
              />
            )}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={colores.actual}
              strokeWidth={2.2}
              fill="url(#db-area-ventas)"
              dot={puntos.length <= 12 ? { r: 2.5, strokeWidth: 0, fill: colores.actual } : false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: colores.punto }}
              connectNulls={false}
              animationDuration={500}
              name="Período actual"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );

  return (
    <>
      <div className="db-ventas-resumen">
        <div>
          <p className="db-ventas-etiqueta">{def.etiqueta} del período</p>
          <p className="db-ventas-total">{total === null ? "—" : def.formatear(animado)}</p>
        </div>
        <VariacionChip
          variacion={variacion(total, datos.anterior ? datos.anterior[metrica] : undefined, def.formatear)}
          referencia={ref}
        />
        {comparando && conDatos > 0 && (
          <ul className="db-leyenda" aria-hidden="true">
            <li>
              <span className="db-leyenda-linea db-leyenda-linea--actual" /> Período actual
            </li>
            <li>
              <span className="db-leyenda-linea db-leyenda-linea--anterior" /> Período anterior
            </li>
          </ul>
        )}
      </div>

      {cuerpo}

      <dl className="db-ventas-indicadores">
        <Indicador
          icono={CalendarCheck}
          titulo="Día de mayor facturación"
          valor={ind.dia_mayor_facturacion ? formatoPrecio(ind.dia_mayor_facturacion.ventas) : "—"}
          pie={
            ind.dia_mayor_facturacion
              ? capital(FECHA_LARGA.format(aFecha(ind.dia_mayor_facturacion.fecha)))
              : "Sin ventas en el período"
          }
        />
        <Indicador
          icono={CalendarDays}
          titulo="Mejor día de ventas"
          valor={ind.mejor_dia_semana ? capital(ind.mejor_dia_semana.dia) : "—"}
          pie={ind.mejor_dia_semana ? `${formatoPrecio(ind.mejor_dia_semana.promedio)} en promedio` : "Sin ventas en el período"}
          info="El día de la semana con mayor venta PROMEDIO en el período (no el que más veces aparece)."
        />
        <Indicador
          icono={TrendingUp}
          titulo="Promedio diario"
          valor={formatoPrecio(ind.promedio_diario)}
          pie={`Sobre ${ind.dias_transcurridos} ${ind.dias_transcurridos === 1 ? "día transcurrido" : "días transcurridos"}`}
        />
        <Indicador
          icono={ClipboardCheck}
          titulo="Pedidos entregados"
          valor={numero(datos.totales.pedidos)}
          pie={datos.anterior ? `${numero(datos.anterior.pedidos)} en el período anterior` : "En el período"}
        />
      </dl>

      {puedeVerPedidos && (
        <div className="db-tarjeta-pie">
          <Link className="db-enlace" to={`/pedidos?estado=ENTREGADO&desde=${datos.periodo.desde}&hasta=${datos.periodo.hasta}`}>
            Ver detalle de ventas <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </>
  );
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Indicador({
  icono: Icono,
  titulo,
  valor,
  pie,
  info,
}: {
  icono: typeof CalendarCheck;
  titulo: string;
  valor: string;
  pie: string;
  info?: string;
}) {
  return (
    <div className="db-indicador" title={info}>
      <dt>
        <Icono size={14} aria-hidden="true" />
        {titulo}
      </dt>
      <dd>{valor}</dd>
      <p>{pie}</p>
    </div>
  );
}

// Recharts inyecta `active` y `payload` al clonar el contenido del tooltip.
function Globo({
  active,
  payload,
  granularidad,
  formatear,
  metrica,
  comparando,
}: {
  active?: boolean;
  payload?: { payload: unknown }[];
  granularidad: Granularidad;
  formatear: (n: number) => string;
  metrica: Metrica;
  comparando: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as {
    inicio: string;
    actual: number | null;
    anterior?: number | null;
    pedidos: number;
    pedidosAnterior?: number;
  };
  const v = comparando ? variacion(p.actual, p.anterior ?? null, formatear) : null;
  return (
    <div className="db-globo">
      <p className="db-globo-fecha">{etiquetaDeCubeta(p.inicio, granularidad)}</p>
      <p className="db-globo-valor">{p.actual === null ? "Sin pedidos entregados" : formatear(p.actual)}</p>
      {metrica !== "pedidos" && (
        <p className="db-globo-sub">
          {p.pedidos} {p.pedidos === 1 ? "pedido entregado" : "pedidos entregados"}
        </p>
      )}
      {comparando && (
        <p className="db-globo-ant">
          Anterior: {p.anterior === null || p.anterior === undefined ? "—" : formatear(p.anterior)}
          {v && v.tipo !== "neutra" && v.porcentaje && (
            <span className={`db-globo-var db-globo-var--${v.tipo}`}>
              {v.tipo === "baja" ? "−" : v.tipo === "sube" ? "+" : ""}
              {v.porcentaje}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
