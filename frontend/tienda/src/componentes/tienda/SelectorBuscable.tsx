"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizarTexto } from "@/lib/utiles";

export interface OpcionSelector {
  valor: number;
  etiqueta: string;
  /** Un dato corto a la derecha (la abreviatura de la unidad: "kg", "lb"). */
  detalle?: string;
}

interface Props {
  id: string;
  icono: ReactNode;
  opciones: OpcionSelector[];
  valor: number | null;
  onCambiar: (valor: number | null) => void;
  placeholder: string;
  /** Sin elegir es válido: aparece la opción de vaciar. */
  opcional?: boolean;
  /** El mensaje del navegador si se envía el formulario sin elegir. */
  mensajeRequerido?: string;
  etiquetaLista: string;
}

/**
 * Un `<select>` en el que se puede escribir: con veinte unidades ("bulto",
 * "canastilla", "caja x 20"…) buscar con el dedo en la rueda nativa del
 * móvil es lento; aquí se escriben dos letras y queda la que es.
 *
 * Combobox de ARIA: flechas para recorrer, Enter para elegir, Esc para
 * cerrar. Mientras está cerrado el campo muestra lo elegido; al abrirlo se
 * vacía para buscar y, si se cierra sin elegir, vuelve a lo que había. La
 * lista tiene su propio scroll, corto, para no tapar el resto del formulario.
 */
export function SelectorBuscable({
  id,
  icono,
  opciones,
  valor,
  onCambiar,
  placeholder,
  opcional = false,
  mensajeRequerido,
  etiquetaLista,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activa, setActiva] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = `${useId()}-lista`;

  const elegida = opciones.find((o) => o.valor === valor) ?? null;

  const filtradas = useMemo(() => {
    const n = normalizarTexto(texto.trim());
    if (!n) return opciones;
    return opciones.filter((o) => normalizarTexto(`${o.etiqueta} ${o.detalle ?? ""}`).includes(n));
  }, [opciones, texto]);

  // Requerido sin elegir: lo frena el propio formulario, con un mensaje claro.
  useEffect(() => {
    campo.current?.setCustomValidity(!opcional && valor === null && mensajeRequerido ? mensajeRequerido : "");
  }, [opcional, valor, mensajeRequerido]);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) cerrar();
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // La opción activa siempre a la vista dentro de la lista con scroll.
  useEffect(() => {
    if (!abierto) return;
    lista.current?.querySelector<HTMLElement>(`[data-indice="${activa}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activa, abierto]);

  function abrir() {
    if (abierto) return;
    setTexto("");
    const i = opciones.findIndex((o) => o.valor === valor);
    setActiva(i >= 0 ? i : 0);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setTexto("");
  }

  function elegir(opcion: OpcionSelector | null) {
    onCambiar(opcion ? opcion.valor : null);
    cerrar();
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) return abrir();
      const total = filtradas.length;
      if (!total) return;
      setActiva((i) => (e.key === "ArrowDown" ? (i + 1) % total : i <= 0 ? total - 1 : i - 1));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (filtradas[activa]) elegir(filtradas[activa]);
    } else if (e.key === "Escape" && abierto) {
      e.preventDefault();
      cerrar();
    } else if (e.key === "Tab" && abierto) {
      cerrar();
    }
  }

  const idOpcion = (i: number) => `${idLista}-${i}`;

  return (
    <div className={`sbus ${abierto ? "is-abierto" : ""}`} ref={raiz}>
      <div className="cpf-control sbus-control" onMouseDown={() => !abierto && abrir()}>
        <span className="cpf-icono" aria-hidden="true">
          {icono}
        </span>
        <input
          ref={campo}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={abierto && filtradas[activa] ? idOpcion(activa) : undefined}
          autoComplete="off"
          placeholder={abierto ? "Escribe para buscar…" : placeholder}
          value={abierto ? texto : elegida?.etiqueta ?? ""}
          onChange={(e) => {
            setTexto(e.target.value);
            setActiva(0);
            if (!abierto) setAbierto(true);
          }}
          onFocus={abrir}
          onKeyDown={alTeclear}
        />
        {opcional && elegida && !abierto ? (
          <button
            type="button"
            className="sbus-vaciar"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onCambiar(null)}
            aria-label="Quitar la selección"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={16} className="cpf-flecha sbus-flecha" aria-hidden="true" />
        )}
      </div>

      {abierto && (
        <ul id={idLista} role="listbox" aria-label={etiquetaLista} className="sbus-lista" ref={lista}>
          {filtradas.map((o, i) => {
            const seleccionada = o.valor === valor;
            return (
              <li
                key={o.valor}
                id={idOpcion(i)}
                data-indice={i}
                role="option"
                aria-selected={seleccionada}
                className={`sbus-op ${i === activa ? "is-activa" : ""} ${seleccionada ? "is-elegida" : ""}`}
                onMouseEnter={() => setActiva(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
              >
                <span className="sbus-op-texto">{o.etiqueta}</span>
                {o.detalle && <span className="sbus-op-detalle">{o.detalle}</span>}
                {seleccionada && <Check size={15} className="sbus-op-check" aria-hidden="true" />}
              </li>
            );
          })}
          {filtradas.length === 0 && <li className="sbus-vacio">Sin coincidencias para «{texto.trim()}»</li>}
        </ul>
      )}
    </div>
  );
}
