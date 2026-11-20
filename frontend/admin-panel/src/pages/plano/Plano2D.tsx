import { useMemo, useRef, useState } from "react";
import type { GrupoCarga, Posicion, Rejilla } from "../../api/logistica";
import { contenidoPila, filaDePila } from "./acomodo";

/**
 * Plano superior 2D: la MISMA geometría que el visor 3D y el PDF (las pilas
 * del esquema del servidor). Cabina a la izquierda, puertas a la derecha; el
 * lateral izquierdo (conductor) abajo, como se ve el furgón desde arriba.
 *
 * Interacción: tocar una posición selecciona su canastilla de arriba;
 * arrastrarla y soltarla sobre otra posición la mueve allí (a lo alto).
 */

interface Props {
  rejilla: Rejilla;
  grupos: GrupoCarga[];
  posiciones: Posicion[];
  bloqueos: number[];
  /** Pila seleccionada (su canastilla de arriba). */
  pilaSeleccionada: number | null;
  resaltado: string | null;
  editable: boolean;
  onSeleccionar: (pila: number | null) => void;
  onMover: (desde: number, hacia: number) => void;
  /** Color del destino que se está colocando: cada clic en una posición lo coloca ahí. */
  colocando?: string | null;
  onColocar?: (pila: number) => void;
}

const ANCHO = 1000;
const CABINA_CM = 100;

