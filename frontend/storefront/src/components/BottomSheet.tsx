import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}

/**
 * Panel que sube desde el borde inferior. Es el patrón natural en móvil para
 * elecciones cortas (ordenar, explicar el precio): queda al alcance del pulgar
 * y no tapa la pantalla como un modal centrado.
 *
 * Reutiliza `.overlay` del carrito lateral para el fondo, así el oscurecido y
 * el z-index se comportan igual en toda la tienda.
 */
export function BottomSheet({ titulo, onCerrar, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alPresionar);
    // El foco entra al panel para que teclado y lector de pantalla no se
    // queden detrás, en el contenido que el panel está tapando.
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  return (
    <>
      <div className="overlay" onClick={onCerrar} />
      <div
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={panelRef}
      >
        <span className="hoja-asa" aria-hidden="true" />
        <header className="hoja-head">
          <h2>{titulo}</h2>
          <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="hoja-cuerpo">{children}</div>
      </div>
    </>
  );
}
