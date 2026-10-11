/**
 * Confirmación de que algo se guardó.
 *
 * En un panel donde una acción cambia lo que ve una empresa entera, "no pasó
 * nada visible" no es aceptable: cada escritura responde con un aviso corto, y
 * los errores se quedan más tiempo porque hay que leerlos.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, X } from "lucide-react";

type TipoAviso = "ok" | "malo";

interface Nota {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

const Contexto = createContext<((texto: string, tipo?: TipoAviso) => void) | null>(null);

const DURACION = { ok: 3200, malo: 6000 };

export function ProveedorNotificaciones({ children }: { children: ReactNode }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const siguiente = useRef(1);

  const avisar = useCallback((texto: string, tipo: TipoAviso = "ok") => {
    const id = siguiente.current++;
    setNotas((previas) => [...previas, { id, tipo, texto }]);
    window.setTimeout(
      () => setNotas((previas) => previas.filter((n) => n.id !== id)),
      DURACION[tipo]
    );
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {notas.map((nota) => (
          <div key={nota.id} className={`nota nota--${nota.tipo}`}>
            {nota.tipo === "ok" ? <Check size={15} /> : <AlertTriangle size={15} />}
            <span>{nota.texto}</span>
            <button
              type="button"
              aria-label="Descartar"
              onClick={() => setNotas((previas) => previas.filter((n) => n.id !== nota.id))}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function usarAviso() {
  const avisar = useContext(Contexto);
  if (!avisar) throw new Error("usarAviso necesita ProveedorNotificaciones.");
  return avisar;
}
