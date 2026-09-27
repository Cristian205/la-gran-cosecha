import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerPanel } from "../../api/resources";
import type { PanelEstadisticas } from "../../types";
import type { Rango } from "./periodo";

/**
 * Los datos del dashboard para un período: una petición, en caché.
 *
 * No hace falta React Query para esto: es UNA consulta por período. La caché
 * vive en el módulo (sobrevive a ir a Pedidos y volver) y un período pedido
 * hace menos de `FRESCO_MS` se pinta sin volver al servidor. Volver a
 * "7 días" después de mirar "30 días" es instantáneo.
 *
 * Mientras llega un período nuevo se siguen mostrando los datos anteriores
 * (`actualizando`), en vez de vaciar la pantalla a esqueletos cada vez que se
 * cambia de pestaña. Los esqueletos son para la primera carga.
 */
const FRESCO_MS = 60_000;
const cache = new Map<string, { datos: PanelEstadisticas; en: number }>();

export type EstadoPanel =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: PanelEstadisticas; actualizando: boolean };

export function usePanel(rango: Rango) {
  const clave = `${rango.desde}|${rango.hasta}`;
  const enCache = cache.get(clave);
  const [estado, setEstado] = useState<EstadoPanel>(
    enCache ? { tipo: "listo", datos: enCache.datos, actualizando: false } : { tipo: "cargando" }
  );
  const [intento, setIntento] = useState(0);
  const ultima = useRef(clave);
  const forzar = useRef(false);

  useEffect(() => {
    ultima.current = clave;
    const guardado = cache.get(clave);
    const forzado = forzar.current;
    forzar.current = false;
    if (guardado) {
      setEstado({ tipo: "listo", datos: guardado.datos, actualizando: false });
      if (Date.now() - guardado.en < FRESCO_MS && !forzado) return;
    }
    setEstado((prev) =>
      prev.tipo === "listo" ? { ...prev, actualizando: true } : { tipo: "cargando" }
    );
    obtenerPanel(rango)
      .then((datos) => {
        cache.set(clave, { datos, en: Date.now() });
        if (ultima.current === clave) setEstado({ tipo: "listo", datos, actualizando: false });
      })
      .catch(() => {
        if (ultima.current !== clave) return;
        setEstado({ tipo: "error", mensaje: "No pudimos cargar los datos del período." });
      });
    // `rango` se usa por su clave: un objeto nuevo con las mismas fechas no
    // debe repetir la petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);

  /** Vuelve a pedir el período ignorando la caché (tras un error o una edición). */
  const recargar = useCallback(() => {
    forzar.current = true;
    setIntento((n) => n + 1);
  }, []);

  return { estado, recargar };
}
