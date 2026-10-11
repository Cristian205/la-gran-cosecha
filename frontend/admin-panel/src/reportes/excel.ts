// exceljs pesa ~940 kB. Se carga con import() dinámico para que no entre en
// el bundle inicial del panel: solo se descarga la primera vez que alguien
// exporta un informe en Excel.
import type ExcelJSNamespace from "exceljs";
import { argb, paleta, sumaColumna, fechaGeneracion, type LogoListo } from "./estilo";
import type { ColumnaInforme, ContextoInforme, EstiloInforme, InformeDatos, TipoColumnaInforme } from "./tipos";

const GRIS_TEXTO = "FF64748B";
const GRIS_LINEA = "FFE2E8F0";
const OSCURO = "FF0F172A";

const FORMATOS: Partial<Record<TipoColumnaInforme, string>> = {
  numero: "#,##0",
  moneda: '"$" #,##0',
  porcentaje: '0.0"%"',
};

function anchoColumna(col: ColumnaInforme, filas: Record<string, unknown>[]): number {
  if (col.ancho) return col.ancho;
  const maxDato = filas.reduce((max, fila) => {
    const valor = fila[col.clave];
    const largo = valor === null || valor === undefined ? 0 : String(valor).length;
    return Math.max(max, largo);
  }, col.etiqueta.length);
  return Math.min(Math.max(maxDato + 4, 14), 44);
}

/**
 * Un .xlsx con aspecto de documento de empresa:
 *
 *   [logo]  NOMBRE DE LA EMPRESA
 *           Título del informe
 *           Período · notas
 *   ┌──────── cabecera en el color de la marca ────────┐
 *   filas alternas, columnas con formato de moneda/%/número
 *   └──────────────── fila de totales ─────────────────┘
 *   Generado el … por …
 *
 * con el encabezado de la tabla congelado y filtros activados.
 */
