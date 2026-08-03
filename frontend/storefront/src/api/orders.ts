import { api } from "./client";
import type { ItemCarrito, ItemPersonalizado, RespuestaPedido } from "../types";

export interface DatosCliente {
  nombre: string;
  telefono?: string;
  direccion?: string;
}

export async function crearPedido(
  cliente: DatosCliente,
  items: ItemCarrito[],
  observaciones = "",
  personalizados: ItemPersonalizado[] = []
): Promise<RespuestaPedido> {
  const payload = {
    cliente,
    items: items.map((i) => ({
      presentacion_id: i.presentacionId,
      cantidad: i.cantidad,
    })),
    personalizados: personalizados.map((p) => ({
      nombre: p.nombre,
      cantidad: p.cantidad,
      unidad_id: p.unidadId ?? undefined,
      categoria_id: p.categoriaId,
    })),
    observaciones,
  };
  const { data } = await api.post<RespuestaPedido>("/orders/", payload);
  return data;
}
