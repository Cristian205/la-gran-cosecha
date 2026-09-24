import { create } from "zustand";
import type { Producto } from "@/lib/tipos";

/**
 * Estado efímero de la experiencia de compra: el aviso de "agregado" y la
 * vista rápida de un producto. No se persiste —a diferencia del carrito— y no
 * vive en `CatalogoContexto` porque las dos cosas ocurren también fuera del
 * catálogo: una tarjeta del Inicio o de "También te puede interesar" agrega y
 * abre la vista rápida igual que una de /tienda.
 */

export interface AvisoAgregado {
  /** Cambia en cada aviso, aunque sea el mismo producto: es lo que reinicia
   *  el temporizador y la animación de entrada. */
  id: number;
  nombre: string;
  /** "2 · Tommy · Kilogramo" — qué se agregó exactamente. */
  detalle: string;
  imagenUrl: string | null;
}

interface EstadoTienda {
  aviso: AvisoAgregado | null;
  avisar: (aviso: Omit<AvisoAgregado, "id">) => void;
  cerrarAviso: () => void;

  vistaRapida: Producto | null;
  abrirVistaRapida: (producto: Producto) => void;
  cerrarVistaRapida: () => void;
}

let siguienteId = 1;

export const useTienda = create<EstadoTienda>()((set) => ({
  aviso: null,
  avisar: (aviso) => set({ aviso: { ...aviso, id: siguienteId++ } }),
  cerrarAviso: () => set({ aviso: null }),

  vistaRapida: null,
  abrirVistaRapida: (producto) => set({ vistaRapida: producto }),
  cerrarVistaRapida: () => set({ vistaRapida: null }),
}));
