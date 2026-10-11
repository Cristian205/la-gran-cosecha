/**
 * Menú contextual.
 *
 * Las filas de la tabla de empresas tienen cinco acciones posibles y ninguna se
 * usa a diario; sacarlas todas a botones llenaría la fila de ruido. El menú las
 * guarda detrás de un solo punto de entrada y deja la fila legible.
 *
 * La lista se pinta en `document.body` con posición fija, calculada a partir
 * del botón. Dentro de su contenedor, con `position: absolute`, ensanchaba lo
 * que la rodeara: en la tabla de empresas crecía el carril con scroll (y la
 * recortaba), y en la ficha de la empresa, la página entera. Fuera de él,
 * ningún contenedor la recorta ni la empuja, y aquí se mantiene siempre
 * dentro de la pantalla.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

/** Aire mínimo entre la lista y el borde de la ventana. */
const MARGEN = 8;
/** Separación entre el botón y la lista. */
const SEPARACION = 6;

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
  // Hasta medir la lista no se sabe dónde cabe: se pinta invisible un instante.
  const [estilo, setEstilo] = useState<CSSProperties>({ visibility: "hidden" });
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!abierto) {
      setEstilo({ visibility: "hidden" });
      return;
    }
    const boton = caja.current?.getBoundingClientRect();
    const menu = lista.current;
    if (!boton || !menu) return;
    const ancho = menu.offsetWidth;
    const alto = menu.offsetHeight;

    const deseada = alineacion === "derecha" ? boton.right - ancho : boton.left;
    const left = Math.min(Math.max(MARGEN, deseada), window.innerWidth - ancho - MARGEN);

    // Abajo si cabe; si no, arriba; si tampoco, donde haya más sitio.
    const abajo = boton.bottom + SEPARACION;
    const arriba = boton.top - SEPARACION - alto;
    const cabeAbajo = abajo + alto <= window.innerHeight - MARGEN;
    const top = cabeAbajo || arriba < MARGEN ? Math.min(abajo, Math.max(MARGEN, window.innerHeight - alto - MARGEN)) : arriba;

    setEstilo({ position: "fixed", top, left, right: "auto" });
  }, [abierto, alineacion]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!caja.current?.contains(t) && !lista.current?.contains(t)) cerrar();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    // Con posición fija, al desplazar la página la lista se quedaría lejos de
    // su botón: se cierra, como cualquier menú del sistema.
    const alDesplazar = (e: Event) => {
      if (!lista.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", alDesplazar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", alDesplazar, true);
      window.removeEventListener("resize", cerrar);
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
      {abierto &&
        createPortal(
          <div
            id={id}
            ref={lista}
            role="menu"
            className={`menu__lista menu__lista--${alineacion}`}
            style={estilo}
          >
            {children(() => setAbierto(false))}
          </div>,
          document.body
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
