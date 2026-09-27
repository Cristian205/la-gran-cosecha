import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Una métrica principal: el número, qué significa y contra qué se compara.
 *
 * La comparación es honesta por diseño. Un "−100 %" en rojo cuando hoy aún no
 * se ha vendido nada alarma sin informar; por eso los casos sin base (sin
 * ventas ahora, o sin ventas antes) se dicen con palabras y en tono neutro, y
 * el porcentaje solo aparece cuando hay dos números que comparar.
 */
export type Comparacion =
  | { tipo: "sube" | "baja" | "igual"; valor: string; contra: string }
  | { tipo: "neutra"; texto: string };

const UMBRAL_IGUAL = 0.5;

export function comparar(
  actual: number,
  anterior: number,
  contra: string,
  { formatear, sinDatos }: { formatear: (n: number) => string; sinDatos: string }
): Comparacion {
  if (actual === 0 && anterior === 0) return { tipo: "neutra", texto: sinDatos };
  if (actual === 0) return { tipo: "neutra", texto: `Período anterior: ${formatear(anterior)}` };
  if (anterior === 0) return { tipo: "neutra", texto: "Sin datos del período anterior para comparar" };
  const pct = ((actual - anterior) / anterior) * 100;
  if (Math.abs(pct) < UMBRAL_IGUAL) return { tipo: "igual", valor: "Igual", contra };
  const texto = `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1).replace(".", ",")} %`;
  return { tipo: pct > 0 ? "sube" : "baja", valor: texto, contra };
}

/** Diferencia en unidades ("+3 vs. …") para conteos pequeños, donde un % engaña. */
export function compararConteo(actual: number, anterior: number, contra: string, sinDatos: string): Comparacion {
  if (actual === 0 && anterior === 0) return { tipo: "neutra", texto: sinDatos };
  const dif = actual - anterior;
  if (dif === 0) return { tipo: "igual", valor: "Igual", contra };
  return { tipo: dif > 0 ? "sube" : "baja", valor: `${dif > 0 ? "+" : "−"}${Math.abs(dif)}`, contra };
}

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

const ICONO_DE = { sube: ArrowUpRight, baja: ArrowDownRight, igual: Minus } as const;

export function KpiCard({
  etiqueta,
  icono: Icono,
  valor,
  formatear,
  sinValor,
  detalle,
  comparacion,
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
  detalle?: ReactNode;
  comparacion?: Comparacion;
  href?: string;
  hrefTexto?: string;
  indice?: number;
}) {
  const animado = useValorAnimado(valor ?? 0);

  return (
    <article className="db-kpi" style={{ animationDelay: `${indice * 60}ms` }}>
      <div className="db-kpi-cabecera">
        <span className="db-kpi-icono" aria-hidden="true">
          <Icono size={16} />
        </span>
        <h3>{etiqueta}</h3>
      </div>
      <p className={`db-kpi-valor ${valor === null ? "db-kpi-valor--vacio" : ""}`}>
        {valor === null ? sinValor ?? "—" : formatear(animado)}
      </p>
      {detalle && <div className="db-kpi-detalle">{detalle}</div>}
      {comparacion && <Tendencia comparacion={comparacion} />}
      {href && (
        <Link className="db-kpi-enlace" to={href}>
          {hrefTexto} <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

function Tendencia({ comparacion }: { comparacion: Comparacion }) {
  if (comparacion.tipo === "neutra") return <p className="db-tendencia db-tendencia--neutra">{comparacion.texto}</p>;
  const Icono = ICONO_DE[comparacion.tipo];
  return (
    <p className={`db-tendencia db-tendencia--${comparacion.tipo}`}>
      <span className="db-tendencia-chip">
        <Icono size={13} aria-hidden="true" />
        {comparacion.valor}
      </span>
      <span>{comparacion.contra}</span>
    </p>
  );
}
