import { useEffect, useState } from "react";

export interface EstadoColumna {
  clave: string;
  visible: boolean;
}

function estadoInicial(guardado: string | null, columnasDefault: string[]): EstadoColumna[] {
  if (guardado) {
    try {
      const parsed: EstadoColumna[] = JSON.parse(guardado);
      if (Array.isArray(parsed)) {
        // Descarta claves que ya no existen y agrega al final las nuevas que
        // se hayan sumado a la tabla desde la última vez que se guardó.
        const conocidas = parsed.filter((c) => columnasDefault.includes(c.clave));
        const claves = new Set(conocidas.map((c) => c.clave));
        const nuevas = columnasDefault
          .filter((clave) => !claves.has(clave))
          .map((clave) => ({ clave, visible: true }));
        return [...conocidas, ...nuevas];
      }
    } catch {
      /* localStorage corrupto: usa el default */
    }
  }
  return columnasDefault.map((clave) => ({ clave, visible: true }));
}

/** Recuerda, por tabla, qué columnas están visibles y en qué orden (localStorage, por navegador). */
export function useColumnas(tableKey: string, columnasDefault: string[]) {
  const storageKey = `lgc-columnas-${tableKey}`;

  const [estado, setEstado] = useState<EstadoColumna[]>(() =>
    estadoInicial(localStorage.getItem(storageKey), columnasDefault)
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(estado));
  }, [storageKey, estado]);

  function alternar(clave: string) {
    setEstado((prev) => prev.map((c) => (c.clave === clave ? { ...c, visible: !c.visible } : c)));
  }

  function mover(claveOrigen: string, claveDestino: string) {
    setEstado((prev) => {
      const origenIdx = prev.findIndex((c) => c.clave === claveOrigen);
      const destinoIdx = prev.findIndex((c) => c.clave === claveDestino);
      if (origenIdx === -1 || destinoIdx === -1 || origenIdx === destinoIdx) return prev;
      const next = [...prev];
      const [item] = next.splice(origenIdx, 1);
      next.splice(destinoIdx, 0, item);
      return next;
    });
  }

  function restablecer() {
    setEstado(columnasDefault.map((clave) => ({ clave, visible: true })));
  }

  const visibles = estado.filter((c) => c.visible).map((c) => c.clave);

  return {
    estado,
    visibles,
    esVisible: (clave: string) => estado.find((c) => c.clave === clave)?.visible ?? false,
    alternar,
    mover,
    restablecer,
  };
}
