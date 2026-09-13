import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

/**
 * La cinta de texto en movimiento continuo.
 *
 * Sirve de transición entre secciones de peso distinto —el Hero y lo que
 * venga después— sin gastar el espacio de una sección completa ni repetir el
 * mensaje del Hero con otras palabras. Es puramente de marca: frases cortas,
 * en bucle, decorativas.
 *
 * Es un bloque de CONTENIDO (como `Portada`): no pide nada al servidor, y sus
 * frases son propiedad del negocio, no un criterio de catálogo.
 *
 * Es un componente de servidor a propósito —sin "use client", sin estado—:
 * el desplazamiento es una animación CSS pura (`translateX`), así que no hace
 * falta ni un solo byte de JavaScript para que se mueva.
 *
 * # Por qué se duplica la lista
 *
 * El bucle sin costura se logra desplazando la pista exactamente el 50% de su
 * ancho: con la lista puesta dos veces seguidas, ese punto medio es
 * pixel-a-pixel idéntico al principio, así que el salto de vuelta a 0% es
 * invisible. Con una sola copia habría un hueco en blanco cada vuelta.
 *
 * La copia repetida se marca `aria-hidden`: quien usa lector de pantalla no
 * necesita oír la misma frase dos veces, y el contenido real (la propuesta
 * de valor) ya vive en el Hero y en el resto de la página.
 */
export interface ItemMarquesina {
  texto: string;
  icono?: string;
}

interface Props {
  items?: ItemMarquesina[];
  /** Segundos que tarda la cinta en dar una vuelta completa. Más alto, más
   *  lenta — el valor lo mira quien la está viendo, no un cálculo. */
  velocidad?: number;
  variante?: string;
}

const VARIANTES = ["oscura", "clara"] as const;

export function Marquesina({ items = [], velocidad = 26, variante }: Props) {
  // Sin frases no hay cinta: una tira vacía en bucle no separa nada, solo
  // deja un hueco de color sin motivo.
  if (items.length === 0) return null;

  const clase = claseDeVariante(variante, VARIANTES, "marquesina", "oscura");
  const duracion = Math.min(60, Math.max(8, velocidad));

  return (
    <div className={`marquesina ${clase}`}>
      <div
        className="marquesina-pista"
        style={{ "--marquesina-duracion": `${duracion}s` } as React.CSSProperties}
      >
        <Fila items={items} />
        <Fila items={items} oculta />
      </div>
    </div>
  );
}

function Fila({ items, oculta = false }: { items: ItemMarquesina[]; oculta?: boolean }) {
  return (
    <div className="marquesina-fila" aria-hidden={oculta || undefined}>
      {items.map((item, i) => {
        const Icono = icono(item.icono);
        return (
          <span className="marquesina-item" key={`${item.texto}-${i}`}>
            {item.icono && <Icono size={16} strokeWidth={2} aria-hidden="true" />}
            {item.texto}
            <span className="marquesina-punto" aria-hidden="true">
              ✦
            </span>
          </span>
        );
      })}
    </div>
  );
}
