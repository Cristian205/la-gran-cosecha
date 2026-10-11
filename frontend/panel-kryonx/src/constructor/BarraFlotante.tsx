/**
 * La barra de acciones sobre el lienzo, mientras hay una sección elegida.
 *
 * El pedido original la quería anclada al pixel exacto de la sección DENTRO
 * del iframe. Hacer eso de verdad exige que la tienda calcule y reporte su
 * posición por `postMessage` en cada scroll — una sincronización nueva sobre
 * una tercera app para un beneficio marginal. Esta versión ancla la barra al
 * lienzo (no al bloque) y ofrece las mismas acciones; el resaltado del propio
 * bloque dentro del iframe ya existe y no cambia.
 */
import { Copy, Eye, EyeOff, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  nombre: string;
  oculto: boolean;
  indice: number;
  total: number;
  duplicarDeshabilitado?: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onDuplicar: () => void;
  onAlternarVisible: () => void;
  onQuitar: () => void;
  onCerrar: () => void;
}

export function BarraFlotante({
  nombre,
  oculto,
  indice,
  total,
  duplicarDeshabilitado,
  onSubir,
  onBajar,
  onDuplicar,
  onAlternarVisible,
  onQuitar,
  onCerrar,
}: Props) {
  return (
    <div className="barra-flotante">
      <span className="barra-flotante__nombre">{nombre}</span>
      <span className="barra-flotante__separador" aria-hidden="true" />
      <button type="button" className="icono-boton" aria-label="Subir" disabled={indice === 0} onClick={onSubir}>
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className="icono-boton"
        aria-label="Bajar"
        disabled={indice === total - 1}
        onClick={onBajar}
      >
        <ChevronDown size={14} />
      </button>
      <button type="button" className="icono-boton" aria-label="Duplicar" disabled={duplicarDeshabilitado} onClick={onDuplicar}>
        <Copy size={13} />
      </button>
      <button
        type="button"
        className="icono-boton"
        aria-label={oculto ? "Mostrar" : "Ocultar"}
        title={oculto ? "Mostrar en todos los dispositivos" : "Ocultar en todos los dispositivos"}
        onClick={onAlternarVisible}
      >
        {oculto ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button type="button" className="icono-boton" aria-label="Eliminar" onClick={onQuitar}>
        <Trash2 size={13} />
      </button>
      <span className="barra-flotante__separador" aria-hidden="true" />
      <button type="button" className="icono-boton" aria-label="Cerrar selección" onClick={onCerrar}>
        <X size={14} />
      </button>
    </div>
  );
}
