// exceljs pesa ~940 kB. Se carga con import() dinamico dentro de
// descargarInforme() para que no entre en el bundle inicial del panel:
// solo se descarga la primera vez que alguien exporta un informe.
import type ExcelJSNamespace from "exceljs";

export type TipoColumnaInforme = "texto" | "numero" | "moneda" | "porcentaje";

export interface ColumnaInforme {
  clave: string;
  etiqueta: string;
  tipo?: TipoColumnaInforme;
  ancho?: number;
}

export interface InformeOpciones {
  nombreArchivo: string;
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaInforme[];
  filas: Record<string, unknown>[];
  /** Agrega una fila final en negrita con la suma de las columnas numero/moneda. */
  totales?: boolean;
}

const VERDE_MARCA = "FF15803D";
const VERDE_OSCURO = "FF0F5C2E";
const GRIS_ZEBRA = "FFF1F5F9";
const GRIS_TEXTO = "FF64748B";
const BORDE = "FFE2E8F0";

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
  return Math.min(Math.max(maxDato + 4, 12), 42);
}

/** Genera un .xlsx con encabezado de marca, columnas tipadas (moneda/número/%) y
 * fila de totales opcional, y dispara la descarga en el navegador. */
export async function descargarInforme({
  nombreArchivo,
  titulo,
  subtitulo,
  columnas,
  filas,
  totales = false,
}: InformeOpciones): Promise<void> {
  const ExcelJS: typeof ExcelJSNamespace = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "La Gran Cosecha";
  libro.created = new Date();

  const nombreHoja = titulo.replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
  const hoja = libro.addWorksheet(nombreHoja || "Informe");
  hoja.columns = columnas.map((c) => ({ key: c.clave, width: anchoColumna(c, filas) }));

  const filaTitulo = hoja.addRow([titulo]);
  filaTitulo.getCell(1).font = { bold: true, size: 15, color: { argb: VERDE_OSCURO } };
  filaTitulo.height = 26;
  if (columnas.length > 1) hoja.mergeCells(filaTitulo.number, 1, filaTitulo.number, columnas.length);

  if (subtitulo) {
    const filaSub = hoja.addRow([subtitulo]);
    filaSub.getCell(1).font = { italic: true, size: 10, color: { argb: GRIS_TEXTO } };
    if (columnas.length > 1) hoja.mergeCells(filaSub.number, 1, filaSub.number, columnas.length);
  }

  hoja.addRow([]);

  const filaHeader = hoja.addRow(columnas.map((c) => c.etiqueta));
  filaHeader.height = 22;
  filaHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_MARCA } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  hoja.views = [{ state: "frozen", ySplit: filaHeader.number }];
  if (columnas.length > 0) {
    hoja.autoFilter = {
      from: { row: filaHeader.number, column: 1 },
      to: { row: filaHeader.number, column: columnas.length },
    };
  }

  filas.forEach((fila, i) => {
    const row = hoja.addRow(columnas.map((c) => fila[c.clave] ?? ""));
    columnas.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      const formato = c.tipo && FORMATOS[c.tipo];
      if (formato) cell.numFmt = formato;
      cell.alignment = { horizontal: c.tipo && c.tipo !== "texto" ? "right" : "left" };
      cell.border = { bottom: { style: "thin", color: { argb: BORDE } } };
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_ZEBRA } };
      }
    });
  });

  if (totales) {
    const filaTotales = hoja.addRow(
      columnas.map((c, idx) => {
        if (idx === 0) return "Total";
        if (c.tipo === "numero" || c.tipo === "moneda") {
          return filas.reduce((acc, f) => acc + (Number(f[c.clave]) || 0), 0);
        }
        return "";
      })
    );
    filaTotales.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.border = { top: { style: "double", color: { argb: VERDE_OSCURO } } };
      const formato = columnas[colNumber - 1]?.tipo && FORMATOS[columnas[colNumber - 1].tipo!];
      if (formato) cell.numFmt = formato;
    });
  }

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${nombreArchivo}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
