import { Pastilla, type Tono } from "../../components/gestion/Gestion";
import { diaCorto, fechaLocalISO, sumarDias } from "../../utils/fechas";

// ---------- Estados ----------

/** Los estados reales de `Pedido.ESTADOS` en el backend, con su nombre legible. */
export const ETIQUETAS_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EDITADO: "Editado",
  CERRADO: "Cerrado",
  IMPRESO: "Impreso",
  ENTREGADO: "Entregado",
};

const TONO_ESTADO: Record<string, Tono> = {
  PENDIENTE: "ambar",
  EDITADO: "azul",
  CERRADO: "neutro",
  IMPRESO: "violeta",
  ENTREGADO: "verde",
};

export function EstadoPedido({ estado }: { estado: string }) {
  return <Pastilla tono={TONO_ESTADO[estado] ?? "neutro"}>{ETIQUETAS_ESTADO[estado] ?? estado}</Pastilla>;
}

// ---------- Periodos ----------

export type Periodo = "hoy" | "ayer" | "semana" | "todas" | "rango";

export const OPCIONES_PERIODO: { valor: Periodo; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "ayer", etiqueta: "Ayer" },
  { valor: "semana", etiqueta: "Esta semana" },
  { valor: "todas", etiqueta: "Todas las fechas" },
  { valor: "rango", etiqueta: "Rango personalizado" },
];

/** El periodo traducido a los `desde`/`hasta` que ya entiende `/orders/`. */
export function rangoDelPeriodo(
  periodo: Periodo,
  rangoDesde: string,
  rangoHasta: string
): { desde?: string; hasta?: string } {
  const hoy = new Date();
  switch (periodo) {
    case "hoy":
      return { desde: fechaLocalISO(hoy), hasta: fechaLocalISO(hoy) };
    case "ayer": {
      const ayer = fechaLocalISO(sumarDias(hoy, -1));
      return { desde: ayer, hasta: ayer };
    }
    case "semana": {
      // La semana empieza el lunes, como en el calendario colombiano.
      const lunes = sumarDias(hoy, -((hoy.getDay() + 6) % 7));
      return { desde: fechaLocalISO(lunes), hasta: fechaLocalISO(hoy) };
    }
    case "rango":
      return { desde: rangoDesde || undefined, hasta: rangoHasta || undefined };
    default:
      return {};
  }
}

/** Cómo se nombra el rango elegido en la cabecera de la tabla. */
export function etiquetaPeriodo(periodo: Periodo, desde: string, hasta: string): string {
  if (periodo !== "rango") return OPCIONES_PERIODO.find((o) => o.valor === periodo)?.etiqueta ?? "";
  const f = (iso: string) => diaCorto(new Date(`${iso}T00:00:00`));
  if (desde && hasta) return desde === hasta ? f(desde) : `${f(desde)} – ${f(hasta)}`;
  if (desde) return `Desde ${f(desde)}`;
  if (hasta) return `Hasta ${f(hasta)}`;
  return "Todas las fechas";
}
