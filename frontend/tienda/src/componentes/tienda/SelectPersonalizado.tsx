"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/componentes/BottomSheet";
import { normalizarTexto } from "@/lib/utiles";

export interface OpcionSelect {
  /** El identificador real (nombre de la variedad, id de la presentación…). */
  valor: string;
  etiqueta: string;
  /** Un dato corto a la derecha, en gris ("$3.000"). Opcional. */
  detalle?: string;
}

interface Props {
  opciones: OpcionSelect[];
  valor: string;
  onCambiar: (valor: string) => void;
  /** Nombre accesible: "Variedad de Uva". */
  etiqueta: string;
  /** Título de la hoja inferior (móvil, listas largas). Por defecto, `etiqueta`. */
  tituloHoja?: string;
  /** Desde cuántas opciones el móvil usa la hoja inferior con buscador. */
  umbralHoja?: number;
  className?: string;
  /** Una palabra fija antes del valor, en gris ("Por" → "Por Libra ▾"). */
  prefijo?: string;
}

const MOVIL = "(max-width: 767px)";
const CIERRE_MS = 140;
const MARGEN = 8;
const ALTO_MAX = 280;

type Modo = "flotante" | "hoja";
interface Posicion {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
  arriba: boolean;
}

/**
 * Un select hecho a mano para la variedad ("Uva [Isabella Pulpa ▾]") y la
 * unidad de venta ("[− 5 +] Kilogramos ▾").
 *
 * Por qué no el `<select>` nativo: su menú lo dibuja el sistema (la rueda de
 * iOS, la lista gris de Windows) y no se puede llevar a la identidad de la
 * tienda. Este es un listbox de ARIA con todo lo que el nativo daba:
 *   - Flechas, Inicio/Fin y una letra para saltar; Enter o Espacio eligen;
 *     Escape cierra y devuelve el foco al botón; Tab cierra y sigue.
 *   - El menú se monta en `<body>` (portal) con `position: fixed`, calculado
 *     desde el botón: ni el `overflow: hidden` de la tarjeta ni el z-index de
 *     la rejilla lo recortan. Si abajo no cabe, abre hacia arriba.
 *   - En el móvil, con muchas opciones, en vez de un menú flotante sube la
 *     hoja inferior (`BottomSheet`) con un buscador.
 *
 * No sabe nada de productos: recibe opciones y devuelve el `valor` elegido,
 * y quien lo usa decide qué hacer (en la tarjeta, `elegirVariante` del
 * mismo `useSeleccionProducto` de siempre).
 */
