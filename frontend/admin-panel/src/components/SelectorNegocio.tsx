import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const ETIQUETAS_ROL: Record<string, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  STAFF: "Personal",
};

/**
 * Cambia el negocio en el que estás trabajando.
 *
 * No se muestra si solo trabajas en uno, que es el caso de casi todo el mundo:
 * un control permanente para una elección que no existe solo estorba.
 */
export function SelectorNegocio({ colapsado }: { colapsado: boolean }) {
  const { negocios, negocioActivo, cambiarNegocio, cambiandoNegocio } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alPulsarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alPulsarEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alPulsarFuera);
    document.addEventListener("keydown", alPulsarEscape);
    return () => {
      document.removeEventListener("mousedown", alPulsarFuera);
      document.removeEventListener("keydown", alPulsarEscape);
    };
  }, [abierto]);

  if (negocios.length < 2 || !negocioActivo) return null;

  return (
    <div className="selector-negocio" ref={contenedor}>
      <button
        type="button"
        className="selector-negocio-btn"
        onClick={() => setAbierto((v) => !v)}
        disabled={cambiandoNegocio}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title={colapsado ? negocioActivo.nombre : undefined}
      >
        <Building2 size={15} />
        {!colapsado && (
          <>
            <span className="selector-negocio-nombre">{negocioActivo.nombre}</span>
            <ChevronsUpDown size={14} className="selector-negocio-flecha" />
          </>
        )}
      </button>

      {abierto && (
        <ul className="selector-negocio-lista" role="listbox">
          {negocios.map((negocio) => (
            <li key={negocio.uuid}>
              <button
                type="button"
                role="option"
                aria-selected={negocio.activo}
                className={negocio.activo ? "activo" : undefined}
                onClick={() => {
                  setAbierto(false);
                  cambiarNegocio(negocio.slug);
                }}
              >
                <span className="selector-negocio-item">
                  <span>{negocio.nombre}</span>
                  <small>{ETIQUETAS_ROL[negocio.rol] ?? negocio.rol}</small>
                </span>
                {negocio.activo && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
