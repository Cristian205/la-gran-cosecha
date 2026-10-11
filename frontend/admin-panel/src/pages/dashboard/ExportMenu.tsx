import { Download } from "lucide-react";
import { useState } from "react";
import { ExportModal } from "./ExportModal";
import type { Rango } from "./periodo";

/**
 * El botón "Exportar" del dashboard.
 *
 * Antes desplegaba una lista de informes bajo el botón; en pantallas
 * medianas se salía por la derecha y desplazaba todo el dashboard. Ahora abre
 * un modal donde se elige el informe y cómo se ve (logo, colores, Excel o
 * PDF): ver `ExportModal`.
 */
export function ExportMenu({ rango }: { rango: Rango }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="db-boton-sec db-exportar" aria-haspopup="dialog" onClick={() => setAbierto(true)}>
        <Download size={15} aria-hidden="true" /> <span className="db-solo-ancho">Exportar</span>
      </button>
      {abierto && <ExportModal rango={rango} onCerrar={() => setAbierto(false)} />}
    </>
  );
}
