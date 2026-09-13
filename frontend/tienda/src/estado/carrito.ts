import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ItemCarrito, ItemPersonalizado } from "@/lib/tipos";

interface CartState {
  items: ItemCarrito[];
  personalizados: ItemPersonalizado[];
  agregar: (item: ItemCarrito) => void;
  cambiarCantidad: (presentacionId: number, cantidad: number, paso?: number) => void;
  quitar: (presentacionId: number) => void;
  agregarPersonalizado: (item: ItemPersonalizado) => void;
  quitarPersonalizado: (id: string) => void;
  vaciar: () => void;
  totalItems: () => number;
  /** Número de líneas del pedido (productos distintos), no de unidades. */
  totalLineas: () => number;
  totalPrecio: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      personalizados: [],

      agregar: (item) =>
        set((state) => {
          const existente = state.items.find(
            (i) => i.presentacionId === item.presentacionId
          );
          if (existente) {
            return {
              items: state.items.map((i) =>
                i.presentacionId === item.presentacionId
                  ? { ...i, cantidad: i.cantidad + item.cantidad }
                  : i
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      cambiarCantidad: (presentacionId, cantidad, paso = 1) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.presentacionId === presentacionId
              ? { ...i, cantidad: Math.max(paso, cantidad) }
              : i
          ),
        })),

      quitar: (presentacionId) =>
        set((state) => ({
          items: state.items.filter((i) => i.presentacionId !== presentacionId),
        })),

      agregarPersonalizado: (item) =>
        set((state) => ({ personalizados: [...state.personalizados, item] })),

      quitarPersonalizado: (id) =>
        set((state) => ({
          personalizados: state.personalizados.filter((p) => p.id !== id),
        })),

      vaciar: () => set({ items: [], personalizados: [] }),

      totalItems: () =>
        get().items.reduce((acc, i) => acc + i.cantidad, 0) +
        get().personalizados.reduce((acc, p) => acc + p.cantidad, 0),

      // "3 productos" debe significar tres productos distintos. Contar unidades
      // hacía que 1½ libras de un solo producto se anunciaran como "2
      // productos", que es justo lo que el cliente no tiene en el carrito.
      totalLineas: () => get().items.length + get().personalizados.length,

      totalPrecio: () =>
        get().items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0),
    }),
    {
      name: "crynex-carrito",
      // El HTML del servidor no puede conocer lo que hay en el `localStorage`
      // del navegador, asi que siempre sale con el carrito vacio. Sin esto,
      // `persist` rehidrataba en cuanto este modulo se evaluaba en el
      // navegador -antes de que React llegara a comparar el marcado- y la
      // primera pintura del cliente ya mostraba el carrito guardado mientras
      // el HTML del servidor decia que estaba vacio: un desajuste de
      // hidratacion en la insignia del carrito, en la barra movil y en
      // cualquier sitio que leyera `items`/`personalizados` al pintarse.
      //
      // Con esto la primera pintura del cliente coincide con el servidor
      // -vacia- y `CapaCliente` dispara la rehidratacion de verdad despues,
      // ya como una actualizacion de estado normal y no como parte del
      // render inicial.
      skipHydration: true,
    }
  )
);