export function SelectPersonalizado({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  tituloHoja,
  umbralHoja = 7,
  className = "",
  prefijo,
}: Props) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [activa, setActiva] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [pos, setPos] = useState<Posicion | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const temporizador = useRef<number | null>(null);
  const base = useId();
  const idLista = `${base}-lista`;
  const idOpcion = (i: number) => `${base}-op-${i}`;

  const elegida = opciones.find((o) => o.valor === valor) ?? opciones[0];

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    if (modo !== "hoja" || !q) return opciones;
    return opciones.filter((o) => normalizarTexto(o.etiqueta).includes(q));
  }, [opciones, busqueda, modo]);

  function abrir() {
    if (temporizador.current) window.clearTimeout(temporizador.current);
    const usarHoja = opciones.length >= umbralHoja && window.matchMedia(MOVIL).matches;
    setBusqueda("");
    setCerrando(false);
    setPos(null);
    setActiva(Math.max(0, opciones.findIndex((o) => o.valor === valor)));
    setModo(usarHoja ? "hoja" : "flotante");
  }

  const cerrar = useCallback(
    (devolverFoco = true) => {
      if (devolverFoco) boton.current?.focus({ preventScroll: true });
      if (modo !== "flotante") {
        setModo(null);
        return;
      }
      // El menú flotante se desvanece antes de desmontarse.
      setCerrando(true);
      temporizador.current = window.setTimeout(() => {
        setModo(null);
        setCerrando(false);
      }, CIERRE_MS);
    },
    [modo]
  );

  useEffect(() => () => {
    if (temporizador.current) window.clearTimeout(temporizador.current);
  }, []);

  function elegir(i: number) {
    const opcion = visibles[i];
    if (!opcion) return;
    if (opcion.valor !== valor) onCambiar(opcion.valor);
    cerrar(true);
  }

  // Ubicar el menú flotante junto al botón, sin salirse de la pantalla.
  const ubicar = useCallback(() => {
    const b = boton.current;
    const p = panel.current;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    const abajo = window.innerHeight - r.bottom - MARGEN;
    const encima = r.top - MARGEN;
    const altoContenido = Math.min(p.scrollHeight, ALTO_MAX);
    const arriba = abajo < altoContenido && encima > abajo;
    const maxHeight = Math.max(120, Math.min(ALTO_MAX, (arriba ? encima : abajo) - 4));
    const alto = Math.min(altoContenido, maxHeight);
    const ancho = p.offsetWidth;
    const left = Math.min(Math.max(MARGEN, r.left), window.innerWidth - ancho - MARGEN);
    setPos({
      top: arriba ? r.top - 4 - alto : r.bottom + 4,
      left: Math.max(MARGEN, left),
      minWidth: Math.max(r.width, 150),
      maxHeight,
      arriba,
    });
  }, []);

  useLayoutEffect(() => {
    if (modo !== "flotante") return;
    ubicar();
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, { capture: true });
    };
  }, [modo, ubicar]);

  // El foco entra a la lista (o al buscador de la hoja). En un rAF porque la
  // hoja enfoca su propio panel al montarse, después de este efecto.
  useEffect(() => {
    if (!modo) return;
    const raf = requestAnimationFrame(() => {
      if (modo === "hoja" && buscador.current) buscador.current.focus();
      else lista.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [modo]);

  // Clic fuera del botón y del menú: cerrar sin robar el foco a lo que se tocó.
  useEffect(() => {
    if (modo !== "flotante") return;
    function alTocar(e: PointerEvent) {
      const t = e.target as Node;
      if (panel.current?.contains(t) || boton.current?.contains(t)) return;
      cerrar(false);
    }
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, [modo, cerrar]);

  // La opción activa siempre a la vista dentro del scroll de la lista.
  useEffect(() => {
    if (!modo) return;
    document.getElementById(idOpcion(activa))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, modo]);

  function teclasLista(e: KeyboardEvent<HTMLElement>, desdeBuscador = false) {
    const n = visibles.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiva((i) => Math.min(i + 1, n - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiva((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        if (desdeBuscador) break;
        e.preventDefault();
        setActiva(0);
        break;
      case "End":
        if (desdeBuscador) break;
        e.preventDefault();
        setActiva(n - 1);
        break;
      case "Enter":
        e.preventDefault();
        elegir(activa);
        break;
      case " ":
        if (desdeBuscador) break;
        e.preventDefault();
        elegir(activa);
        break;
      case "Escape":
        e.preventDefault();
        cerrar(true);
        break;
      case "Tab":
        cerrar(false);
        break;
      default:
        // Una letra salta a la primera opción que empieza por ella.
        if (!desdeBuscador && e.key.length === 1 && /\S/.test(e.key)) {
          const letra = normalizarTexto(e.key);
          const desde = visibles.findIndex((o, i) => i > activa && normalizarTexto(o.etiqueta).startsWith(letra));
          const i = desde !== -1 ? desde : visibles.findIndex((o) => normalizarTexto(o.etiqueta).startsWith(letra));
          if (i !== -1) setActiva(i);
        }
    }
  }

  function teclasBoton(e: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (!modo) abrir();
    }
  }

  const listaOpciones = (enHoja: boolean) => (
    <ul
      ref={lista}
      id={idLista}
      role="listbox"
      aria-label={etiqueta}
      aria-activedescendant={visibles.length ? idOpcion(activa) : undefined}
      tabIndex={-1}
      className={`selp-lista ${enHoja ? "selp-lista--hoja" : ""}`}
      onKeyDown={(e) => teclasLista(e)}
    >
      {visibles.map((o, i) => {
        const seleccionada = o.valor === valor;
        return (
          <li
            key={o.valor}
            id={idOpcion(i)}
            role="option"
            aria-selected={seleccionada}
            className={`selp-opcion ${i === activa ? "is-activa" : ""}`}
            onPointerMove={() => setActiva(i)}
            onClick={() => elegir(i)}
          >
            <span className="selp-opcion-texto">{o.etiqueta}</span>
            {o.detalle && <small className="selp-opcion-detalle">{o.detalle}</small>}
            <Check size={15} strokeWidth={2.75} className="selp-check" aria-hidden="true" />
          </li>
        );
      })}
      {visibles.length === 0 && <li className="selp-vacio">Sin resultados para “{busqueda}”</li>}
    </ul>
  );

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={`selp ${className}`}
        aria-haspopup="listbox"
        aria-expanded={modo !== null && !cerrando}
        aria-controls={modo ? idLista : undefined}
        aria-label={`${etiqueta}: ${elegida?.etiqueta ?? ""}`}
        onClick={() => (modo && !cerrando ? cerrar(true) : abrir())}
        onKeyDown={teclasBoton}
      >
        {prefijo && (
          <span className="selp-prefijo" aria-hidden="true">
            {prefijo}
          </span>
        )}
        <span className="selp-valor">{elegida?.etiqueta}</span>
        <ChevronDown size={13} strokeWidth={2.5} className="selp-chevron" aria-hidden="true" />
      </button>

      {modo === "flotante" &&
        createPortal(
          <div
            ref={panel}
            className={`selp-panel ${pos?.arriba ? "selp-panel--arriba" : ""} ${cerrando ? "is-cerrando" : ""}`}
            style={
              pos
                ? { top: pos.top, left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight }
                : { top: 0, left: 0, visibility: "hidden" }
            }
          >
            {listaOpciones(false)}
          </div>,
          document.body
        )}

      {modo === "hoja" && (
        <BottomSheet titulo={tituloHoja ?? etiqueta} onCerrar={() => cerrar(true)}>
          <label className="selp-buscar">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar</span>
            <input
              ref={buscador}
              type="search"
              placeholder="Buscar…"
              value={busqueda}
              role="combobox"
              aria-expanded="true"
              aria-controls={idLista}
              aria-activedescendant={visibles.length ? idOpcion(activa) : undefined}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setActiva(0);
              }}
              onKeyDown={(e) => teclasLista(e, true)}
            />
          </label>
          {listaOpciones(true)}
        </BottomSheet>
      )}
    </>
  );
}
