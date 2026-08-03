import { FileText, FileVideo } from "lucide-react";
import type { ReactNode } from "react";
import type { Archivo } from "../types";
import { formatoFecha, formatoTamano } from "../utils";

interface Props {
  archivos: Archivo[];
  cargando?: boolean;
  onClicTarjeta?: (archivo: Archivo) => void;
  renderAcciones?: (archivo: Archivo) => ReactNode;
}

export function ArchivosGrid({ archivos, cargando, onClicTarjeta, renderAcciones }: Props) {
  if (cargando) return <div className="vacio">Cargando…</div>;
  if (archivos.length === 0) return <div className="vacio">No hay archivos.</div>;

  return (
    <div className="archivos-grid">
      {archivos.map((a) => (
        <div
          key={a.id}
          className={`archivo-card ${onClicTarjeta ? "seleccionable" : ""}`}
          onClick={() => onClicTarjeta?.(a)}
          role={onClicTarjeta ? "button" : undefined}
          tabIndex={onClicTarjeta ? 0 : undefined}
        >
          <div className="archivo-thumb">
            {a.tipo === "IMAGEN" && a.url ? (
              <img src={a.url} alt={a.nombre_original} loading="lazy" />
            ) : a.tipo === "VIDEO" ? (
              <FileVideo size={28} />
            ) : (
              <FileText size={28} />
            )}
          </div>
          <div className="archivo-info">
            <span className="nombre" title={a.nombre_original}>
              {a.nombre_original}
            </span>
            <span className="meta">
              {formatoTamano(a.tamano)} · {formatoFecha(a.fecha_creacion)}
            </span>
          </div>
          {renderAcciones && (
            <div className="archivo-acciones" onClick={(e) => e.stopPropagation()}>
              {renderAcciones(a)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
