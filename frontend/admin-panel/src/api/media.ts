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

/**
 * Los bytes de un archivo ya subido, para reusarlo en otro formulario.
 *
 * No se piden con `fetch(archivo.url)`: esa URL es del bucket público de R2,
 * que no tiene CORS configurado, y el navegador rechaza la respuesta antes de
 * que el código la vea. Pidiéndolo por `api` en cambio es una petición más al
 * backend de siempre, que sí sabe leer de R2 sin que el navegador se entere.
 */
export async function descargarArchivo(id: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/media/archivos/${id}/contenido/`, {
    responseType: "blob",
  });
  return data;
}
