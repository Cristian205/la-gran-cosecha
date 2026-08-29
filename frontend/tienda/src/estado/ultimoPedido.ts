import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ItemCarrito } from "@/lib/tipos";

interface UltimoPedidoState {
  items: ItemCarrito[];
  fecha: string | null;
  guardar: (items: ItemCarrito[]) => void;
}

/** Recuerda el último pedido confirmado en este navegador para poder repetirlo en un clic. */
export const useUltimoPedido = create<UltimoPedidoState>()(
  persist(
    (set) => ({
      items: [],
      fecha: null,
      guardar: (items) => set({ items, fecha: new Date().toISOString() }),
    }),
    { name: "lgc-ultimo-pedido" }
  )
);
