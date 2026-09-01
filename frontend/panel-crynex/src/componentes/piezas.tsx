/**
 * Las piezas que se repiten entre pantallas.
 *
 * El estado de una empresa se pinta igual en la tabla, en su ficha y en el
 * buscador porque sale de aquí. Cuando el mismo dato se dibuja de tres maneras,
 * el lector deja de reconocerlo de un vistazo y tiene que leerlo.
 */
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { EstadoNegocio, EstadoSuscripcion } from "../api/tipos";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_SUSCRIPCION,
  TONO_ESTADO,
  TONO_SUSCRIPCION,
} from "../datos/derivados";
import { Insignia } from "../ui/basicos";

export function EstadoEmpresa({ estado }: { estado: EstadoNegocio }) {
  return (
    <Insignia tono={TONO_ESTADO[estado]} punto>
      {ETIQUETA_ESTADO[estado]}
    </Insignia>
  );
}

export function EstadoSuscripcionInsignia({ estado }: { estado: EstadoSuscripcion }) {
  return (
    <Insignia tono={TONO_SUSCRIPCION[estado]} punto>
      {ETIQUETA_SUSCRIPCION[estado]}
    </Insignia>
  );
}

/**
 * El plan de una empresa.
 *
 * Es una etiqueta, no un desplegable: cambiar de plan altera lo que puede hacer
 * un cliente entero y no puede pasar por rozar una fila. El clic lleva a la
 * suscripción, que es donde el cambio tiene contexto y confirmación.
 */
export function PlanEtiqueta({
  nombre,
  href,
}: {
  nombre: string | null | undefined;
  href?: string;
}) {
  if (!nombre) return <span className="tenue">sin plan</span>;
  const cuerpo = <span className="plan-etiqueta">{nombre}</span>;
  return href ? (
    <Link to={href} className="plan-enlace" title="Ver suscripción">
      {cuerpo}
    </Link>
  ) : (
    cuerpo
  );
}

/**
 * Una cifra de la plataforma.
 *
 * Nombre, valor, variación y contexto. La variación solo se dibuja cuando hay
 * con qué compararla: una flecha verde inventada es peor que ninguna flecha.
 */
export function TarjetaMetrica({
  etiqueta,
  valor,
  variacion,
  contexto,
  destino,
  tono,
}: {
  etiqueta: string;
  valor: ReactNode;
  variacion?: { texto: string; sentido: "sube" | "baja" | "plano" };
  contexto?: ReactNode;
  destino?: string;
  tono?: "aviso" | "malo";
}) {
  const cuerpo = (
    <>
      <p className="metrica__etiqueta">{etiqueta}</p>
      <p className="metrica__valor">{valor}</p>
      <p className="metrica__pie">
        {variacion && (
          <span className={`variacion variacion--${variacion.sentido}`}>
            {variacion.sentido === "sube" && <ArrowUpRight size={13} />}
            {variacion.sentido === "baja" && <ArrowDownRight size={13} />}
            {variacion.texto}
          </span>
        )}
        {contexto && <span className="tenue">{contexto}</span>}
      </p>
    </>
  );

  const clase = `metrica ${tono ? `metrica--${tono}` : ""}`;
  return destino ? (
    <Link to={destino} className={`${clase} metrica--enlace`}>
      {cuerpo}
    </Link>
  ) : (
    <article className={clase}>{cuerpo}</article>
  );
}
