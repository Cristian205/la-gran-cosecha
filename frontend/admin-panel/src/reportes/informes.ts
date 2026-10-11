import { CalendarDays, Grid3x3, Layers, Receipt, Sheet, Trophy } from "lucide-react";
import type { InformeDatos } from "./tipos";
import type { Estadisticas, ReporteVentas } from "../types";
import { formatoFecha, formatoPrecio } from "../utils";
import { fechaLocal, type Rango } from "../pages/dashboard/periodo";

/**
 * Los informes que se pueden exportar desde el dashboard.
 *
 * Cada uno sabe convertir los datos del panel en filas y columnas; el aspecto
 * (logo, colores, encabezado, Excel o PDF) lo pone `estilo.ts` y no se repite
 * aquí. Los datos se piden al exportar, no al abrir el dashboard: el reporte
 * trae todas las filas de pedidos del rango y casi nunca se usa.
 */
export type Fuente = { stats: Estadisticas; reporte: ReporteVentas };

export interface Informe {
  clave: string;
  etiqueta: string;
  descripcion: string;
  icono: typeof Sheet;
  /** Usa el período elegido en el dashboard (si no, es una foto de hoy). */
  usaPeriodo: boolean;
  generar: (f: Fuente, rango: Rango) => InformeDatos | null;
}

const hoy = () => new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

export const INFORMES: Informe[] = [
  {
    clave: "resumen",
    etiqueta: "Resumen general",
    descripcion: "Indicadores clave del negocio: ventas, caja, clientes y catálogo.",
    icono: Sheet,
    usaPeriodo: false,
    generar: ({ stats }) => ({
      titulo: "Resumen general",
      periodo: `Corte al ${hoy()}`,
      columnas: [
        { clave: "metrica", etiqueta: "Métrica", tipo: "texto", ancho: 30 },
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
    descripcion: "Cada pedido del período con cliente, estado, ítems y total.",
    icono: Receipt,
    usaPeriodo: true,
    generar: ({ reporte }, r) =>
      reporte.pedidos.length === 0
        ? null
        : {
            titulo: "Ventas del período",
            columnas: [
              { clave: "id", etiqueta: "N° pedido", tipo: "texto" },
              { clave: "fecha", etiqueta: "Fecha", tipo: "texto" },
              { clave: "cliente", etiqueta: "Cliente", tipo: "texto" },
              { clave: "estado", etiqueta: "Estado", tipo: "texto" },
              { clave: "num_items", etiqueta: "Ítems", tipo: "numero" },
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
    descripcion: "Total vendido cada día del período, para ver la tendencia.",
    icono: CalendarDays,
    usaPeriodo: true,
    generar: ({ reporte }, r) => ({
      titulo: "Ventas por día",
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
    descripcion: "Cuánto aporta cada categoría y su participación en el total.",
    icono: Layers,
    usaPeriodo: true,
    generar: ({ reporte }, r) => {
      const filas = reporte.ventas_por_categoria;
      if (filas.length === 0) return null;
      const suma = filas.reduce((acc, c) => acc + c.total, 0);
      return {
        titulo: "Ventas por categoría",
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
    descripcion: "Los productos más vendidos por cantidad y valor.",
    icono: Trophy,
    usaPeriodo: true,
    generar: ({ reporte }, r) =>
      reporte.top_productos.length === 0
        ? null
        : {
            titulo: "Top productos vendidos",
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
    descripcion: "Cómo está repartido el catálogo actual entre las categorías.",
    icono: Grid3x3,
    usaPeriodo: false,
    generar: ({ stats }) =>
      stats.productos_por_categoria.length === 0
        ? null
        : {
            titulo: "Productos por categoría",
            periodo: `Catálogo al ${hoy()}`,
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
