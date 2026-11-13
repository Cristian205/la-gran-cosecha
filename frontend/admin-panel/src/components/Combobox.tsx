import { Check, ChevronDown, Search } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Selector moderno (patrón ARIA «combobox» + «listbox»), en lugar del
 * `<select>` nativo.
 *
 * - Botón con la opción elegida (y un ícono opcional a la izquierda).
 * - Lista con buscador cuando hay muchas opciones; escribir filtra.
 * - Teclado: ↓/↑ recorren, Inicio/Fin, Enter elige, Esc cierra (sin cerrar el
 *   modal de detrás), Tab sale.
 * - La lista se pinta en <body> con posición fija: no la recorta el scroll
 *   de un modal, y se abre hacia arriba si abajo no cabe.
 * - `vacio`: una opción para «ninguna» (p. ej. «Sin definir»).
 * - `accion`: una entrada extra al final («+ Crear unidad nueva…»).
 *
 * El ref expone `focus()`, igual que un <select>, para enfocar el campo con
 * error desde el formulario.
 */
export interface OpcionCombo<T extends string | number> {
  valor: T;
  etiqueta: string;
  /** Texto secundario a la derecha (p. ej. la abreviatura «kg»). */
  detalle?: string;
}

interface Props<T extends string | number> {
  id: string;
  valor: T | "";
  opciones: OpcionCombo<T>[];
  onCambiar: (valor: T | "") => void;
  placeholder?: string;
  /** Si se pasa, aparece como primera opción y elige "" (ninguna). */
  vacio?: string;
  /** Buscador en la lista. Por defecto, con más de 7 opciones. */
  buscable?: boolean;
  invalido?: boolean;
  describedBy?: string;
  icono?: ReactNode;
  accion?: { etiqueta: string; onElegir: () => void };
  deshabilitado?: boolean;
}

export interface ComboboxHandle {
  focus: () => void;
}

