/**
 * Los usuarios de todas las empresas, juntos.
 *
 * La API los sirve por empresa (`/platform/tenants/:id/equipo/`), porque cada
 * equipo es de un negocio. Para verlos en una sola lista se piden en paralelo
 * y se guardan en memoria unos minutos: el buscador y la pantalla de usuarios
 * los comparten sin pedirlos dos veces.
 */
import { useEffect, useState } from "react";
import type { MiembroEquipo, Negocio } from "../api/tipos";
import { usarPlataforma } from "./plataforma";

export interface Miembro extends MiembroEquipo {
  negocioId: number;
  negocio: string;
}

const VIGENCIA = 5 * 60_000;
let cache: { clave: string; en: number; filas: Miembro[] } | null = null;
let pendiente: Promise<Miembro[]> | null = null;

function claveDe(negocios: Negocio[]): string {
  return negocios.map((n) => `${n.id}:${n.usuarios}`).join(",");
}

export function usarEquipos(activo = true) {
  const { negocios, equipoDe, cargando: cargandoPlataforma } = usarPlataforma();
  const clave = claveDe(negocios);
  const vigente = cache && cache.clave === clave && Date.now() - cache.en < VIGENCIA;
  const [filas, setFilas] = useState<Miembro[]>(vigente ? cache!.filas : []);
  const [cargando, setCargando] = useState(!vigente);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activo || cargandoPlataforma) return;
    if (cache && cache.clave === clave && Date.now() - cache.en < VIGENCIA) {
      setFilas(cache.filas);
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    pendiente ??= Promise.all(
      negocios.map(async (n) =>
        (await equipoDe(n.id)).map((m) => ({ ...m, negocioId: n.id, negocio: n.nombre }))
      )
    )
      .then((grupos) => {
        const todas = grupos.flat();
        cache = { clave, en: Date.now(), filas: todas };
        return todas;
      })
      .finally(() => {
        pendiente = null;
      });
    pendiente
      .then((todas) => vivo && setFilas(todas))
      .catch((e: Error) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [activo, clave, cargandoPlataforma, negocios, equipoDe]);

  return { filas, cargando, error };
}
