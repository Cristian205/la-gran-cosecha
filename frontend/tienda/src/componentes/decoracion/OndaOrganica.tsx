import type { CSSProperties } from "react";

interface Props {
  /** Verde salvia del relleno bajo la curva. */
  relleno?: string;
  /** Verde botánico del trazo y de las hojas. */
  trazo?: string;
  /** Voltea la onda en horizontal: para alternarla entre secciones seguidas. */
  espejo?: boolean;
  /** Sin los ramitos de los extremos. */
  sinHojas?: boolean;
  className?: string;
}

/**
 * Separador de onda orgánica: el lenguaje "de campo" de La Gran Cosecha entre
 * dos secciones, en vez de una línea recta.
 *
 * Tres piezas superpuestas, para que se estire a todo el ancho sin deformar
 * lo que no debe:
 *
 *   · la curva (asimétrica) y su relleno, en un SVG con
 *     `preserveAspectRatio="none"` — se estira a cualquier ancho;
 *   · el trazo fino encima, con `vector-effect: non-scaling-stroke` — sigue
 *     midiendo 1.25 px aunque la curva se estire;
 *   · los ramitos de los extremos, en SVGs propios de tamaño fijo — una
 *     hoja estirada a 1440 px dejaría de parecer una hoja.
 *
 * El relleno se desvanece hacia abajo: se funde con el fondo de la sección
 * siguiente en vez de verse como una franja pegada encima.
 *
 * Decorativo: `aria-hidden`, `pointer-events: none` (en CSS) y sin ancho
 * propio que pueda causar scroll horizontal.
 */
export function OndaOrganica({
  relleno = "#DDEEE0",
  trazo = "#9CBD9E",
  espejo = false,
  sinHojas = false,
  className = "",
}: Props) {
  // Ids estables por color: varias ondas en la página comparten el mismo
  // degradado sin chocar, y el HTML del servidor coincide con el del cliente.
  const id = `onda-relleno-${relleno.replace(/[^a-z0-9]/gi, "")}`;
  const estilo = { "--onda-relleno": relleno, "--onda-trazo": trazo } as CSSProperties;

  return (
    <div className={`onda-organica ${espejo ? "onda-organica--espejo" : ""} ${className}`} style={estilo} aria-hidden="true">
      <svg className="onda-organica-curva" viewBox="0 0 1440 60" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0.3" stopColor={relleno} stopOpacity="1" />
            <stop offset="1" stopColor={relleno} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Encima de la curva: el color de la sección de arriba, si la
            página lo indica (`--onda-arriba`); transparente por defecto.
            Así esa sección "termina en onda" en vez de en una línea recta. */}
        <path className="onda-organica-arriba" d="M0 0H1440V28C1320 18 1190 28 1030 40C840 54 700 39 520 26C330 12 150 22 0 38Z" />
        <path
          className="onda-organica-relleno"
          d="M0 38C150 22 330 12 520 26C700 39 840 54 1030 40C1190 28 1320 18 1440 28V60H0Z"
          fill={`url(#${id})`}
        />
        <path
          d="M0 38C150 22 330 12 520 26C700 39 840 54 1030 40C1190 28 1320 18 1440 28"
          fill="none"
          stroke={trazo}
          strokeWidth="1.25"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {!sinHojas && (
        <>
          <Ramito className="onda-organica-hoja onda-organica-hoja--izq" trazo={trazo} />
          <Ramito className="onda-organica-hoja onda-organica-hoja--der" trazo={trazo} />
        </>
      )}
    </div>
  );
}

/** Un tallo curvo con dos hojas de línea (sin relleno). */
function Ramito({ className, trazo }: { className: string; trazo: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" focusable="false">
      <g fill="none" stroke={trazo} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 30C12 24 20 18 30 6" />
        <path d="M14 22C11 15 13 9 19 6C21 13 19 19 14 22Z" />
        <path d="M22 15C27 10 34 9 40 12C35 17 28 18 22 15Z" />
        <path d="M30 6C31 4 32 3 34 2" />
      </g>
    </svg>
  );
}
