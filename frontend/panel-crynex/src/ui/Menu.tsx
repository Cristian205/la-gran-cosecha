/**
 * Menú contextual.
 *
 * Las filas de la tabla de empresas tienen cinco acciones posibles y ninguna se
 * usa a diario; sacarlas todas a botones llenaría la fila de ruido. El menú las
 * guarda detrás de un solo punto de entrada y deja la fila legible.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export function Menu({
  etiqueta = "Acciones",
  disparador,
  alineacion = "derecha",
  children,
}: {
  etiqueta?: string;
  disparador?: ReactNode;
  alineacion?: "izquierda" | "derecha";
  children: (cerrar: () => void) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div className="menu" ref={caja}>
      <button
        type="button"
        className={`menu__disparador ${abierto ? "esta-abierto" : ""}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={disparador ? undefined : etiqueta}
        onClick={() => setAbierto((a) => !a)}
      >
        {disparador ?? <MoreHorizontal size={16} />}
      </button>
      {abierto && (
        <div id={id} role="menu" className={`menu__lista menu__lista--${alineacion}`}>
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  );
}

export function OpcionMenu({
  icono,
  peligrosa = false,
  onClick,
  disabled,
  children,
}: {
  icono?: ReactNode;
  peligrosa?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu__opcion ${peligrosa ? "es-peligrosa" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icono}
      {children}
    </button>
  );
}

export function SeparadorMenu() {
  return <hr className="menu__separador" />;
}
