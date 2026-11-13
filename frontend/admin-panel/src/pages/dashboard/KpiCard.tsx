import { ArrowRight, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { InfoTip } from "./estados";
import type { Variacion } from "./formato";
import { Sparkline } from "./Sparkline";
import { VariacionChip } from "./Variacion";

/** El número que cambia se cuenta hasta su valor nuevo, en medio segundo. */
export function useValorAnimado(objetivo: number): number {
  const [valor, setValor] = useState(objetivo);
  const desde = useRef(objetivo);

  useEffect(() => {
    const inicio = desde.current;
    if (inicio === objetivo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      desde.current = objetivo;
      setValor(objetivo);
      return;
    }
    const t0 = performance.now();
    let marco = 0;
    const paso = (t: number) => {
      const avance = Math.min((t - t0) / 450, 1);
      const suave = 1 - (1 - avance) ** 3;
      const actual = inicio + (objetivo - inicio) * suave;
      desde.current = actual;
      setValor(actual);
      if (avance < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [objetivo]);

  return valor;
}

/**
 * Una métrica ejecutiva: el número, qué significa (ayuda), cómo cambió contra
 * el período anterior, su tendencia y a dónde ir para ver el detalle.
 */
export function KpiCard({
  etiqueta,
  icono: Icono,
  valor,
  formatear,
  sinValor = "—",
  info,
  variacion,
  referencia,
  serie,
  tono = "verde",
  detalle,
  href,
  hrefTexto,
  indice = 0,
}: {
  etiqueta: string;
  icono: LucideIcon;
  /** `null` = no hay valor que dar (p. ej. ticket sin pedidos entregados). */
  valor: number | null;
  formatear: (n: number) => string;
  sinValor?: string;
  info: string;
  variacion: Variacion | null;
  referencia?: string | null;
  serie?: (number | null)[];
  tono?: "verde" | "azul" | "ambar";
  detalle?: ReactNode;
  href?: string;
  hrefTexto?: string;
  indice?: number;
}) {
  const animado = useValorAnimado(valor ?? 0);

  return (
    <article className={`db-kpi db-kpi--${tono}`} style={{ animationDelay: `${indice * 60}ms` }}>
      <div className="db-kpi-cabecera">
        <span className="db-kpi-icono" aria-hidden="true">
          <Icono size={16} strokeWidth={1.9} />
        </span>
        <h3>{etiqueta}</h3>
        <InfoTip texto={info} posicion="abajo" />
      </div>
      <div className="db-kpi-cuerpo">
        <p className={`db-kpi-valor ${valor === null ? "db-kpi-valor--vacio" : ""}`}>
          {valor === null ? sinValor : formatear(animado)}
        </p>
        {serie && <Sparkline valores={serie} tono={tono} />}
      </div>
      <VariacionChip variacion={variacion} referencia={referencia} />
      {detalle && <div className="db-kpi-detalle">{detalle}</div>}
      {href && (
        <Link className="db-kpi-enlace" to={href}>
          {hrefTexto} <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}
