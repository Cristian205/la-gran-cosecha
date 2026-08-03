import type { ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  footer?: ReactNode;
  ancho?: boolean;
  lateral?: boolean;
}

export function Modal({ titulo, onCerrar, children, footer, ancho, lateral }: Props) {
  return (
    <div
      className={`modal-overlay ${lateral ? "lateral" : ""}`}
      onClick={onCerrar}
    >
      <div
        className={`modal ${ancho ? "ancho" : ""} ${lateral ? "lateral" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{titulo}</h2>
          <button className="cerrar-x" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="cuerpo">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
