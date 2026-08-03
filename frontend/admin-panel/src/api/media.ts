import type { Archivo, Paginated } from "../types";
import { api } from "./client";

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerArchivos(params?: {
  tipo?: Archivo["tipo"];
  search?: string;
}): Promise<Archivo[]> {
  const { data } = await api.get<Paginated<Archivo> | Archivo[]>("/media/archivos/", {
    params: { ...params, page_size: 100 },
  });
  return unwrap(data);
}

export async function subirArchivo(archivo: File, nombreOriginal?: string): Promise<Archivo> {
  const form = new FormData();
  form.append("archivo", archivo);
  if (nombreOriginal) form.append("nombre_original", nombreOriginal);
  const { data } = await api.post<Archivo>("/media/archivos/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function renombrarArchivo(id: number, nombre: string): Promise<Archivo> {
  const { data } = await api.patch<Archivo>(`/media/archivos/${id}/`, {
    nombre_original: nombre,
  });
  return data;
}

export async function eliminarArchivo(id: number): Promise<void> {
  await api.delete(`/media/archivos/${id}/`);
}
