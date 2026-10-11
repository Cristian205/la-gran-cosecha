import { formatoPrecio } from "../utils";
import { fechaGeneracion, paleta, sumaColumna } from "./estilo";
import type { ColumnaInforme, ContextoInforme, EstiloInforme, InformeDatos } from "./tipos";

/**
 * El informe en PDF, sin librerías: un documento HTML con estilos de
 * impresión que se abre en el diálogo de imprimir del navegador ("Guardar
 * como PDF"). Sale con tipografía real, el logo tal cual (no hay que leerlo
 * como datos, así que no le afecta el CORS) y la cabecera de la tabla
 * repetida en cada página.
 */
function escapar(texto: unknown): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NUMERO = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

function celda(valor: unknown, col: ColumnaInforme): string {
  if (valor === null || valor === undefined || valor === "") return "";
  switch (col.tipo) {
    case "moneda":
      return formatoPrecio(Number(valor) || 0);
    case "numero":
      return NUMERO.format(Number(valor) || 0);
    case "porcentaje":
      return `${NUMERO.format(Number(valor) || 0)} %`;
    default:
      return String(valor);
  }
}

export function htmlInforme(datos: InformeDatos, estilo: EstiloInforme, contexto: ContextoInforme): string {
  const c = paleta(estilo.color);
  const titulo = estilo.titulo.trim() || datos.titulo;
  const derecha = (col: ColumnaInforme) => (col.tipo && col.tipo !== "texto" ? ' class="num"' : "");
  const conTotales = Boolean(datos.totales && estilo.incluirTotales && datos.filas.length > 0);
  const logo = estilo.incluirLogo && contexto.logoUrl;
  const generado = `Generado el ${fechaGeneracion()}${contexto.generadoPor ? ` por ${contexto.generadoPor}` : ""}`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${escapar(datos.nombreArchivo)}</title>
<style>
  @page {
    size: A4 ${estilo.orientacion === "horizontal" ? "landscape" : "portrait"};
    margin: 16mm 14mm 18mm;
    ${
      estilo.incluirPie
        ? `@bottom-left { content: "${escapar(estilo.empresa).replace(/"/g, "")}"; font: 8pt Inter, "Segoe UI", Arial, sans-serif; color: #64748b; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Inter, "Segoe UI", Arial, sans-serif; color: #64748b; }`
        : ""
    }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 10pt/1.45 Inter, "Segoe UI", system-ui, Arial, sans-serif; color: #0f172a; }
  header { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; border-bottom: 2.5px solid ${c.acento}; }
  header img { max-height: 56px; max-width: 150px; object-fit: contain; }
  .empresa { font-size: 8.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
  h1 { margin: 2px 0 0; font-size: 19pt; line-height: 1.15; color: ${c.titulo}; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 10px 0 14px; font-size: 9pt; color: #334155; }
  .meta b { color: #0f172a; }
  .notas { margin: -4px 0 14px; padding: 8px 12px; border-left: 3px solid ${c.acento}; background: ${c.suave}; font-size: 9pt; color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead { display: table-header-group; }
  th { background: ${c.cabecera}; color: ${c.sobreAcento}; font-weight: 700; text-align: left; padding: 7px 9px; }
  th:first-child { border-radius: 5px 0 0 0; } th:last-child { border-radius: 0 5px 0 0; }
  td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) td { background: ${c.suave}; }
  tr { break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { font-weight: 700; color: ${c.titulo}; border-top: 2px solid ${c.acento}; border-bottom: none; background: none !important; }
  .vacio { padding: 18px; text-align: center; color: #64748b; }
  footer { margin-top: 14px; font-size: 8pt; color: #64748b; }
</style></head>
<body>
  <header>
    ${logo ? `<img src="${escapar(contexto.logoUrl)}" alt="">` : ""}
    <div>
      ${estilo.empresa.trim() ? `<div class="empresa">${escapar(estilo.empresa.trim())}</div>` : ""}
      <h1>${escapar(titulo)}</h1>
    </div>
  </header>
  <div class="meta">
    ${contexto.periodo ? `<span><b>Período:</b> ${escapar(contexto.periodo)}</span>` : ""}
    <span><b>Registros:</b> ${datos.filas.length}</span>
  </div>
  ${estilo.notas.trim() ? `<div class="notas">${escapar(estilo.notas.trim())}</div>` : ""}
  <table>
    <thead><tr>${datos.columnas.map((col) => `<th${derecha(col)}>${escapar(col.etiqueta)}</th>`).join("")}</tr></thead>
    <tbody>
      ${
        datos.filas.length === 0
          ? `<tr><td class="vacio" colspan="${datos.columnas.length}">Sin datos para este período.</td></tr>`
          : datos.filas
              .map(
                (f) =>
                  `<tr>${datos.columnas.map((col) => `<td${derecha(col)}>${escapar(celda(f[col.clave], col))}</td>`).join("")}</tr>`
              )
              .join("")
      }
    </tbody>
    ${
      conTotales
        ? `<tfoot><tr>${datos.columnas
            .map((col, i) =>
              col.tipo === "numero" || col.tipo === "moneda"
                ? `<td class="num">${escapar(celda(sumaColumna(datos.filas, col.clave), col))}</td>`
                : `<td>${i === 0 ? "Total" : ""}</td>`
            )
            .join("")}</tr></tfoot>`
        : ""
    }
  </table>
  ${estilo.incluirPie ? `<footer>${escapar(generado)}.</footer>` : ""}
</body></html>`;
}

/** Abre el diálogo de impresión con el informe. Resuelve al cerrarse. */
export function imprimirInforme(datos: InformeDatos, estilo: EstiloInforme, contexto: ContextoInforme): Promise<void> {
  return new Promise((resolve, reject) => {
    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(marco);
    const doc = marco.contentDocument;
    const ventana = marco.contentWindow;
    if (!doc || !ventana) {
      marco.remove();
      reject(new Error("No se pudo preparar la impresión."));
      return;
    }
    doc.open();
    doc.write(htmlInforme(datos, estilo, contexto));
    doc.close();

    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      setTimeout(() => marco.remove(), 500);
      resolve();
    };
    ventana.addEventListener("afterprint", terminar);

    // Espera al logo (si lo hay) para que no salga una caja vacía; con un
    // tope, para que un logo que no carga no bloquee el informe.
    const imagenes = Array.from(doc.images);
    const cargadas = Promise.all(
      imagenes.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((ok) => {
              img.onload = () => ok();
              img.onerror = () => {
                img.remove();
                ok();
              };
            })
      )
    );
    Promise.race([cargadas, new Promise((ok) => setTimeout(ok, 4000))]).then(() => {
      ventana.focus();
      ventana.print();
      // Algunos navegadores no emiten `afterprint` desde un iframe.
      setTimeout(terminar, 1500);
    });
  });
}
