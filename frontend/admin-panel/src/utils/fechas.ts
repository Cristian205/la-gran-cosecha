/** AAAA-MM-DD en la hora LOCAL. `toISOString()` da la fecha UTC: en Colombia,
 *  desde las 7 p. m. "hoy" ya era mañana y los filtros se corrían un día. */
export function fechaLocalISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * La fecha de una tabla en formato ISO 8601 y hora LOCAL: «2026-10-23» o, con
 * `conHora`, «2026-10-23 14:05» (24 h). Ordena bien a la vista, no depende del
 * idioma y se compara de un vistazo. Vacío o inválido: «—».
 */
export function fechaISO(iso: string | null | undefined, conHora = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (!conHora) return fechaLocalISO(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${fechaLocalISO(d)} ${hh}:${mi}`;
}

export function hoyISO(): string {
  return fechaLocalISO(new Date());
}

export function sumarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

const fmtHora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const fmtDia =new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
const fmtDiaAnio = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

/** "12 sept" este año, "12 sept 2025" otro año (sin el punto ni los "de" de es-CO). */
export function diaCorto(d: Date): string {
  const f = d.getFullYear() === new Date().getFullYear() ? fmtDia.format(d) : fmtDiaAnio.format(d);
  return f.replace(/\./g, "").replace(/\sde\s/g, " ");
}

/** Fecha y hora compactas: "Hoy · 10:32 a. m.", "Ayer · 4:05 p. m." o "12 sept · 9:10 a. m.". */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = fechaLocalISO(d);
  const hoy = new Date();
  const hora = fmtHora.format(d);
  if (dia === fechaLocalISO(hoy)) return `Hoy · ${hora}`;
  if (dia === fechaLocalISO(sumarDias(hoy, -1))) return `Ayer · ${hora}`;
  return `${diaCorto(d)} · ${hora}`;
}

/** Solo el día, para fechas donde la hora no aporta: "Hoy", "Ayer" o "12 sept 2025". */
export function diaRelativo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = fechaLocalISO(d);
  const hoy = new Date();
  if (dia === fechaLocalISO(hoy)) return "Hoy";
  if (dia === fechaLocalISO(sumarDias(hoy, -1))) return "Ayer";
  return diaCorto(d);
}
