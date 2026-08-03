import type { Notificacion, Paginated } from "../types";
import { api } from "./client";

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerNotificaciones(soloNoLeidas = false): Promise<Notificacion[]> {
  const { data } = await api.get<Paginated<Notificacion> | Notificacion[]>("/notifications/", {
    params: { page_size: 100, ...(soloNoLeidas ? { no_leidas: "true" } : {}) },
  });
  return unwrap(data);
}

export async function obtenerResumenNotificaciones(): Promise<{ no_leidas: number }> {
  const { data } = await api.get<{ no_leidas: number }>("/notifications/resumen/");
  return data;
}

export async function marcarNotificacionLeida(id: number): Promise<Notificacion> {
  const { data } = await api.post<Notificacion>(`/notifications/${id}/marcar_leida/`);
  return data;
}

export async function marcarTodasLasNotificacionesLeidas(): Promise<void> {
  await api.post("/notifications/marcar_todas_leidas/");
}
