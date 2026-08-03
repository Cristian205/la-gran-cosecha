import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  FileSpreadsheet,
  Grid3x3,
  Layers,
  Receipt,
  Sheet,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { obtenerEstadisticas, obtenerReporteVentas } from "../api/resources";
import { useTheme } from "../theme/ThemeContext";
import type { Estadisticas, ReporteVentas } from "../types";
import { formatoFecha, formatoPrecio } from "../utils";
import { descargarInforme, type ColumnaInforme } from "../reportesExcel";

const COLOR_MARCA = "#15803d";

// Paleta con suficientes tonos distinguibles entre sí para que ninguna categoría
// se confunda con otra (antes se elegía por hash del nombre, lo que producía
// colisiones: p.ej. "Frutas" y "Salsamentaria" caían en el mismo color).
const PALETA_CATEGORIA = [
  "#059669",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#0d9488",
  "#65a30d",
  "#e11d48",
  "#0284c7",
  "#a855f7",
];

/** Asigna un color único por categoría (orden alfabético estable) para que nunca se repita entre sí. */
function coloresPorCategoria(nombres: string[]): Map<string, string> {
  const unicos = [...new Set(nombres)].sort((a, b) => a.localeCompare(b));
  return new Map(unicos.map((nombre, i) => [nombre, PALETA_CATEGORIA[i % PALETA_CATEGORIA.length]]));
}

type Preset = "hoy" | "7d" | "30d" | "mes" | "personalizado";

function iso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function rangoDesdePreset(preset: Exclude<Preset, "personalizado">): {
  desde: string;
  hasta: string;
} {
  const hoy = new Date();
  const hasta = iso(hoy);
  if (preset === "hoy") return { desde: hasta, hasta };
  if (preset === "7d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 6);
    return { desde: iso(d), hasta };
  }
  if (preset === "mes") {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: iso(d), hasta };
  }
  const d = new Date(hoy);
  d.setDate(d.getDate() - 29);
  return { desde: iso(d), hasta };
}

const OPCIONES_PRESET: { valor: Preset; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "7d", etiqueta: "7 días" },
  { valor: "30d", etiqueta: "30 días" },
  { valor: "mes", etiqueta: "Este mes" },
];

interface DefinicionInforme {
  clave: string;
  etiqueta: string;
  icono: typeof FileSpreadsheet;
  disponible: boolean;
  generar: () => { titulo: string; subtitulo?: string; columnas: ColumnaInforme[]; filas: Record<string, unknown>[]; totales?: boolean; nombreArchivo: string };
}

