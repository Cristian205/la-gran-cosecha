import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ExportMenu } from "./ExportMenu";
import { useFiltros } from "./filtros";
import { PeriodSelector } from "./PeriodSelector";
import { datosDe, useModulo } from "./useModulo";

/**
 * Título, última actualización, exportar y el filtro global.
 *
 * La hora de actualización es la de los KPI (`generado_en` del resumen): es
 * la primera respuesta y la que se mira primero. «Actualizar» pide datos
 * frescos a TODOS los módulos.
 */
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

function haceCuanto(iso: string, ahora: number): string {
  const min = Math.floor((ahora - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  return `a las ${HORA.format(new Date(iso))}`;
}

export function DashboardHeader({ negocio }: { negocio: string | null }) {
  const { rango, actualizar } = useFiltros();
  const { estado } = useModulo("resumen");
  const datos = datosDe(estado);
  const actualizando = estado.tipo === "cargando" || (estado.tipo === "listo" && estado.actualizando);

  // Re-pinta "hace N min" cada minuto sin pedir nada.
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <header className="db-cabecera">
      <div className="db-cabecera-fila">
        <div className="db-cabecera-titulos">
          <h1>Resumen del negocio</h1>
          <p>
            Indicadores generales{negocio ? ` de ${negocio}` : ""}
            {datos && (
              <span className="db-actualizado">
                <span className={`db-actualizado-punto ${actualizando ? "girando" : ""}`} aria-hidden="true" />
                Actualizado {haceCuanto(datos.generado_en, ahora)}
              </span>
            )}
          </p>
        </div>
        <div className="db-cabecera-acciones">
          <button
            type="button"
            className="db-boton-sec db-boton-icono"
            onClick={actualizar}
            disabled={actualizando}
            aria-label="Actualizar los datos"
            title="Actualizar los datos"
          >
            <RefreshCw size={15} className={actualizando ? "girando" : ""} aria-hidden="true" />
          </button>
          <ExportMenu rango={rango} />
        </div>
      </div>
      <PeriodSelector />
    </header>
  );
}
