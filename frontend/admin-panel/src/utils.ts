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
 * El dueño (GERENTE/superusuario) siempre puede todo dentro de lo que su
 * negocio contrató; el resto solo si además tiene el permiso puntual
 * asignado. El plan manda primero y para todos, dueño incluido: un negocio
 * en el plan Starter no debería ver Reservas en el menú solo porque quien
 * entró es el dueño de la cuenta.
 *
 * Esto solo decide qué ENSEÑA el panel. El backend (`requiere_permiso`)
 * todavía no comprueba el plan en la propia API — ver el comentario de
 * `UsuarioSerializer.get_permisos_del_plan` en el backend.
 */
export function tienePermiso(usuario: Usuario | null, codename: string): boolean {
  if (!usuario) return false;
  if (!usuario.permisos_del_plan.includes(codename)) return false;
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
  // 409 y otros errores sin campo: DRF los manda como lista suelta.
  if (Array.isArray(data) && typeof data[0] === "string") return data[0];
  if (typeof data.message === "string") return data.message;
  if (typeof data.mensaje === "string") return data.mensaje;
  if (typeof data.detail === "string") return data.detail;
  // Errores de validación de DRF: { campo: ["msg"] }, o anidados como
  // { presentaciones: [{}, { precio_unitario: ["msg"] }] }.
  return primerMensaje(data) ?? fallback;
}

function primerMensaje(valor: unknown, profundidad = 0): string | null {
  if (typeof valor === "string") return valor || null;
  if (profundidad > 4 || !valor || typeof valor !== "object") return null;
  for (const v of Array.isArray(valor) ? valor : Object.values(valor)) {
    const m = primerMensaje(v, profundidad + 1);
    if (m) return m;
  }
  return null;
}
