import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { almacenamientoFuncional } from "@/lib/legal/cookies";
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
    {
      name: "kryonx-ultimo-pedido",
      // Categoría funcional: solo se guarda si la persona la aceptó.
      storage: createJSONStorage(() => almacenamientoFuncional),
      // Mismo motivo que en `estado/carrito.ts`: el servidor siempre pinta
      // `items: []`, y `RepetirPedido` devuelve `null` en ese caso. Sin
      // `skipHydration`, un cliente con un pedido guardado pintaba la tarjeta
      // entera en su primera pasada -antes de que React comparara el
      // marcado- mientras el servidor no habia pintado nada: no es un
      // atributo distinto, es un arbol distinto.
      skipHydration: true,
    }
  )
);
