import type { Usuario } from "./types";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatoPrecio(valor: number | string): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return cop.format(Number.isFinite(n) ? n : 0);
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatoFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * El dueño (GERENTE/superusuario) siempre puede todo; el resto solo si tiene
 * el permiso puntual asignado. Refleja la misma regla que aplica el backend
 * (`requiere_permiso`), para no mostrar acciones que de todas formas fallarían.
 */
export function tienePermiso(usuario: Usuario | null, codename: string): boolean {
  if (!usuario) return false;
  if (usuario.es_administrador) return true;
  return usuario.permisos.includes(codename);
}

/** Quita tildes y pasa a minúsculas para comparar texto sin importar acentos. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function extraerMensajeError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: Record<string, unknown> } };
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;
  // Errores de validación de DRF: { campo: ["msg"] }
  const primera = Object.values(data)[0];
  if (Array.isArray(primera) && typeof primera[0] === "string") return primera[0];
  return fallback;
}
