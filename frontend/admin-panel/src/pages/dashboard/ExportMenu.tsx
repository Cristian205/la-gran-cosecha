import { CalendarDays, ChevronDown, Download, Grid3x3, Layers, Receipt, Sheet, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { obtenerEstadisticas, obtenerReporteVentas } from "../../api/resources";
import { descargarInforme, type InformeOpciones } from "../../reportesExcel";
import type { Estadisticas, ReporteVentas } from "../../types";
import { formatoFecha, formatoPrecio } from "../../utils";
import { fechaLocal, type Rango } from "./periodo";

/**
 * Los mismos seis informes de Excel de siempre.
 *
 * Lo que cambia es CUÁNDO se piden los datos: el reporte trae todas las filas
 * de pedidos del rango, y antes se descargaba cada vez que se abría el
 * dashboard o se cambiaba de período —para un Excel que casi nunca se
 * genera—. Ahora se pide al exportar, y el resumen igual.
 */
type Fuente = { stats: Estadisticas; reporte: ReporteVentas };

interface Informe {
  clave: string;
  etiqueta: string;
  icono: typeof Sheet;
  generar: (f: Fuente, rango: Rango) => InformeOpciones | null;
}

const INFORMES: Informe[] = [
  {
    clave: "resumen",
    etiqueta: "Resumen general",
    icono: Sheet,
    generar: ({ stats }) => ({
      titulo: "Resumen general — La Gran Cosecha",
      subtitulo: `Generado el ${new Date().toLocaleDateString("es-CO")}`,
      columnas: [
        { clave: "metrica", etiqueta: "Métrica", tipo: "texto", ancho: 28 },
        { clave: "valor", etiqueta: "Valor", tipo: "texto", ancho: 22 },
      ],
      filas: [
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
      ],
      nombreArchivo: `resumen_general_${fechaLocal(new Date())}`,
    }),
  },
  {
    clave: "ventas_periodo",
    etiqueta: "Ventas del período",
    icono: Receipt,
    generar: ({ reporte }, r) =>
      reporte.pedidos.length === 0
        ? null
        : {
            titulo: "Ventas del periodo",
            subtitulo: `Periodo: ${r.desde} a ${r.hasta}`,
            columnas: [
              { clave: "id", etiqueta: "N° Pedido", tipo: "texto" },
              { clave: "fecha", etiqueta: "Fecha", tipo: "texto" },
              { clave: "cliente", etiqueta: "Cliente", tipo: "texto" },
              { clave: "estado", etiqueta: "Estado", tipo: "texto" },
              { clave: "num_items", etiqueta: "Items", tipo: "numero" },
              { clave: "total", etiqueta: "Total", tipo: "moneda" },
            ],
            filas: reporte.pedidos.map((p) => ({
              id: `#${p.id}`,
              fecha: formatoFecha(p.fecha),
              cliente: p.cliente || "—",
              estado: p.estado,
              num_items: p.num_items,
              total: Number(p.total) || 0,
            })),
            totales: true,
            nombreArchivo: `ventas_periodo_${r.desde}_a_${r.hasta}`,
          },
  },
  {
    clave: "ventas_por_dia",
    etiqueta: "Ventas por día",
    icono: CalendarDays,
    generar: ({ reporte }, r) => ({
      titulo: "Ventas por día",
      subtitulo: `Periodo: ${r.desde} a ${r.hasta}`,
      columnas: [
        { clave: "dia", etiqueta: "Día", tipo: "texto" },
        { clave: "total", etiqueta: "Total vendido", tipo: "moneda" },
      ],
      filas: reporte.ventas_por_dia.labels.map((label, i) => ({ dia: label, total: reporte.ventas_por_dia.data[i] || 0 })),
      totales: true,
      nombreArchivo: `ventas_por_dia_${r.desde}_a_${r.hasta}`,
    }),
  },
  {
    clave: "ventas_por_categoria",
    etiqueta: "Ventas por categoría",
    icono: Layers,
    generar: ({ reporte }, r) => {
      const filas = reporte.ventas_por_categoria;
      if (filas.length === 0) return null;
      const suma = filas.reduce((acc, c) => acc + c.total, 0);
      return {
        titulo: "Ventas por categoría",
        subtitulo: `Periodo: ${r.desde} a ${r.hasta}`,
        columnas: [
          { clave: "categoria", etiqueta: "Categoría", tipo: "texto" },
          { clave: "total", etiqueta: "Total vendido", tipo: "moneda" },
          { clave: "participacion", etiqueta: "% del total", tipo: "porcentaje" },
        ],
        filas: filas.map((c) => ({
          categoria: c.categoria,
          total: c.total,
          participacion: suma ? Number(((c.total / suma) * 100).toFixed(1)) : 0,
        })),
        totales: true,
        nombreArchivo: `ventas_por_categoria_${r.desde}_a_${r.hasta}`,
      };
    },
  },
  {
    clave: "top_productos",
    etiqueta: "Top productos",
    icono: Trophy,
    generar: ({ reporte }, r) =>
      reporte.top_productos.length === 0
        ? null
        : {
            titulo: "Top productos vendidos",
            subtitulo: `Periodo: ${r.desde} a ${r.hasta}`,
            columnas: [
              { clave: "nombre", etiqueta: "Producto", tipo: "texto" },
              { clave: "cantidad", etiqueta: "Cantidad vendida", tipo: "numero" },
              { clave: "total", etiqueta: "Total vendido", tipo: "moneda" },
            ],
            filas: reporte.top_productos.map((p) => ({ nombre: p.nombre, cantidad: p.cantidad, total: p.total })),
            totales: true,
            nombreArchivo: `top_productos_${r.desde}_a_${r.hasta}`,
          },
  },
  {
    clave: "productos_por_categoria",
    etiqueta: "Productos por categoría",
    icono: Grid3x3,
    generar: ({ stats }) =>
      stats.productos_por_categoria.length === 0
        ? null
        : {
            titulo: "Productos por categoría (catálogo actual)",
            subtitulo: `Generado el ${new Date().toLocaleDateString("es-CO")}`,
            columnas: [
              { clave: "categoria", etiqueta: "Categoría", tipo: "texto" },
              { clave: "total", etiqueta: "Cantidad de productos", tipo: "numero" },
            ],
            filas: stats.productos_por_categoria,
            totales: true,
            nombreArchivo: `productos_por_categoria_${fechaLocal(new Date())}`,
          },
  },
];

export function ExportMenu({ rango }: { rango: Rango }) {
  const [abierto, setAbierto] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  async function exportar(inf: Informe) {
    setGenerando(inf.clave);
    setAviso(null);
    try {
      const [stats, reporte] = await Promise.all([obtenerEstadisticas(), obtenerReporteVentas(rango)]);
      const opciones = inf.generar({ stats, reporte }, rango);
      if (!opciones) {
        setAviso("No hay datos para este informe en el período.");
        return;
      }
      await descargarInforme(opciones);
      setAbierto(false);
    } catch {
      setAviso("No pudimos generar el informe. Intenta de nuevo.");
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="db-exportar" ref={caja}>
      <button
        type="button"
        className="db-boton-sec"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <Download size={15} aria-hidden="true" /> <span className="db-solo-ancho">Exportar</span>
        <ChevronDown size={14} className={abierto ? "chevron abierto" : "chevron"} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="menu-usuario menu-informes db-exportar-menu">
          {INFORMES.map((inf) => {
            const Icono = inf.icono;
            return (
              <button key={inf.clave} type="button" disabled={generando !== null} onClick={() => exportar(inf)}>
                <Icono size={16} />
                {generando === inf.clave ? "Generando…" : inf.etiqueta}
              </button>
            );
          })}
          {aviso && (
            <p className="db-exportar-aviso" role="status">
              {aviso}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
