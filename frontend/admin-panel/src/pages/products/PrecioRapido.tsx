import { Check, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatoPrecio } from "../../utils";
import { validarPrecio } from "./presentaciones";

/**
 * El precio de una presentación, editable ahí mismo: clic → campo con el
 * precio actual → Enter guarda, Esc cancela.
 *
 * No guarda por su cuenta: `onGuardar` hace la petición (la misma ruta que
 * «Actualizar precios») y solo si responde bien el editor se cierra. Si
 * falla, el error se queda a la vista y el precio de la fila NO cambia.
 */
export function PrecioRapido({
  precio,
  unidad,
  nombre,
  deshabilitado,
  onGuardar,
}: {
  /** Precio actual, en formato de la API ("3000.00"). */
  precio: string | null;
  unidad: string;
  nombre: string;
  deshabilitado?: boolean;
  /** Devuelve un mensaje de error, o null si se guardó. */
  onGuardar: (nuevo: string) => Promise<string | null>;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  function abrir() {
    // Se escribe como lo lee la gente: «3000» o «3000,50», sin «.00».
    const actual = precio ? String(Number(precio)).replace(".", ",") : "";
    setTexto(actual);
    setError(null);
    setEditando(true);
  }

  useEffect(() => {
    if (editando) {
      campo.current?.focus();
      campo.current?.select();
    }
  }, [editando]);

  async function guardar() {
    if (guardando) return;
    const { valor, error: invalido } = validarPrecio(texto);
    if (invalido || !valor) {
      setError(invalido ?? "Revisa el precio.");
      campo.current?.focus();
      return;
    }
    if (precio !== null && Number(valor) === Number(precio)) {
      setEditando(false); // sin cambio: no hay nada que guardar
      return;
    }
    setGuardando(true);
    const fallo = await onGuardar(valor);
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      campo.current?.focus();
    } else setEditando(false);
  }

  if (!editando) {
    return (
      <button
        type="button"
        className="pc-precio pc-precio-boton"
        onClick={abrir}
        disabled={deshabilitado}
        title={`Cambiar el precio de ${nombre}`}
        aria-label={`Precio de ${nombre}: ${precio ? formatoPrecio(precio) : "sin precio"} por ${unidad}. Cambiar precio`}
      >
        <span className="pc-precio-valor">{precio ? formatoPrecio(precio) : "—"}</span>
        <span className="pc-precio-unidad">/ {unidad}</span>
        <Pencil size={12} className="pc-precio-lapiz" aria-hidden />
      </button>
    );
  }

  const nuevo = validarPrecio(texto).valor;
  const diferencia = nuevo && precio ? Number(nuevo) - Number(precio) : null;

  return (
    <div
      ref={caja}
      className="pr-editor"
      role="group"
      aria-label={`Nuevo precio de ${nombre}`}
      onBlur={(e) => {
        // Salir del editor sin guardar = cancelar (salvo que el foco siga dentro).
        if (!guardando && !caja.current?.contains(e.relatedTarget as Node)) setEditando(false);
      }}
    >
      <div className={`pr-campo ${error ? "con-error" : ""}`}>
        <span aria-hidden>$</span>
        <input
          ref={campo}
          value={texto}
          inputMode="decimal"
          autoComplete="off"
          disabled={guardando}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "pr-error" : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation(); // no cerrar el modal del producto
              setEditando(false);
            }
          }}
        />
        <span className="pr-unidad">/ {unidad}</span>
      </div>
      <button type="button" className="pr-btn pr-ok" onClick={guardar} disabled={guardando} aria-label="Guardar precio" title="Guardar (Enter)">
        {guardando ? <Loader2 size={14} className="girando" /> : <Check size={14} />}
      </button>
      <button
        type="button"
        className="pr-btn"
        onClick={() => setEditando(false)}
        disabled={guardando}
        aria-label="Cancelar"
        title="Cancelar (Esc)"
      >
        <X size={14} />
      </button>
      <div className="pr-pie" aria-live="polite">
        {error ? (
          <span className="pr-error" id="pr-error" role="alert">
            {error}
          </span>
        ) : (
          <span className="pr-actual">
            Actual {precio ? formatoPrecio(precio) : "—"}
            {diferencia !== null && diferencia !== 0 && (
              <span className={diferencia > 0 ? "sube" : "baja"}>
                {" "}
                {diferencia > 0 ? "+" : "−"}
                {formatoPrecio(Math.abs(diferencia))}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
