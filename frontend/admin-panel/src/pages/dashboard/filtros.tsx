import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { rangoDesdePreset, type Preset, type Rango } from "./periodo";

/**
 * El filtro GLOBAL del dashboard: período, comparación y una «versión» que se
 * incrementa para pedir datos frescos.
 *
 * Es el único sitio donde vive el período. Ningún módulo tiene su propio
 * selector de fechas: todos leen de aquí, así que no pueden contradecirse.
 * Lo que sí tiene cada módulo son sus filtros propios que no son de fecha
 * (el orden del ranking, la métrica de la gráfica).
 */
interface Filtros {
  preset: Preset;
  rango: Rango;
  comparar: boolean;
  /** Sube al pulsar «Actualizar»: los módulos vuelven al servidor. */
  version: number;
  cambiarPeriodo: (preset: Preset, rango: Rango) => void;
  setComparar: (valor: boolean) => void;
  actualizar: () => void;
  /** Los parámetros que viajan a cada endpoint. */
  params: { desde: string; hasta: string; comparar: 0 | 1 };
}

const Contexto = createContext<Filtros | null>(null);

const CLAVE = "kryonx-dashboard-filtros";
/** Cada cuánto se refrescan solos los datos con la pestaña a la vista. */
const AUTO_MS = 5 * 60_000;

function leerPreferencia(): { preset: Preset; comparar: boolean } {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
    const preset: Preset = guardado.preset && guardado.preset !== "personalizado" ? guardado.preset : "30d";
    return { preset, comparar: guardado.comparar !== false };
  } catch {
    return { preset: "30d", comparar: true };
  }
}

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [inicial] = useState(leerPreferencia);
  const [preset, setPreset] = useState<Preset>(inicial.preset);
  const [rango, setRango] = useState<Rango>(() =>
    rangoDesdePreset(inicial.preset as Exclude<Preset, "personalizado">)
  );
  const [comparar, setComparar] = useState(inicial.comparar);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    try {
      // El rango personalizado no se recuerda: mañana ya no sería el mismo.
      localStorage.setItem(CLAVE, JSON.stringify({ preset: preset === "personalizado" ? "30d" : preset, comparar }));
    } catch {
      // Navegación privada: solo se pierde el recuerdo.
    }
  }, [preset, comparar]);

  const actualizar = useCallback(() => setVersion((v) => v + 1), []);

  // Actualización controlada: cada 5 minutos, solo si la pestaña se ve, y al
  // volver a ella después de ese tiempo. Nada de sondeos constantes.
  useEffect(() => {
    let ultima = Date.now();
    const tocar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultima >= AUTO_MS) {
        ultima = Date.now();
        actualizar();
      }
    };
    const intervalo = window.setInterval(tocar, AUTO_MS);
    document.addEventListener("visibilitychange", tocar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", tocar);
    };
  }, [actualizar]);

  const cambiarPeriodo = useCallback((p: Preset, r: Rango) => {
    setPreset(p);
    setRango(r);
  }, []);

  const valor = useMemo<Filtros>(
    () => ({
      preset,
      rango,
      comparar,
      version,
      cambiarPeriodo,
      setComparar,
      actualizar,
      params: { desde: rango.desde, hasta: rango.hasta, comparar: comparar ? 1 : 0 },
    }),
    [preset, rango, comparar, version, cambiarPeriodo, actualizar]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFiltros(): Filtros {
  const filtros = useContext(Contexto);
  if (!filtros) throw new Error("useFiltros fuera de <FiltrosProvider>");
  return filtros;
}
