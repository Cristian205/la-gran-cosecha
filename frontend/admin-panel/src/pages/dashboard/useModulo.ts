import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerModulo, type ParametrosAnalitica } from "../../api/analitica";
import { useFiltros } from "./filtros";
import type { Modulos, NombreModulo } from "./tipos";

/**
 * Los datos de UN módulo del dashboard para el filtro global vigente.
 *
 * Cada módulo carga por su cuenta: una consulta lenta (el ranking de un año)
 * no retiene los KPI, y cambiar el orden del ranking no vuelve a pedir la
 * gráfica de ventas.
 *
 * - Caché en el módulo JS (sobrevive a ir a Pedidos y volver): lo pedido hace
 *   menos de `FRESCO_MS` se pinta sin volver al servidor.
 * - Mientras llega un período nuevo se siguen mostrando los datos anteriores
 *   (`actualizando`); los esqueletos son solo para la primera carga.
 * - Dos componentes que piden lo mismo a la vez (la cabecera y los KPI leen
 *   `resumen`) comparten UNA petición en curso.
 * - Si el período cambia antes de que llegue una respuesta, esa respuesta se
 *   descarta (no pisa la del período nuevo).
 * - Al cambiar de negocio la página se recarga entera (ver AuthContext), así
 *   que la caché nunca mezcla negocios.
 */
const FRESCO_MS = 60_000;
const cache = new Map<string, { datos: unknown; en: number }>();
const enCurso = new Map<string, Promise<unknown>>();

function pedir<M extends NombreModulo>(modulo: M, params: ParametrosAnalitica, clave: string): Promise<Modulos[M]> {
  const pendiente = enCurso.get(clave);
  if (pendiente) return pendiente as Promise<Modulos[M]>;
  const promesa = obtenerModulo(modulo, params)
    .then((datos) => {
      cache.set(clave, { datos, en: Date.now() });
      return datos;
    })
    .finally(() => enCurso.delete(clave));
  enCurso.set(clave, promesa);
  return promesa;
}

export type EstadoModulo<T> =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: T; actualizando: boolean };

export function useModulo<M extends NombreModulo>(
  modulo: M,
  extra: ParametrosAnalitica = {},
  { habilitado = true, sinPeriodo = false }: { habilitado?: boolean; sinPeriodo?: boolean } = {}
) {
  const { params, version } = useFiltros();
  const todos = sinPeriodo ? extra : { ...params, ...extra };
  const clave = `${modulo}?${JSON.stringify(todos)}`;

  const [estado, setEstado] = useState<EstadoModulo<Modulos[M]>>(() => {
    const guardado = cache.get(clave);
    return guardado
      ? { tipo: "listo", datos: guardado.datos as Modulos[M], actualizando: false }
      : { tipo: "cargando" };
  });
  const [intento, setIntento] = useState(0);
  // Qué versión e intento ya se atendieron: si cambian, se ignora la caché.
  const vistos = useRef({ version, intento });

  useEffect(() => {
    if (!habilitado) return;
    const forzado = vistos.current.version !== version || vistos.current.intento !== intento;
    vistos.current = { version, intento };
    const guardado = cache.get(clave);
    if (guardado) {
      setEstado({ tipo: "listo", datos: guardado.datos as Modulos[M], actualizando: false });
      if (!forzado && Date.now() - guardado.en < FRESCO_MS) return;
    }
    setEstado((prev) => (prev.tipo === "listo" ? { ...prev, actualizando: true } : { tipo: "cargando" }));

    let vigente = true;
    pedir(modulo, todos, clave)
      .then((datos) => {
        if (vigente) setEstado({ tipo: "listo", datos, actualizando: false });
      })
      .catch((error) => {
        if (!vigente) return;
        const detalle = error?.response?.data?.detail;
        setEstado({
          tipo: "error",
          mensaje: typeof detalle === "string" ? detalle : "No pudimos cargar esta sección.",
        });
      });
    return () => {
      vigente = false;
    };
    // `todos` se usa por su clave: un objeto nuevo con los mismos valores no
    // debe repetir la petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, version, intento, habilitado]);

  /** Vuelve a pedir ignorando la caché (tras un error o una edición). */
  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { estado, recargar };
}

/** Los datos si ya llegaron (aunque se esté actualizando), o `null`. */
export function datosDe<T>(estado: EstadoModulo<T>): T | null {
  return estado.tipo === "listo" ? estado.datos : null;
}
