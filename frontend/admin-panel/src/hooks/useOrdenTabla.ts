import { useState } from "react";

export type DireccionOrden = "asc" | "desc";
export type ExtractoresOrden<T> = Record<string, (fila: T) => string | number | null>;

/** Orden ascendente/descendente por columna, aplicado del lado del cliente. */
export function useOrdenTabla<T>() {
  const [columna, setColumna] = useState<string | null>(null);
  const [direccion, setDireccion] = useState<DireccionOrden>("asc");

  function alternarColumna(clave: string) {
    if (columna !== clave) {
      setColumna(clave);
      setDireccion("asc");
    } else {
      setDireccion((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  function ordenar(filas: T[], extractores: ExtractoresOrden<T>): T[] {
    const extraer = columna ? extractores[columna] : undefined;
    if (!extraer) return filas;

    const factor = direccion === "asc" ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = extraer(a);
      const vb = extraer(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "es") * factor;
    });
  }

  return { columna, direccion, alternarColumna, ordenar };
}
