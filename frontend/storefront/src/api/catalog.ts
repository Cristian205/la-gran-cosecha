import { api } from "./client";
import type { Categoria, Paginated, Producto, UnidadMedida } from "../types";

export async function obtenerCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<Paginated<Categoria> | Categoria[]>(
    "/catalog/categories/"
  );
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerUnidades(): Promise<UnidadMedida[]> {
  const { data } = await api.get<Paginated<UnidadMedida> | UnidadMedida[]>(
    "/catalog/units/"
  );
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerProductos(params?: {
  search?: string;
  categoria?: number;
  page?: number;
}): Promise<Paginated<Producto>> {
  const { data } = await api.get<Paginated<Producto>>("/catalog/products/", {
    params: { ...params, page_size: 100 },
  });
  return data;
}