export default function Plano2D(props: Props) {
  const { rejilla, grupos, posiciones, bloqueos, pilaSeleccionada, resaltado, editable } = props;
  const L = rejilla.furgon.largo;
  const W = rejilla.furgon.ancho;
  const c = rejilla.canastilla;
  const margen = 28;
  const s = (ANCHO - 2 * margen) / (L + CABINA_CM + 70);
  const alto = W * s + 2 * margen + 30;
  const ox = margen + CABINA_CM * s;
  const oy = margen + 16;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + (W - y) * s;

  const porGrupo = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);
  const bloqueadas = useMemo(() => new Set(bloqueos), [bloqueos]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<{ desde: number; sobre: number | null; movio: boolean } | null>(null);

  const lat = rejilla.pilas.filter((p) => p.zona === "izquierda" || p.zona === "derecha");
  const atraviesaLat = lat.length ? (lat[0].rot === 0 ? c.ancho : c.largo) : 0;
  const fondoFrente = rejilla.frente_fondo_cm ?? 0;

  function inicio(e: React.PointerEvent, pila: number) {
    if (!editable || props.colocando) return;
    e.preventDefault();
    setArrastre({ desde: pila, sobre: pila, movio: false });
  }

  function fin() {
    if (!arrastre) return;
    const { desde, sobre, movio } = arrastre;
    setArrastre(null);
    if (!movio || sobre === null || sobre === desde) {
      props.onSeleccionar(pilaSeleccionada === desde ? null : desde);
      return;
    }
    props.onMover(desde, sobre);
  }

  const llena = (pila: number) => contenidoPila(posiciones, pila).length >= rejilla.niveles;

  return (
    <div className="plano-2d" onPointerLeave={() => setArrastre(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${alto}`}
        role="img"
        aria-label="Plano superior del furgón"
        onPointerUp={fin}
        onClick={(e) => {
          if (e.target === svgRef.current) props.onSeleccionar(null);
        }}
      >
        <defs>
          <pattern id="p2d-pasillo" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0,10 L10,0" className="p2d-pasillo-raya" />
          </pattern>
        </defs>

        {/* Cabina y caja */}
        <rect x={margen} y={oy + W * s * 0.12} width={CABINA_CM * s - 6} height={W * s * 0.76} rx={10} className="p2d-cabina" />
        <text x={margen + (CABINA_CM * s - 6) / 2} y={oy + (W * s) / 2 + 4} className="p2d-rotulo" textAnchor="middle">
          CABINA
        </text>
        <rect x={X(0)} y={Y(W)} width={L * s} height={W * s} className="p2d-caja" />

        {rejilla.esquema === "frente_columnas" && (rejilla.pasillo_cm ?? 0) > 0 && lat.length > 0 && (
          <g>
            <rect
              x={X(fondoFrente)}
              y={Y(W - atraviesaLat)}
              width={(L - fondoFrente) * s}
              height={(W - 2 * atraviesaLat) * s}
              fill="url(#p2d-pasillo)"
              className="p2d-pasillo"
            />
            <text x={X((fondoFrente + L) / 2)} y={Y(W / 2) + 5} className="p2d-pasillo-texto" textAnchor="middle">
              PASILLO · {rejilla.pasillo_cm} cm
            </text>
          </g>
        )}

        {/* Posiciones */}
        {rejilla.pilas.map((pila, i) => {
          const [dx, dy] = pila.rot === 0 ? [c.largo, c.ancho] : [c.ancho, c.largo];
          const x0 = X(pila.x - dx / 2);
          const y0 = Y(pila.y + dy / 2);
          const w = dx * s;
          const h = dy * s;
          const cont = contenidoPila(posiciones, i);
          const arriba = cont.length ? porGrupo.get(cont[cont.length - 1].grupo) : undefined;
          const tenue = resaltado && !cont.some((p) => p.grupo === resaltado);
          const sobreAqui = arrastre?.movio && arrastre.sobre === i && arrastre.desde !== i;
          const clase = [
            "p2d-pila",
            pilaSeleccionada === i ? "seleccionada" : "",
            bloqueadas.has(i) ? "bloqueada" : "",
            tenue ? "tenue" : "",
            sobreAqui ? (llena(i) ? "destino-mal" : "destino-ok") : "",
            props.colocando && !llena(i) ? "colocable" : "",
          ].join(" ");
          // Barra vertical con un tramo por nivel, de abajo hacia arriba.
          const tramo = (h - 8) / rejilla.niveles;
          return (
            <g
              key={i}
              className={clase}
              onPointerDown={(e) => cont.length && inicio(e, i)}
              onPointerEnter={() => arrastre && setArrastre({ ...arrastre, sobre: i, movio: arrastre.movio || arrastre.desde !== i })}
              onClick={(e) => {
                e.stopPropagation();
                if (props.colocando) props.onColocar?.(i);
                else if (!cont.length && !arrastre) props.onSeleccionar(null);
              }}
              style={{
                cursor: props.colocando ? (llena(i) ? "not-allowed" : "copy") : editable && cont.length ? "grab" : "default",
                ...(props.colocando && !llena(i) ? { ["--colocando" as string]: props.colocando } : {}),
              }}
            >
              <title>
                {`${filaDePila(pila).titulo}${pila.zona === "izquierda" || pila.zona === "derecha" ? ` ${filaDePila(pila).lado.toLowerCase()}` : ` · ${filaDePila(pila).lado}`} · ${cont.length}/${rejilla.niveles}` +
                  (cont.length ? ` · ${cont.map((p) => porGrupo.get(p.grupo)?.nombre).join(" › ")}` : " · vacía")}
              </title>
              <rect x={x0 + 1} y={y0 + 1} width={w - 2} height={h - 2} rx={3} className="p2d-pila-fondo"
                style={arriba ? { fill: `color-mix(in srgb, ${arriba.color} 22%, var(--superficie))`, stroke: arriba.color } : undefined} />
              {cont.map((p, n) => (
                <rect key={n} x={x0 + w - 11} y={y0 + h - 4 - (n + 1) * tramo} width={7} height={tramo - 1}
                  rx={1.5} style={{ fill: porGrupo.get(p.grupo)?.color ?? "#94a3b8" }} />
              ))}
              <text x={x0 + 4} y={y0 + 11} className="p2d-etiqueta">
                {filaDePila(pila).corto}
                {bloqueadas.has(i) ? " 🔒" : ""}
              </text>
              {cont.length > 0 && (
                <>
                  <text x={x0 + (w - 10) / 2} y={y0 + h / 2 + 4} className="p2d-cuenta" textAnchor="middle">
                    ×{cont.length}
                  </text>
                  <text x={x0 + (w - 10) / 2} y={y0 + h - 5} className="p2d-numeros" textAnchor="middle">
                    {cont.map((p) => porGrupo.get(p.grupo)?.numero ?? porGrupo.get(p.grupo)?.orden).join("·")}
                  </text>
                </>
              )}
            </g>
          );
        })}

        <text x={X(L) + 8} y={Y(W / 2) + 4} className="p2d-rotulo">PUERTAS ▶</text>
        <text x={X(0)} y={Y(W) - 6} className="p2d-lado">Lateral derecho</text>
        <text x={X(0)} y={Y(0) + 15} className="p2d-lado">Lateral izquierdo (conductor)</text>
        <text x={X(L)} y={Y(0) + 15} className="p2d-lado" textAnchor="end">
          Interior {L} × {W} × {rejilla.furgon.alto} cm
        </text>
      </svg>
      {editable && (
        <p className="p2d-ayuda">
          Toca una posición para elegir su canastilla de arriba · arrástrala sobre otra posición para moverla allí.
        </p>
      )}
    </div>
  );
}
