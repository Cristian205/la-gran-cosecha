export type TipoColumnaInforme = "texto" | "numero" | "moneda" | "porcentaje";

export interface ColumnaInforme {
  clave: string;
  etiqueta: string;
  tipo?: TipoColumnaInforme;
  /** Ancho en caracteres (Excel). Sin él, se calcula por el contenido. */
  ancho?: number;
}

/** Lo que produce un informe: datos, sin aspecto. */
export interface InformeDatos {
  titulo: string;
  /** "Del 9 sept. al 8 oct. 2026", "Corte al…". Sin él, lo pone quien exporta. */
  periodo?: string;
  columnas: ColumnaInforme[];
  filas: Record<string, unknown>[];
  /** Admite una fila final con la suma de las columnas número/moneda. */
  totales?: boolean;
  nombreArchivo: string;
}

export type FormatoInforme = "excel" | "pdf";

/** Cómo se ve el informe: lo que el usuario personaliza en el modal. */
export interface EstiloInforme {
  formato: FormatoInforme;
  /** Nombre que encabeza el informe (por defecto, el del negocio). */
  empresa: string;
  /** Título visible; vacío = el del informe. */
  titulo: string;
  /** Texto libre bajo el encabezado ("Preparado para la junta…"). */
  notas: string;
  incluirLogo: boolean;
  /** Color de acento (#rrggbb): el de la marca o el verde del panel. */
  color: string;
  incluirTotales: boolean;
  /** Pie con fecha de generación, autor y número de página (PDF). */
  incluirPie: boolean;
  orientacion: "vertical" | "horizontal";
}

/** Lo que se sabe del negocio y de quien exporta. */
export interface ContextoInforme {
  logoUrl: string | null;
  generadoPor: string;
  periodo: string;
}
