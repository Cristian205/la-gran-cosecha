"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/estado/carrito";
import { useTienda } from "@/estado/tienda";
import type { ItemCarrito } from "@/lib/tipos";
import { formatoCantidad } from "@/lib/utiles";

/**
 * Agrega al carrito y da el feedback de que funcionó.
 *
 * Dos señales, a propósito: `agregado` (el botón que se convierte en "✓
 * Agregado" unos instantes, en el sitio donde el cliente está mirando) y el
 * aviso global de `useTienda` (qué se agregó exactamente, con "Ver pedido" a
 * mano). La insignia del carrito cambia sola porque lee el mismo store.
 *
 * Lo comparten la tarjeta, la vista rápida, la ficha y las tarjetas de
 * oferta; limpia el temporizador al desmontar porque filtrar reemplaza la
 * grilla entera.
 */
export function useAgregarAlCarrito(duracionMs = 1400) {
  const agregarAlCarrito = useCart((s) => s.agregar);
  const avisar = useTienda((s) => s.avisar);
  const [agregado, setAgregado] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const agregar = useCallback(
    (item: ItemCarrito) => {
      agregarAlCarrito(item);
      avisar({
        nombre: item.productoNombre,
        detalle: `${formatoCantidad(item.cantidad, item.permiteFraccion)} · ${item.presentacionNombre}`,
        imagenUrl: item.imagenUrl,
      });
      setAgregado(true);
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => setAgregado(false), duracionMs);
    },
    [agregarAlCarrito, avisar, duracionMs]
  );

  return { agregar, agregado };
}
