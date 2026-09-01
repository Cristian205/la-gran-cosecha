/**
 * Formato de números y fechas.
 *
 * Todo en un sitio porque las cifras son lo que más se lee en este panel: si
 * un MRR se escribe distinto en la tarjeta y en la tabla, deja de poder
 * compararse de un vistazo.
 */

const ES = "es-CO";

/** Precio sin decimales: los planes se cobran en pesos redondos. */
export function moneda(valor: number | string, divisa = "COP"): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  const simbolo = divisa === "COP" || divisa === "USD" ? "$" : "";
  return `${simbolo}${n.toLocaleString(ES, { maximumFractionDigits: 0 })}`;
}

export function numero(n: number): string {
  return n.toLocaleString(ES);
}

export function porcentaje(parte: number, total: number, decimales = 1): string {
  if (!total) return "—";
  return `${((parte / total) * 100).toFixed(decimales)}%`;
}

/** Megabytes a la unidad que se lee mejor. */
export function tamano(mb: number | null | undefined): string {
  if (mb == null) return "sin límite";
  if (mb >= 1024)
    return `${(mb / 1024).toLocaleString(ES, { maximumFractionDigits: 1 })} GB`;
  return `${numero(mb)} MB`;
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(ES, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Días entre hoy y una fecha; negativo si ya pasó. */
export function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const dia = 86_400_000;
  const destino = new Date(iso).setHours(0, 0, 0, 0);
  const hoy = new Date().setHours(0, 0, 0, 0);
  return Math.round((destino - hoy) / dia);
}

/** "hace 3 días" / "en 5 días": la forma en que se piensa una renovación. */
export function relativo(iso: string): string {
  const dias = diasHasta(iso);
  if (dias === null) return "—";
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 0) {
    if (dias < 30) return `en ${dias} días`;
    if (dias < 365) return `en ${Math.round(dias / 30)} meses`;
    return `en ${Math.round(dias / 365)} años`;
  }
  const pasados = Math.abs(dias);
  if (pasados < 30) return `hace ${pasados} días`;
  if (pasados < 365) return `hace ${Math.round(pasados / 30)} meses`;
  return `hace ${Math.round(pasados / 365)} años`;
}

/** La hora sola, para una línea de tiempo del mismo día. */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString(ES, { hour: "2-digit", minute: "2-digit" });
}

export function saludo(nombre: string | undefined): string {
  const h = new Date().getHours();
  const momento = h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  const pila = (nombre ?? "").trim().split(/\s+/)[0];
  return pila ? `${momento}, ${pila}.` : `${momento}.`;
}

/** Iniciales para un avatar sin foto. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
