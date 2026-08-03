import { Columns3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EstadoColumna } from "../hooks/useColumnas";

interface Props {
  estado: EstadoColumna[];
  etiquetas: Record<string, string>;
  onAlternar: (clave: string) => void;
  onRestablecer: () => void;
}

export function ColumnPickerButton({ estado, etiquetas, onAlternar, onRestablecer }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, []);

  return (
    <div className="columnas-picker" ref={ref}>
      <button type="button" className="btn secundario sm" onClick={() => setAbierto((v) => !v)}>
        <Columns3 size={14} /> Columnas
      </button>
      {abierto && (
        <div className="menu-usuario menu-columnas">
          {estado.map((c) => (
            <label key={c.clave} className="menu-columnas-item">
              <input type="checkbox" checked={c.visible} onChange={() => onAlternar(c.clave)} />
              {etiquetas[c.clave] ?? c.clave}
            </label>
          ))}
          <div className="menu-usuario-sep" />
          <button type="button" onClick={onRestablecer}>
            Restablecer
          </button>
        </div>
      )}
    </div>
  );
}
