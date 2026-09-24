"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `true` durante un instante cada vez que `valor` cambia (salvo en la primera
 * pintura). Es el "el carrito respondió" de las barras de pedido: cambian
 * líneas o cantidades y la barra da un pequeño salto, sin que cada una
 * repita su propio par de efectos y temporizadores.
 */
export function useRebote(valor: unknown, duracionMs = 360): boolean {
  const [activo, setActivo] = useState(false);
  const anterior = useRef(valor);

  useEffect(() => {
    if (Object.is(anterior.current, valor)) return;
    anterior.current = valor;
    setActivo(true);
    const t = window.setTimeout(() => setActivo(false), duracionMs);
    return () => window.clearTimeout(t);
  }, [valor, duracionMs]);

  return activo;
}