export function DashboardPage() {
  const { tema } = useTheme();
  const colorEje = tema === "oscuro" ? "#94a3b8" : "#64748b";
  const colorGrid = tema === "oscuro" ? "#2a3556" : "#e2e8f0";

  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<Preset>("30d");
  const [rango, setRango] = useState(() => rangoDesdePreset("30d"));
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(true);
  const [menuInformesAbierto, setMenuInformesAbierto] = useState(false);
  const [generandoClave, setGenerandoClave] = useState<string | null>(null);
  const menuInformesRef = useRef<HTMLDivElement>(null);

  const coloresCategoria = useMemo(
    () =>
      coloresPorCategoria([
        ...(stats?.productos_por_categoria.map((c) => c.categoria) ?? []),
        ...(reporte?.ventas_por_categoria.map((c) => c.categoria) ?? []),
      ]),
    [stats, reporte]
  );

  useEffect(() => {
    obtenerEstadisticas()
      .then(setStats)
      .catch(() => setError("No se pudieron cargar las estadísticas."));
  }, []);

  useEffect(() => {
    setCargandoReporte(true);
    obtenerReporteVentas(rango)
      .then(setReporte)
      .catch(() => setError("No se pudo cargar el reporte de ventas."))
      .finally(() => setCargandoReporte(false));
  }, [rango]);

  function elegirPreset(p: Preset) {
    setPreset(p);
    if (p !== "personalizado") setRango(rangoDesdePreset(p));
  }

  const datosVentasPorDia = useMemo(() => {
    if (!reporte) return [];
    return reporte.ventas_por_dia.labels.map((label, i) => ({
      dia: label,
      total: reporte.ventas_por_dia.data[i],
    }));
  }, [reporte]);

  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      if (menuInformesRef.current && !menuInformesRef.current.contains(e.target as Node)) {
        setMenuInformesAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, []);

  const informes: DefinicionInforme[] = useMemo(() => {
    const hoy = new Date().toLocaleDateString("es-CO");
    const subtituloPeriodo = reporte ? `Periodo: ${rango.desde} a ${rango.hasta}` : undefined;

    return [
      {
        clave: "resumen",
        etiqueta: "Resumen general",
        icono: Sheet,
        disponible: !!stats,
        generar: () => ({
          titulo: "Resumen general — La Gran Cosecha",
          subtitulo: `Generado el ${hoy}`,
          columnas: [
            { clave: "metrica", etiqueta: "Métrica", tipo: "texto", ancho: 28 },
            { clave: "valor", etiqueta: "Valor", tipo: "texto", ancho: 22 },
          ],
          filas: stats
            ? [
                { metrica: "Ventas del mes", valor: formatoPrecio(stats.ventas_mes) },
                { metrica: "Crecimiento mensual", valor: `${stats.crecimiento_mensual}%` },
                { metrica: "Caja de hoy", valor: formatoPrecio(stats.caja_hoy) },
                { metrica: "Eficiencia", valor: `${stats.eficiencia}%` },
                { metrica: "Pedidos pendientes", valor: stats.pedidos_pendientes },
                { metrica: "Total clientes", valor: stats.total_clientes },
                { metrica: "Total productos", valor: stats.total_productos },
                { metrica: "Total categorías", valor: stats.total_categorias },
                { metrica: "Usuarios activos", valor: stats.total_usuarios },
                { metrica: "Ventas del año", valor: formatoPrecio(stats.ventas_anio) },
                { metrica: "Meta anual", valor: `${stats.progreso_meta}%` },
              ]
            : [],
          nombreArchivo: `resumen_general_${iso(new Date())}`,
        }),
      },
      {
        clave: "ventas_periodo",
        etiqueta: "Ventas del periodo",
        icono: Receipt,
        disponible: !!reporte && reporte.pedidos.length > 0,
        generar: () => ({
          titulo: "Ventas del periodo",
          subtitulo: subtituloPeriodo,
          columnas: [
            { clave: "id", etiqueta: "N° Pedido", tipo: "texto" },
            { clave: "fecha", etiqueta: "Fecha", tipo: "texto" },
            { clave: "cliente", etiqueta: "Cliente", tipo: "texto" },
            { clave: "estado", etiqueta: "Estado", tipo: "texto" },
            { clave: "num_items", etiqueta: "Items", tipo: "numero" },
            { clave: "total", etiqueta: "Total", tipo: "moneda" },
          ],
          filas: (reporte?.pedidos ?? []).map((p) => ({
            id: `#${p.id}`,
            fecha: formatoFecha(p.fecha),
            cliente: p.cliente || "—",
            estado: p.estado,
            num_items: p.num_items,
            total: Number(p.total) || 0,
          })),
          totales: true,
          nombreArchivo: `ventas_periodo_${rango.desde}_a_${rango.hasta}`,
        }),
      },
      {
        clave: "ventas_por_dia",
        etiqueta: "Ventas por día",
        icono: CalendarDays,
        disponible: !!reporte && reporte.ventas_por_dia.labels.length > 0,
        generar: () => ({
          titulo: "Ventas por día",
          subtitulo: subtituloPeriodo,
          columnas: [
            { clave: "dia", etiqueta: "Día", tipo: "texto" },
            { clave: "total", etiqueta: "Total vendido", tipo: "moneda" },
          ],
          filas: (reporte?.ventas_por_dia.labels ?? []).map((label, i) => ({
            dia: label,
            total: reporte?.ventas_por_dia.data[i] || 0,
          })),
          totales: true,
          nombreArchivo: `ventas_por_dia_${rango.desde}_a_${rango.hasta}`,
        }),
      },
      {
        clave: "ventas_por_categoria",
        etiqueta: "Ventas por categoría",
        icono: Layers,
        disponible: !!reporte && reporte.ventas_por_categoria.length > 0,
        generar: () => {
          const filas = reporte?.ventas_por_categoria ?? [];
          const sumaTotal = filas.reduce((acc, c) => acc + c.total, 0);
          return {
            titulo: "Ventas por categoría",
            subtitulo: subtituloPeriodo,
            columnas: [
              { clave: "categoria", etiqueta: "Categoría", tipo: "texto" },
              { clave: "total", etiqueta: "Total vendido", tipo: "moneda" },
              { clave: "participacion", etiqueta: "% del total", tipo: "porcentaje" },
            ],
            filas: filas.map((c) => ({
              categoria: c.categoria,
              total: c.total,
              participacion: sumaTotal ? Number(((c.total / sumaTotal) * 100).toFixed(1)) : 0,
            })),
            totales: true,
            nombreArchivo: `ventas_por_categoria_${rango.desde}_a_${rango.hasta}`,
          };
        },
      },
      {
        clave: "top_productos",
        etiqueta: "Top productos",
        icono: Trophy,
        disponible: !!reporte && reporte.top_productos.length > 0,
        generar: () => ({
          titulo: "Top productos vendidos",
          subtitulo: subtituloPeriodo,
          columnas: [
            { clave: "nombre", etiqueta: "Producto", tipo: "texto" },
            { clave: "cantidad", etiqueta: "Cantidad vendida", tipo: "numero" },
            { clave: "total", etiqueta: "Total vendido", tipo: "moneda" },
          ],
          filas: (reporte?.top_productos ?? []).map((p) => ({
            nombre: p.nombre,
            cantidad: p.cantidad,
            total: p.total,
          })),
          totales: true,
          nombreArchivo: `top_productos_${rango.desde}_a_${rango.hasta}`,
        }),
      },
      {
        clave: "productos_por_categoria",
        etiqueta: "Productos por categoría",
        icono: Grid3x3,
        disponible: !!stats && stats.productos_por_categoria.length > 0,
        generar: () => ({
          titulo: "Productos por categoría (catálogo actual)",
          subtitulo: `Generado el ${hoy}`,
          columnas: [
            { clave: "categoria", etiqueta: "Categoría", tipo: "texto" },
            { clave: "total", etiqueta: "Cantidad de productos", tipo: "numero" },
          ],
          filas: stats?.productos_por_categoria ?? [],
          totales: true,
          nombreArchivo: `productos_por_categoria_${iso(new Date())}`,
        }),
      },
    ];
  }, [stats, reporte, rango]);

  async function descargar(informe: DefinicionInforme) {
    setGenerandoClave(informe.clave);
    try {
      await descargarInforme(informe.generar());
      setMenuInformesAbierto(false);
    } finally {
      setGenerandoClave(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Dashboard</h1>
      </div>

      <div className="contenido">
        {error && <div className="error-box">{error}</div>}

        {!stats ? (
          <>
            <div className="hero-metrica">
              <div style={{ width: "100%" }}>
                <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: "140px", height: "12px" }} />
                <div
                  className="skeleton-line skeleton-shimmer en-celda"
                  style={{ width: "220px", height: "34px", marginTop: "10px" }}
                />
              </div>
            </div>
            <div className="stat-fila-grid">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="stat-fila" key={i}>
                  <div className="skeleton-line skeleton-shimmer en-celda" style={{ width: "70%", height: "10px" }} />
                  <div
                    className="skeleton-line skeleton-shimmer en-celda"
                    style={{ width: "50%", height: "20px", marginTop: "8px" }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="hero-metrica">
              <div>
                <div className="label">Ventas del mes</div>
                <div className="valor">{formatoPrecio(stats.ventas_mes)}</div>
              </div>
              <div className="pie tendencia">
                {stats.crecimiento_mensual >= 0 ? (
                  <TrendingUp size={15} className="sube" />
                ) : (
                  <TrendingDown size={15} className="baja" />
                )}
                <span className={stats.crecimiento_mensual >= 0 ? "sube" : "baja"}>
                  {stats.crecimiento_mensual >= 0 ? "+" : ""}
                  {stats.crecimiento_mensual}%
                </span>
                vs. mes anterior
              </div>
            </div>

            <div className="stat-fila-grid">
              <div className="stat-fila">
                <div className="label">Caja de hoy</div>
                <div className="valor">{formatoPrecio(stats.caja_hoy)}</div>
                <div className="pie">Eficiencia: {stats.eficiencia}%</div>
              </div>
              <div className="stat-fila">
                <div className="label">Pedidos pendientes</div>
                <div className="valor">{stats.pedidos_pendientes}</div>
                <div className="pie">{stats.total_clientes} clientes totales</div>
              </div>
              <div className="stat-fila">
                <div className="label">Productos</div>
                <div className="valor">{stats.total_productos}</div>
                <div className="pie">{stats.total_categorias} categorías</div>
              </div>
              <div className="stat-fila">
                <div className="label">Usuarios activos</div>
                <div className="valor">{stats.total_usuarios}</div>
                <div className="pie">Con acceso al panel</div>
              </div>
              <div className="stat-fila">
                <div className="label">Meta anual</div>
                <div className="valor">{stats.progreso_meta}%</div>
                <div className="pie">{formatoPrecio(stats.ventas_anio)} vendidos este año</div>
              </div>
            </div>

            <div className="panel">
              <div className="cabecera">
                <h2>Reporte de ventas</h2>
              </div>

              <div className="filtros-bar">
                <div className="segmentado">
                  {OPCIONES_PRESET.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      className={preset === o.valor ? "activo" : ""}
                      onClick={() => elegirPreset(o.valor)}
                    >
                      {o.etiqueta}
                    </button>
                  ))}
                </div>

                <div className="rango-fechas">
                  <CalendarRange size={16} />
                  <input
                    type="date"
                    value={rango.desde}
                    max={rango.hasta}
                    onChange={(e) => {
                      setPreset("personalizado");
                      setRango((r) => ({ ...r, desde: e.target.value }));
                    }}
                  />
                  <span>—</span>
                  <input
                    type="date"
                    value={rango.hasta}
                    min={rango.desde}
                    onChange={(e) => {
                      setPreset("personalizado");
                      setRango((r) => ({ ...r, hasta: e.target.value }));
                    }}
                  />
                </div>

                <div style={{ position: "relative" }} ref={menuInformesRef}>
                  <button
                    type="button"
                    className="btn primario sm"
                    onClick={() => setMenuInformesAbierto((v) => !v)}
                  >
                    <FileSpreadsheet size={15} /> Exportar informes
                    <ChevronDown size={14} className={menuInformesAbierto ? "chevron abierto" : "chevron"} />
                  </button>

                  {menuInformesAbierto && (
                    <div className="menu-usuario menu-informes">
                      {informes.map((inf) => {
                        const Icono = inf.icono;
                        const generando = generandoClave === inf.clave;
                        return (
                          <button
                            key={inf.clave}
                            type="button"
                            disabled={!inf.disponible || generando}
                            onClick={() => descargar(inf)}
                          >
                            <Icono size={16} />
                            {generando ? "Generando…" : inf.etiqueta}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {cargandoReporte || !reporte ? (
                <div className="vacio">Cargando reporte…</div>
              ) : (
                <>
                  <div className="grafico-grande">
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={datosVentasPorDia}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLOR_MARCA} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={COLOR_MARCA} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colorGrid} />
                        <XAxis
                          dataKey="dia"
                          tick={{ fontSize: 11, fill: colorEje }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => formatoPrecio(v)}
                          width={90}
                          tick={{ fontSize: 11, fill: colorEje }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip formatter={(v) => formatoPrecio(Number(v))} />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke={COLOR_MARCA}
                          strokeWidth={2.5}
                          fill="url(#gradVentas)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="stat-fila-grid" style={{ margin: "0 1.2rem 1.2rem" }}>
                    <div className="stat-fila">
                      <div className="label">Ventas del periodo</div>
                      <div className="valor">{formatoPrecio(reporte.total_ventas)}</div>
                    </div>
                    <div className="stat-fila">
                      <div className="label">Pedidos entregados</div>
                      <div className="valor">{reporte.total_pedidos}</div>
                    </div>
                    <div className="stat-fila">
                      <div className="label">Ticket promedio</div>
                      <div className="valor">{formatoPrecio(reporte.ticket_promedio)}</div>
                    </div>
                    <div className="stat-fila">
                      <div className="label">Unidades vendidas</div>
                      <div className="valor">{reporte.total_unidades_vendidas}</div>
                    </div>
                    <div className="stat-fila">
                      <div className="label">Clientes nuevos</div>
                      <div className="valor">{reporte.clientes_nuevos}</div>
                    </div>
                  </div>

                  <div className="dos-col" style={{ padding: "0 1.2rem 1.2rem" }}>
                    <div className="grafico-card">
                      <h3>Ventas por categoría</h3>
                      {reporte.ventas_por_categoria.length === 0 ? (
                        <div className="vacio">Sin ventas en el periodo</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={reporte.ventas_por_categoria}
                              dataKey="total"
                              nameKey="categoria"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={2}
                            >
                              {reporte.ventas_por_categoria.map((c) => (
                                <Cell key={c.categoria} fill={coloresCategoria.get(c.categoria) ?? PALETA_CATEGORIA[0]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(v) => formatoPrecio(Number(v))} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <div className="grafico-card">
                      <h3>Top productos vendidos</h3>
                      {reporte.top_productos.length === 0 ? (
                        <div className="vacio">Sin ventas en el periodo</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart
                            data={reporte.top_productos.slice(0, 6)}
                            layout="vertical"
                            margin={{ left: 10, right: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={colorGrid} />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 11, fill: colorEje }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="nombre"
                              width={110}
                              tick={{ fontSize: 11, fill: colorEje }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip formatter={(v) => formatoPrecio(Number(v))} />
                            <Bar dataKey="total" fill="#2563eb" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="dos-col">
              <div className="panel">
                <div className="cabecera">
                  <h2>Últimos pedidos</h2>
                </div>
                <div className="tabla-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th>Items</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.ultimos_pedidos.map((p) => (
                        <tr key={p.id}>
                          <td>#{p.id}</td>
                          <td>{p.cliente || "—"}</td>
                          <td>
                            <span className={`badge ${p.estado}`}>{p.estado}</span>
                          </td>
                          <td>{p.num_items}</td>
                          <td>{formatoPrecio(p.total)}</td>
                        </tr>
                      ))}
                      {stats.ultimos_pedidos.length === 0 && (
                        <tr>
                          <td colSpan={5} className="vacio">
                            Sin pedidos aún
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grafico-card">
                <h3>Productos por categoría</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.productos_por_categoria}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colorGrid} />
                    <XAxis
                      dataKey="categoria"
                      tick={{ fontSize: 10, fill: colorEje }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: colorEje }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {stats.productos_por_categoria.map((c) => (
                        <Cell key={c.categoria} fill={coloresCategoria.get(c.categoria) ?? PALETA_CATEGORIA[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