const MARGEN = 8;
const ALTO_MAX = 300;
const ACCION = "__accion__";

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function ComboboxBase<T extends string | number>(
  {
    id,
    valor,
    opciones,
    onCambiar,
    placeholder = "Selecciona…",
    vacio,
    buscable,
    invalido,
    describedBy,
    icono,
    accion,
    deshabilitado,
  }: Props<T>,
  ref: React.Ref<ComboboxHandle>
) {
  const listaId = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const busqueda = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean; alto: number } | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => boton.current?.focus() }), []);

  const conBuscador = buscable ?? opciones.length > 7;

  // Lo que se lista: [vacío] + opciones filtradas + [acción].
  type Item = { clave: string; etiqueta: string; detalle?: string; valor: T | "" | typeof ACCION };
  const items: Item[] = useMemo(() => {
    const q = sinTildes(filtro.trim());
    const lista: Item[] = [];
    if (vacio && !q) lista.push({ clave: "vacio", etiqueta: vacio, valor: "" });
    for (const o of opciones) {
      if (!q || sinTildes(o.etiqueta).includes(q) || (o.detalle && sinTildes(o.detalle).includes(q)))
        lista.push({ clave: String(o.valor), etiqueta: o.etiqueta, detalle: o.detalle, valor: o.valor });
    }
    if (accion) lista.push({ clave: ACCION, etiqueta: accion.etiqueta, valor: ACCION });
    return lista;
  }, [opciones, filtro, vacio, accion]);

  const elegida = opciones.find((o) => o.valor === valor);

  function abrir() {
    if (deshabilitado) return;
    setFiltro("");
    const i = Math.max(
      0,
      items.findIndex((it) => it.valor === valor)
    );
    setActivo(i);
    setAbierto(true);
  }

  function cerrar(devolverFoco = true) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }

  function elegir(it: Item) {
    if (it.valor === ACCION) {
      cerrar(false);
      accion?.onElegir();
      return;
    }
    onCambiar(it.valor as T | "");
    cerrar();
  }

  // Posición: debajo del botón, o arriba si no cabe; se recalcula al desplazar.
  useLayoutEffect(() => {
    if (!abierto) return;
    function colocar() {
      const r = boton.current?.getBoundingClientRect();
      if (!r) return;
      const vh = window.innerHeight;
      const abajo = vh - r.bottom - MARGEN;
      const arriba = r.top - MARGEN;
      const haciaArriba = abajo < 200 && arriba > abajo;
      const alto = Math.min(ALTO_MAX, Math.max(140, haciaArriba ? arriba : abajo) - 6);
      setPos({ top: haciaArriba ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, arriba: haciaArriba, alto });
    }
    colocar();
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", colocar, true);
    return () => {
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocar, true);
    };
  }, [abierto]);

  // Al abrir: foco al buscador (o a la lista) y cerrar al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    requestAnimationFrame(() => (conBuscador ? busqueda.current : caja.current)?.focus());
    function fuera(e: MouseEvent) {
      const t = e.target as Node;
      if (!caja.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto, conBuscador]);

  // La opción activa siempre a la vista.
  useEffect(() => {
    if (!abierto) return;
    caja.current?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  function teclado(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActivo(items.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[activo];
      if (it) elegir(it);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // no cerrar el modal de detrás
      cerrar();
    } else if (e.key === "Tab") {
      setAbierto(false);
    }
  }

  const activoId = items[activo] ? `${listaId}-${activo}` : undefined;

  return (
    <>
      <button
        ref={boton}
        id={id}
        type="button"
        role="combobox"
        className={`combo ${invalido ? "campo-invalido" : ""} ${abierto ? "abierto" : ""} ${icono ? "con-icono" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? listaId : undefined}
        aria-invalid={invalido || undefined}
        aria-describedby={describedBy}
        disabled={deshabilitado}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            abrir();
          } else if (abierto) teclado(e);
        }}
      >
        {icono && (
          <span className="combo-icono" aria-hidden>
            {icono}
          </span>
        )}
        <span className={`combo-valor ${elegida ? "" : "vacio"}`}>
          {elegida ? elegida.etiqueta : valor === "" && vacio ? vacio : placeholder}
        </span>
        {elegida?.detalle && <span className="combo-detalle">{elegida.detalle}</span>}
        <ChevronDown size={16} className="combo-flecha" aria-hidden />
      </button>

      {abierto &&
        pos &&
        createPortal(
          <div
            ref={caja}
            className={`combo-lista ${pos.arriba ? "arriba" : ""}`}
            style={{
              left: pos.left,
              width: Math.max(pos.width, 220),
              ...(pos.arriba ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            tabIndex={-1}
            onKeyDown={conBuscador ? undefined : teclado}
          >
            {conBuscador && (
              <label className="combo-buscar">
                <Search size={14} aria-hidden />
                <input
                  ref={busqueda}
                  value={filtro}
                  placeholder="Buscar…"
                  aria-label="Buscar opción"
                  aria-controls={listaId}
                  aria-activedescendant={activoId}
                  onChange={(e) => {
                    setFiltro(e.target.value);
                    setActivo(0);
                  }}
                  onKeyDown={teclado}
                />
              </label>
            )}
            <ul
              id={listaId}
              role="listbox"
              aria-labelledby={id}
              aria-activedescendant={conBuscador ? undefined : activoId}
              style={{ maxHeight: pos.alto - (conBuscador ? 48 : 0) }}
            >
              {items.length === 0 && <li className="combo-sin">Sin resultados para «{filtro.trim()}»</li>}
              {items.map((it, i) => {
                const seleccionada = it.valor === valor && it.valor !== ACCION;
                return (
                  <li
                    key={it.clave}
                    id={`${listaId}-${i}`}
                    data-indice={i}
                    role="option"
                    aria-selected={seleccionada}
                    className={`combo-opcion ${i === activo ? "activa" : ""} ${seleccionada ? "elegida" : ""} ${
                      it.valor === ACCION ? "accion" : ""
                    } ${it.valor === "" ? "vacia" : ""}`}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={(e) => e.preventDefault()} // no robar el foco antes del clic
                    onClick={() => elegir(it)}
                  >
                    <span className="combo-opcion-texto">{it.etiqueta}</span>
                    {it.detalle && <span className="combo-opcion-detalle">{it.detalle}</span>}
                    {seleccionada && <Check size={14} className="combo-check" aria-hidden />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

/** `forwardRef` pierde el genérico: se recupera con este cast. */
export const Combobox = forwardRef(ComboboxBase) as <T extends string | number>(
  props: Props<T> & { ref?: React.Ref<ComboboxHandle> }
) => ReturnType<typeof ComboboxBase>;
