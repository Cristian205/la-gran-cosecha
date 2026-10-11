/**
 * Actividad: la línea de tiempo completa de la plataforma.
 *
 * Es la misma reconstrucción que el dashboard resume en seis líneas —altas de
 * empresas e inicios de suscripción, con la fecha que guardan los propios
 * registros—, entera y filtrable. No es una auditoría: eso necesita una tabla
 * que el backend todavía no tiene, y la pantalla lo dice.
 */
import { useMemo, useState } from "react";
import { usarPlataforma } from "../datos/plataforma";
import { actividadDe, type TipoEvento } from "../datos/derivados";
import { Aviso, Tarjeta } from "../ui/basicos";
import { EncabezadoPagina } from "../componentes/piezas";
import { LineaActividad } from "../componentes/LineaActividad";

const FILTROS: { valor: TipoEvento | ""; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todo" },
  { valor: "alta", etiqueta: "Altas de empresa" },
  { valor: "suscripcion", etiqueta: "Suscripciones" },
];

export function Actividad() {
  const { negocios, suscripciones, error } = usarPlataforma();
  const [tipo, setTipo] = useState<TipoEvento | "">("");

  const eventos = useMemo(
    () => actividadDe(negocios, suscripciones, 500).filter((e) => !tipo || e.tipo === tipo),
    [negocios, suscripciones, tipo]
  );

  return (
    <>
      <EncabezadoPagina
        antetitulo="Visión general"
        titulo="Actividad"
        descripcion="Lo que ha pasado en la plataforma, del más reciente al más antiguo."
      />
      {error && <Aviso>{error}</Aviso>}

      <div className="segmentado" role="tablist" aria-label="Filtrar actividad">
        {FILTROS.map((f) => (
          <button
            key={f.valor || "todo"}
            type="button"
            role="tab"
            aria-selected={tipo === f.valor}
            className={`segmentado__opcion ${tipo === f.valor ? "esta-activa" : ""}`}
            onClick={() => setTipo(f.valor)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <Tarjeta
        pie={
          <span className="tenue">
            Reconstruida de las fechas que guardan los propios registros. El histórico completo de
            cambios llegará con la Auditoría.
          </span>
        }
      >
        <LineaActividad eventos={eventos} />
      </Tarjeta>
    </>
  );
}
