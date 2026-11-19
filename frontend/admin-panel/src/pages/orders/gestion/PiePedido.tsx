import { Printer, Save } from "lucide-react";
import { formatoPrecio } from "../../../utils";
import { BotonAccion } from "./piezas";
import type { EstadoAccion } from "./useGestionPedido";
import type { ResumenCambios } from "./modelo";

function textoCambios(c: ResumenCambios): string {
  const partes: string[] = [];
  if (c.agregadas) partes.push(`${c.agregadas} agregado${c.agregadas === 1 ? "" : "s"}`);
  if (c.editadas) partes.push(`${c.editadas} editado${c.editadas === 1 ? "" : "s"}`);
  if (c.eliminadas) partes.push(`${c.eliminadas} quitado${c.eliminadas === 1 ? "" : "s"}`);
  if (c.entrega) partes.push(`${c.entrega} dato${c.entrega === 1 ? "" : "s"} de entrega`);
  return partes.join(" · ");
}

export function PiePedido({
  total,
  totalGuardado,
  cambios,
  soloLectura,
  cargado,
  estadoGuardado,
  estadoImpresion,
  onCerrar,
  onImprimir,
  onGuardar,
  onDescartar,
}: {
  total: number;
  totalGuardado: number | null;
  cambios: ResumenCambios;
  soloLectura: boolean;
  cargado: boolean;
  estadoGuardado: EstadoAccion;
  estadoImpresion: EstadoAccion;
  onCerrar: () => void;
  onImprimir: () => void;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  const diferencia = totalGuardado !== null ? total - totalGuardado : 0;
  return (
    <div className="gp-pie">
      <div className="gp-pie-total" aria-live="polite">
        <span className="gp-pie-etiqueta">Total del pedido</span>
        <span className="gp-pie-valor">{cargado ? formatoPrecio(total) : "—"}</span>
        {cambios.total > 0 ? (
          <span className="gp-pie-cambios">
            <span className="gp-pie-punto" aria-hidden="true" />
            {textoCambios(cambios)}
            {Math.abs(diferencia) >= 1 && (
              <span className={diferencia > 0 ? "sube" : "baja"}>
                {" "}
                ({diferencia > 0 ? "+" : "−"}
                {formatoPrecio(Math.abs(diferencia))})
              </span>
            )}
            {!soloLectura && (
              <button type="button" className="gp-enlace" onClick={onDescartar}>
                Descartar
              </button>
            )}
          </span>
        ) : (
          <span className="gp-pie-cambios gp-tenue">{soloLectura ? "Solo lectura" : "Todo guardado"}</span>
        )}
      </div>
      <div className="gp-pie-acciones">
        <button type="button" className="btn secundario" onClick={onCerrar}>
          Cerrar
        </button>
        <BotonAccion
          estado={estadoImpresion}
          clase="secundario"
          onClick={onImprimir}
          icono={<Printer size={16} aria-hidden="true" />}
          texto="Imprimir factura"
          textoCargando="Generando…"
          textoExito="Factura lista"
          textoError="Reintentar"
          disabled={!cargado}
        />
        {!soloLectura && (
          <BotonAccion
            estado={estadoGuardado}
            clase="primario"
            onClick={onGuardar}
            icono={<Save size={16} aria-hidden="true" />}
            texto="Guardar cambios"
            textoCargando="Guardando…"
            textoExito="Guardado"
            textoError="Reintentar"
            disabled={!cargado || (cambios.total === 0 && estadoGuardado !== "error")}
            title="Guardar (Ctrl+S)"
          />
        )}
      </div>
    </div>
  );
}
