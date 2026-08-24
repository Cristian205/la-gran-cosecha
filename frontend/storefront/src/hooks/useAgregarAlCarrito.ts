import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "../store/cart";
import type { ItemCarrito } from "../types";

/**
 * Agrega al carrito y expone el estado "¡Agregado!" que dura unos instantes.
 * Lo comparten ProductCard y las tarjetas de oferta, que antes repetían el
 * mismo par setState/setTimeout; además limpia el temporizador al desmontar,
 * cosa que faltaba y ahora importa porque filtrar reemplaza la grilla entera.
 */
export function useAgregarAlCarrito(duracionMs = 1400) {
  const agregarAlCarrito = useCart((s) => s.agregar);
  const [agregado, setAgregado] = useState(false);
  const temporizador = useRef<number>();

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const agregar = useCallback(
    (item: ItemCarrito) => {
      agregarAlCarrito(item);
      setAgregado(true);
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => setAgregado(false), duracionMs);
    },
    [agregarAlCarrito, duracionMs]
  );

  return { agregar, agregado };
}
