import { useSyncExternalStore } from "react";
import type { Solucion } from "../contenido/tipos";

/**
 * Qué modalidad dijo la persona que le interesa («Crear mi tienda» →
 * Commerce). Es un estado de toda la página, no de una escena: el botón de la
 * escena 02 y el formulario de la 08 están lejos y no se conocen.
 */
interface Estado {
  solucion: Solucion | null;
  origen: string | null;
}

let estado: Estado = { solucion: null, origen: null };
const oyentes = new Set<() => void>();

export function elegirSolucion(solucion: Solucion, origen: string): void {
  estado = { solucion, origen };
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function usarSolucionElegida(): Estado {
  return useSyncExternalStore(suscribir, () => estado, () => estado);
}