export async function descargarExcel(
  datos: InformeDatos,
  estilo: EstiloInforme,
  contexto: ContextoInforme,
  logo: LogoListo | null
): Promise<void> {
  const ExcelJS: typeof ExcelJSNamespace = (await import("exceljs")).default;
  const colores = paleta(estilo.color);
  const { columnas, filas } = datos;
  const titulo = estilo.titulo.trim() || datos.titulo;
  const nColumnas = Math.max(columnas.length, 1);
  // Con logo, el texto del encabezado empieza en la columna 2.
  const colTexto = logo ? Math.min(2, nColumnas) : 1;

  const libro = new ExcelJS.Workbook();
  libro.creator = estilo.empresa || "Kryon X";
  libro.company = estilo.empresa;
  libro.title = titulo;
  libro.created = new Date();

  const hoja = libro.addWorksheet((titulo.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Informe").trim(), {
    pageSetup: {
      orientation: estilo.orientacion === "horizontal" ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: estilo.incluirPie
      ? { oddFooter: `&L&8${estilo.empresa}&C&8${titulo}&R&8Página &P de &N` }
      : undefined,
    views: [{ showGridLines: false }],
  });
  hoja.columns = columnas.map((c) => ({ key: c.clave, width: anchoColumna(c, filas) }));
  if (logo && hoja.getColumn(1).width! < 16) hoja.getColumn(1).width = 16;

  const fusionar = (fila: number) => {
    if (nColumnas > colTexto) hoja.mergeCells(fila, colTexto, fila, nColumnas);
  };
  const linea = (texto: string, fuente: Partial<ExcelJSNamespace.Font>, alto?: number) => {
    const fila = hoja.addRow([]);
    fila.getCell(colTexto).value = texto;
    fila.getCell(colTexto).font = fuente;
    fila.getCell(colTexto).alignment = { vertical: "middle" };
    if (alto) fila.height = alto;
    fusionar(fila.number);
    return fila;
  };

  // ---------- Encabezado ----------
  const inicio = hoja.rowCount + 1;
  if (estilo.empresa.trim()) {
    linea(estilo.empresa.trim().toUpperCase(), { bold: true, size: 10, color: { argb: GRIS_TEXTO } }, 18);
  }
  linea(titulo, { bold: true, size: 18, color: { argb: argb(colores.titulo) } }, 30);
  if (contexto.periodo) linea(contexto.periodo, { size: 10, color: { argb: OSCURO } }, 16);
  if (estilo.notas.trim()) linea(estilo.notas.trim(), { italic: true, size: 10, color: { argb: GRIS_TEXTO } }, 16);

  if (logo) {
    const id = libro.addImage({ base64: logo.base64, extension: "png" });
    // ~60 px de alto, proporcional, a la izquierda del texto.
    const alto = 60;
    const ancho = Math.round((logo.ancho / logo.alto) * alto);
    hoja.addImage(id, { tl: { col: 0.1, row: inicio - 1 + 0.15 }, ext: { width: Math.min(ancho, 150), height: alto } });
    // Que las filas del encabezado sumen al menos el alto del logo.
    while (hoja.rowCount - inicio + 1 < 4) linea("", {}, 14);
  }

  // Raya del color de la marca bajo el encabezado.
  const raya = hoja.addRow([]);
  raya.height = 6;
  for (let c = 1; c <= nColumnas; c++) {
    raya.getCell(c).border = { bottom: { style: "medium", color: { argb: argb(colores.acento) } } };
  }
  hoja.addRow([]).height = 8;

  // ---------- Tabla ----------
  const cabecera = hoja.addRow(columnas.map((c) => c.etiqueta));
  cabecera.height = 24;
  cabecera.eachCell((cell, n) => {
    const tipo = columnas[n - 1]?.tipo;
    cell.font = { bold: true, size: 10, color: { argb: argb(colores.sobreAcento) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colores.cabecera) } };
    cell.alignment = { vertical: "middle", horizontal: tipo && tipo !== "texto" ? "right" : "left", indent: 1 };
  });
  hoja.views = [{ state: "frozen", ySplit: cabecera.number, showGridLines: false }];
  if (columnas.length > 0 && filas.length > 0) {
    hoja.autoFilter = {
      from: { row: cabecera.number, column: 1 },
      to: { row: cabecera.number, column: columnas.length },
    };
  }

  filas.forEach((fila, i) => {
    const row = hoja.addRow(columnas.map((c) => fila[c.clave] ?? ""));
    row.height = 20;
    columnas.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      const formato = c.tipo && FORMATOS[c.tipo];
      if (formato) cell.numFmt = formato;
      cell.font = { size: 10, color: { argb: OSCURO } };
      cell.alignment = { vertical: "middle", horizontal: c.tipo && c.tipo !== "texto" ? "right" : "left", indent: 1 };
      cell.border = { bottom: { style: "thin", color: { argb: GRIS_LINEA } } };
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colores.suave) } };
    });
  });

  if (datos.totales && estilo.incluirTotales && filas.length > 0) {
    const totales = hoja.addRow(
      columnas.map((c, idx) => {
        if (c.tipo === "numero" || c.tipo === "moneda") return sumaColumna(filas, c.clave);
        return idx === 0 ? "Total" : "";
      })
    );
    totales.height = 22;
    totales.eachCell({ includeEmpty: true }, (cell, n) => {
      const col = columnas[n - 1];
      cell.font = { bold: true, size: 10, color: { argb: argb(colores.titulo) } };
      cell.border = { top: { style: "medium", color: { argb: argb(colores.acento) } } };
      cell.alignment = { vertical: "middle", horizontal: col?.tipo && col.tipo !== "texto" ? "right" : "left", indent: 1 };
      const formato = col?.tipo && FORMATOS[col.tipo];
      if (formato) cell.numFmt = formato;
    });
  }

  if (estilo.incluirPie) {
    hoja.addRow([]);
    const pie = hoja.addRow([`Generado el ${fechaGeneracion()}${contexto.generadoPor ? ` por ${contexto.generadoPor}` : ""}.`]);
    pie.getCell(1).font = { italic: true, size: 9, color: { argb: GRIS_TEXTO } };
    if (nColumnas > 1) hoja.mergeCells(pie.number, 1, pie.number, nColumnas);
  }

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${datos.nombreArchivo}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
