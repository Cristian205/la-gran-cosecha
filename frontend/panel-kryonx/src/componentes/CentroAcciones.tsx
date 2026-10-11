/**
 * Action Center: lo que hay que resolver, con el botón que lo resuelve.
 *
 * Evoluciona «Atención requerida»: la lista ya no solo informa, ofrece la
 * acción que corresponde a cada problema —reactivar, asignar plan, ampliarlo,
 * revisar la suscripción— con los mismos diálogos que el resto del panel, así
 * que resolver desde aquí tiene la misma confirmación que hacerlo desde la
 * ficha de la empresa.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { EstadoNegocio, Negocio } from "../api/tipos";
import type { Alerta } from "../datos/derivados";
import { usarPlataforma } from "../datos/plataforma";
import { Boton, EstadoVacio } from "../ui/basicos";
import { DialogoEstado, DialogoPlan } from "./dialogos";

type Resolucion =
  | { tipo: "plan"; negocio: Negocio }
  | { tipo: "estado"; negocio: Negocio; estado: EstadoNegocio };

const ACCION: Record<Alerta["tipo"], string> = {
  suspendida: "Reactivar",
  "sin-plan": "Asignar plan",
  suscripcion: "Revisar suscripción",
  renovacion: "Ver renovación",
  uso: "Ampliar plan",
};

export function CentroAcciones({ alertas, cuantas = 5 }: { alertas: Alerta[]; cuantas?: number }) {
  const { negocios } = usarPlataforma();
  const navegar = useNavigate();
  const [resolviendo, setResolviendo] = useState<Resolucion | null>(null);

  if (alertas.length === 0) {
    return (
      <EstadoVacio icono={CheckCircle2} titulo="Todo en orden">
        Ninguna empresa está suspendida, sin plan, por vencer ni cerca de sus límites.
      </EstadoVacio>
    );
  }

  function resolver(alerta: Alerta) {
    const negocio = negocios.find((n) => n.id === alerta.negocioId);
    if (!negocio) return;
    switch (alerta.tipo) {
      case "suspendida":
        setResolviendo({ tipo: "estado", negocio, estado: "ACTIVO" });
        break;
      case "sin-plan":
      case "uso":
        setResolviendo({ tipo: "plan", negocio });
        break;
      default:
        navegar(`/empresas/${negocio.id}/suscripcion`);
    }
  }

  return (
    <>
      <ol className="acciones">
        {alertas.slice(0, cuantas).map((alerta, i) => (
          <li key={alerta.id} className={`accion accion--${alerta.nivel}`}>
            <span className="accion__numero">{String(i + 1).padStart(2, "0")}</span>
            <div className="accion__cuerpo">
              <Link to={`/empresas/${alerta.negocioId}`} className="accion__empresa">
                {alerta.negocio}
              </Link>
              <p className="accion__titulo">
                <i className={`punto-estado punto-estado--${alerta.nivel === "critico" ? "malo" : "aviso"}`} />
                {alerta.titulo}
              </p>
              <p className="accion__detalle">{alerta.detalle}</p>
            </div>
            <div className="accion__botones">
              <Boton
                tamano="pequeno"
                variante={alerta.nivel === "critico" ? "primario" : "secundario"}
                onClick={() => resolver(alerta)}
              >
                {ACCION[alerta.tipo]}
              </Boton>
              <Link
                to={`/empresas/${alerta.negocioId}`}
                className="icono-boton"
                aria-label={`Ver ${alerta.negocio}`}
                data-pista="Ver empresa"
              >
                <ArrowRight size={14} />
              </Link>
            </div>
          </li>
        ))}
      </ol>

      {resolviendo?.tipo === "plan" && (
        <DialogoPlan negocio={resolviendo.negocio} onCerrar={() => setResolviendo(null)} />
      )}
      {resolviendo?.tipo === "estado" && (
        <DialogoEstado
          negocio={resolviendo.negocio}
          estado={resolviendo.estado}
          onCerrar={() => setResolviendo(null)}
        />
      )}
    </>
  );
}
