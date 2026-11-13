import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Variacion } from "./formato";

/**
 * La variación contra el período anterior: chip con flecha y %, la diferencia
 * absoluta y la referencia del período comparado ("vs. 4 – 10 nov").
 */
const ICONO = { sube: ArrowUpRight, baja: ArrowDownRight, igual: Minus } as const;

export function VariacionChip({
  variacion,
  referencia,
  compacta = false,
}: {
  variacion: Variacion | null;
  referencia?: string | null;
  compacta?: boolean;
}) {
  if (!variacion) return null;
  if (variacion.tipo === "neutra") return <p className="db-var db-var--neutra">{variacion.texto}</p>;
  const Icono = ICONO[variacion.tipo];
  return (
    <p className={`db-var db-var--${variacion.tipo}`}>
      <span className="db-var-chip">
        <Icono size={13} aria-hidden="true" />
        {variacion.porcentaje ?? "Nuevo"}
      </span>
      {!compacta && <span className="db-var-dif">{variacion.diferencia}</span>}
      {referencia && <span className="db-var-ref">{referencia}</span>}
    </p>
  );
}
