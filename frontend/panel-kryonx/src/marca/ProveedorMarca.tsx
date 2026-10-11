/**
 * Las marcas que este panel conoce y cuál está publicada.
 *
 * Kryon X siempre existe. Las demás se crean desde White Label y, hasta que el
 * backend tenga un modelo de marcas, se guardan en este navegador: la interfaz
 * lo dice donde se publican, para que nadie crea que un cliente ya las ve. El
 * día que exista el endpoint, lo que cambia es `leer`/`escribir`, no las
 * pantallas que usan este contexto.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MARCA_KRYON } from "./kryon";
import { aplicarMarca } from "./motor";
import type { Marca } from "./tipos";

const CLAVE_MARCAS = "kryonx_marcas";
const CLAVE_ACTIVA = "kryonx_marca_activa";

interface ContextoMarca {
  marcas: Marca[];
  activa: Marca;
  guardar: (marca: Marca) => void;
  eliminar: (id: string) => void;
  publicar: (id: string) => void;
  /** Si Kryon X tiene ajustes sobre sus valores de fábrica. */
  kryonModificada: boolean;
  /** Devuelve Kryon X a sus valores de fábrica. */
  restablecerKryon: () => void;
}

const Contexto = createContext<ContextoMarca | null>(null);

function leer(): Marca[] {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_MARCAS) ?? "[]");
    return Array.isArray(crudo) ? (crudo as Marca[]) : [];
  } catch {
    return [];
  }
}

function escribir(marcas: Marca[]): void {
  try {
    localStorage.setItem(CLAVE_MARCAS, JSON.stringify(marcas));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena) la marca vive mientras
    // dure la pestaña; no es motivo para romper el panel.
  }
}

export function ProveedorMarca({ children }: { children: ReactNode }) {
  // Kryon X puede tener ajustes guardados: se mezclan sobre la de fábrica, que
  // conserva siempre su id y su condición de marca del sistema.
  const [propias, setPropias] = useState<Marca[]>(leer);
  const [activaId, setActivaId] = useState<string>(() => {
    try {
      return localStorage.getItem(CLAVE_ACTIVA) ?? MARCA_KRYON.id;
    } catch {
      return MARCA_KRYON.id;
    }
  });

  const marcas = useMemo(() => {
    const ajusteKryon = propias.find((m) => m.id === MARCA_KRYON.id);
    const kryon = ajusteKryon ? { ...ajusteKryon, sistema: true } : MARCA_KRYON;
    return [kryon, ...propias.filter((m) => m.id !== MARCA_KRYON.id)];
  }, [propias]);

  const activa = marcas.find((m) => m.id === activaId) ?? marcas[0];

  useEffect(() => aplicarMarca(activa), [activa]);

  const guardar = useCallback((marca: Marca) => {
    setPropias((previas) => {
      const siguientes = previas.some((m) => m.id === marca.id)
        ? previas.map((m) => (m.id === marca.id ? marca : m))
        : [...previas, marca];
      escribir(siguientes);
      return siguientes;
    });
  }, []);

  const eliminar = useCallback(
    (id: string) => {
      if (id === MARCA_KRYON.id) return;
      setPropias((previas) => {
        const siguientes = previas.filter((m) => m.id !== id);
        escribir(siguientes);
        return siguientes;
      });
      if (activaId === id) {
        setActivaId(MARCA_KRYON.id);
        try {
          localStorage.setItem(CLAVE_ACTIVA, MARCA_KRYON.id);
        } catch {
          // La marca vuelve a Kryon X en esta pestaña igualmente.
        }
      }
    },
    [activaId]
  );

  const publicar = useCallback((id: string) => {
    setActivaId(id);
    try {
      localStorage.setItem(CLAVE_ACTIVA, id);
    } catch {
      // Igual que al guardar: la marca queda publicada en esta pestaña.
    }
  }, []);

  const kryonModificada = propias.some((m) => m.id === MARCA_KRYON.id);
  const restablecerKryon = useCallback(() => {
    setPropias((previas) => {
      const siguientes = previas.filter((m) => m.id !== MARCA_KRYON.id);
      escribir(siguientes);
      return siguientes;
    });
  }, []);

  const valor = useMemo(
    () => ({ marcas, activa, guardar, eliminar, publicar, kryonModificada, restablecerKryon }),
    [marcas, activa, guardar, eliminar, publicar, kryonModificada, restablecerKryon]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usarMarca(): ContextoMarca {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usarMarca necesita ProveedorMarca.");
  return valor;
}

