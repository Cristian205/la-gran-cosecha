import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ClienteTiendaState {
  /** La cédula con la que este navegador pidió la última vez (solo dígitos). */
  cedula: string | null;
  /** Cómo saludarlo: el nombre ya enmascarado que devolvió el servidor ("Juan P."). */
  nombre: string | null;
  recordar: (cedula: string, nombre?: string | null) => void;
  olvidar: () => void;
}

/**
 * Quién pide desde este navegador, en tiendas que identifican por cédula.
 *
 * Solo se guarda la cédula y el nombre enmascarado —nunca teléfono ni
 * dirección—: es la comodidad de no volver a escribirla, no una sesión. En un
 * equipo compartido, "¿No eres tú?" la borra.
 */
export const useClienteTienda = create<ClienteTiendaState>()(
  persist(
    (set) => ({
      cedula: null,
      nombre: null,
      recordar: (cedula, nombre = null) => set({ cedula, nombre }),
      olvidar: () => set({ cedula: null, nombre: null }),
    }),
    {
      name: "crynex-cliente",
      // Mismo motivo que `estado/carrito.ts`: el servidor pinta sin cliente y
      // `CapaCliente` rehidrata después de montar.
      skipHydration: true,
    }
  )
);

/** "1.020.345.678" -> "1020345678": lo mismo que guarda el servidor. */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}
