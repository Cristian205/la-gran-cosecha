/**
 * «Encuadre de la imagen»: qué parte de la foto se queda a la vista cuando la
 * pantalla la recorta.
 *
 * Antes era un texto donde había que escribir «50% 60%». Lo que se guarda
 * sigue siendo eso —es el `object-position` que aplica la tienda—, pero se
 * elige con botones (centrado, priorizar izquierda o derecha), con dos
 * deslizadores o pulsando sobre la muestra, que enseña el recorte real con la
 * proporción de la pantalla elegida.
 *
 * En tablet y móvil el valor vacío significa «igual que en escritorio», que es
 * lo que hace la tienda con un encuadre sin poner.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { urlDeVista } from "./CampoMedio";

type Modo = "heredado" | "centro" | "izquierda" | "derecha" | "manual";

interface Punto {
  x: number;
  y: number;
}

const PALABRAS: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };

/** «50% 60%», «center», «left top»… → porcentajes. Lo ilegible, al centro. */
export function leerPunto(valor: string | undefined, porDefecto = "50% 50%"): Punto {
  const partes = (valor?.trim() || porDefecto).split(/\s+/);
  const num = (p: string | undefined, d: number) => {
    if (p === undefined) return d;
    if (p in PALABRAS) return PALABRAS[p];
    const n = parseFloat(p);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d;
  };
  return { x: num(partes[0], 50), y: num(partes[1], 50) };
}

const escribir = ({ x, y }: Punto) => `${Math.round(x)}% ${Math.round(y)}%`;

function modoDe(valor: string, heredable: boolean): Modo {
  if (!valor.trim()) return heredable ? "heredado" : "centro";
  const { x, y } = leerPunto(valor);
  if (x === 50 && y === 50) return "centro";
  if (x === 0) return "izquierda";
  if (x === 100) return "derecha";
  return "manual";
}

export function CampoEncuadre({
  etiqueta = "Encuadre de la imagen",
  valor,
  porDefecto = "50% 50%",
  heredado,
  imagen,
  proporcion = 16 / 9,
  onCambio,
}: {
  etiqueta?: string;
  valor: string;
  /** El encuadre que vale si no hay ninguno puesto (el `default` del esquema). */
  porDefecto?: string;
  /** En tablet y móvil: el encuadre de escritorio, que es lo que se usa si este está vacío. */
  heredado?: string;
  /** La foto sobre la que se encuadra, para la muestra. */
  imagen?: string;
  proporcion?: number;
  onCambio: (valor: string) => void;
}) {
  const id = useId();
  const heredable = heredado !== undefined;
  const [manual, setManual] = useState(false);
  const muestra = useRef<HTMLDivElement>(null);

  const efectivo = valor.trim() || (heredable ? heredado || porDefecto : porDefecto);
  const punto = leerPunto(efectivo);
  const modo: Modo = manual ? "manual" : modoDe(valor, heredable);

  const opciones: { clave: Modo; nombre: string }[] = [
    ...(heredable ? [{ clave: "heredado" as Modo, nombre: "Como escritorio" }] : []),
    { clave: "centro", nombre: "Centrado" },
    { clave: "izquierda", nombre: "Izquierda" },
    { clave: "derecha", nombre: "Derecha" },
    { clave: "manual", nombre: "Manual" },
  ];

  function elegir(m: Modo) {
    setManual(m === "manual");
    if (m === "heredado") onCambio("");
    if (m === "centro") onCambio("50% 50%");
    if (m === "izquierda") onCambio(escribir({ x: 0, y: punto.y }));
    if (m === "derecha") onCambio(escribir({ x: 100, y: punto.y }));
    if (m === "manual") onCambio(escribir(punto));
  }

  function fijar(p: Punto) {
    setManual(true);
    onCambio(escribir({ x: Math.min(100, Math.max(0, p.x)), y: Math.min(100, Math.max(0, p.y)) }));
  }

  function desdePuntero(e: PointerEvent<HTMLDivElement>) {
    const caja = muestra.current?.getBoundingClientRect();
    if (!caja) return;
    fijar({ x: ((e.clientX - caja.left) / caja.width) * 100, y: ((e.clientY - caja.top) / caja.height) * 100 });
  }

  function conTeclado(e: KeyboardEvent<HTMLDivElement>) {
    const paso = e.shiftKey ? 10 : 1;
    const delta: Record<string, Punto> = {
      ArrowLeft: { x: -paso, y: 0 },
      ArrowRight: { x: paso, y: 0 },
      ArrowUp: { x: 0, y: -paso },
      ArrowDown: { x: 0, y: paso },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    fijar({ x: punto.x + d.x, y: punto.y + d.y });
  }

  return (
    <div className="campo encuadre">
      <label id={`${id}-etiqueta`}>{etiqueta}</label>
      <div className="encuadre-modos" role="radiogroup" aria-labelledby={`${id}-etiqueta`}>
        {opciones.map((o) => (
          <button
            key={o.clave}
            type="button"
            role="radio"
            aria-checked={modo === o.clave}
            className={modo === o.clave ? "activo" : ""}
            onClick={() => elegir(o.clave)}
          >
            {o.nombre}
          </button>
        ))}
      </div>

      {imagen && (
        <div
          ref={muestra}
          className="encuadre-muestra"
          // Los recortes verticales (tablet, móvil) se limitan por alto: a todo
          // el ancho del panel, una muestra 9:16 no cabría en la pantalla.
          style={proporcion < 1 ? { height: 240, width: 240 * proporcion } : { aspectRatio: String(proporcion) }}
          role="slider"
          tabIndex={0}
          aria-label="Punto de la foto que se mantiene a la vista. Usa las flechas para moverlo."
          aria-valuetext={`${Math.round(punto.x)}% horizontal, ${Math.round(punto.y)}% vertical`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            desdePuntero(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) desdePuntero(e);
          }}
          onKeyDown={conTeclado}
        >
          <img
            src={urlDeVista(imagen)}
            alt=""
            draggable={false}
            style={{ objectPosition: `${punto.x}% ${punto.y}%` }}
          />
          <span className="encuadre-punto" style={{ left: `${punto.x}%`, top: `${punto.y}%` }} aria-hidden="true" />
        </div>
      )}

      {modo === "manual" && (
        <div className="encuadre-deslizadores">
          <label>
            <span>Horizontal</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(punto.x)}
              onChange={(e) => fijar({ x: Number(e.target.value), y: punto.y })}
            />
            <output>{Math.round(punto.x)}%</output>
          </label>
          <label>
            <span>Vertical</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(punto.y)}
              onChange={(e) => fijar({ x: punto.x, y: Number(e.target.value) })}
            />
            <output>{Math.round(punto.y)}%</output>
          </label>
        </div>
      )}

      <p className="campo-ayuda">
        {modo === "heredado"
          ? "Usa el mismo encuadre que en escritorio."
          : imagen
            ? "Pulsa o arrastra sobre la foto para elegir qué parte queda siempre a la vista."
            : "Qué parte de la foto queda a la vista cuando la pantalla la recorta."}
      </p>
    </div>
  );
}
