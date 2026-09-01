/**
 * Diálogos.
 *
 * `Modal` es el contenedor; `Confirmar` es el caso que más importa en un panel
 * como este: suspender una empresa o moverla de plan afecta a gente que no está
 * mirando la pantalla. Por eso `Confirmar` obliga a decir a quién afecta y qué
 * va a pasar, en vez de un "¿estás seguro?" que nadie lee.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Boton } from "./basicos";

export function Modal({
  titulo,
  descripcion,
  ancho = 460,
  onCerrar,
  pie,
  children,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  ancho?: number;
  onCerrar: () => void;
  pie?: ReactNode;
  children?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // El foco entra al diálogo y Escape lo cierra: sin esto el teclado se queda
    // detrás, navegando la página que el modal tapa.
    panel.current?.focus();
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alPulsar);
    document.body.classList.add("sin-scroll");
    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.classList.remove("sin-scroll");
    };
  }, [onCerrar]);

  return (
    <div className="velo" onMouseDown={onCerrar}>
      <div
        ref={panel}
        className="modal"
        style={{ maxWidth: ancho }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof titulo === "string" ? titulo : undefined}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal__cabecera">
          <div>
            <h2>{titulo}</h2>
            {descripcion && <p className="tenue">{descripcion}</p>}
          </div>
          <button
            type="button"
            className="modal__cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>
        {children && <div className="modal__cuerpo">{children}</div>}
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

export function Confirmar({
  titulo,
  /** A quién afecta. Se muestra aparte para que no se lea por encima. */
  afecta,
  consecuencias,
  etiquetaAccion = "Confirmar",
  peligrosa = false,
  trabajando = false,
  onConfirmar,
  onCerrar,
  children,
}: {
  titulo: string;
  afecta?: string;
  consecuencias: ReactNode;
  etiquetaAccion?: string;
  peligrosa?: boolean;
  trabajando?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      ancho={440}
      pie={
        <>
          <Boton onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton
            variante={peligrosa ? "peligro" : "primario"}
            onClick={onConfirmar}
            cargando={trabajando}
          >
            {etiquetaAccion}
          </Boton>
        </>
      }
    >
      {afecta && (
        <p className="confirmar__afecta">
          <span className="tenue">Afecta a</span>
          <strong>{afecta}</strong>
        </p>
      )}
      {children}
      <div className="confirmar__consecuencias">{consecuencias}</div>
    </Modal>
  );
}
