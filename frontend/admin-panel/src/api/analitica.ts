import { api } from "./client";
import type { Modulos, NombreModulo } from "../pages/dashboard/tipos";

/**
 * El dashboard ejecutivo: un endpoint por módulo (`/admin/analitica/<modulo>/`).
 *
 * Todos reciben los mismos parámetros del filtro global (`desde`, `hasta`,
 * `comparar`) más los propios de cada módulo (`orden`, `categoria`, `limite`…).
 */
export type ParametrosAnalitica = Record<string, string | number | undefined>;

export async function obtenerModulo<M extends NombreModulo>(
  modulo: M,
  params: ParametrosAnalitica,
  señal?: AbortSignal
): Promise<Modulos[M]> {
  const { data } = await api.get<Modulos[M]>(`/admin/analitica/${modulo}/`, { params, signal: señal });
  return data;
}
