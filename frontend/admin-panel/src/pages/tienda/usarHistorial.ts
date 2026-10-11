import { useCallback, useRef, useState } from "react";

/**
 * Deshacer y rehacer sobre un valor cualquiera (la composición, el tema).
 *
 * Los cambios que llegan seguidos —escribir un título, arrastrar un deslizador—
 * se funden en un solo paso: deshacer una letra cada vez no sirve de nada. El
 * corte es por tiempo porque el editor no sabe cuándo «terminó» un cambio, y
 * medio segundo es lo que tarda alguien en pasar de un campo a otro.
 *
 * `reiniciar` vacía la pila: al abrir otra página o recuperar una versión, lo
 * de antes ya no se puede deshacer —volvería a una página que no es esta.
 */
const FUSION_MS = 600;
const MAXIMO = 100;

interface Pila<T> {
  pasado: T[];
  presente: T;
  futuro: T[];
}

export function usarHistorial<T>(inicial: T) {
  const [pila, setPila] = useState<Pila<T>>({ pasado: [], presente: inicial, futuro: [] });
  const ultimo = useRef(0);

  const fijar = useCallback((valor: T) => {
    const ahora = Date.now();
    const fundir = ahora - ultimo.current < FUSION_MS;
    ultimo.current = ahora;
    setPila((p) => {
      if (Object.is(valor, p.presente)) return p;
      return {
        pasado: fundir && p.pasado.length > 0 ? p.pasado : [...p.pasado, p.presente].slice(-MAXIMO),
        presente: valor,
        futuro: [],
      };
    });
  }, []);

  const deshacer = useCallback(() => {
    ultimo.current = 0;
    setPila((p) =>
      p.pasado.length === 0
        ? p
        : { pasado: p.pasado.slice(0, -1), presente: p.pasado[p.pasado.length - 1], futuro: [p.presente, ...p.futuro] }
    );
  }, []);

  const rehacer = useCallback(() => {
    ultimo.current = 0;
    setPila((p) =>
      p.futuro.length === 0
        ? p
        : { pasado: [...p.pasado, p.presente], presente: p.futuro[0], futuro: p.futuro.slice(1) }
    );
  }, []);

  const reiniciar = useCallback((valor: T) => {
    ultimo.current = 0;
    setPila({ pasado: [], presente: valor, futuro: [] });
  }, []);

  return {
    valor: pila.presente,
    fijar,
    deshacer,
    rehacer,
    reiniciar,
    puedeDeshacer: pila.pasado.length > 0,
    puedeRehacer: pila.futuro.length > 0,
  };
}
