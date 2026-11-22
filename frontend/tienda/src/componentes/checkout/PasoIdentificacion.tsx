"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, IdCard, Loader2, ShieldCheck } from "lucide-react";
import { consultarCliente } from "@/lib/datos";
import type { ClienteConsultado } from "@/lib/tipos";
import { soloDigitos, useClienteTienda } from "@/estado/clienteTienda";

/** El mensaje que el servidor dio para la cédula, o uno por el tipo de fallo. */
export function mensajeDeConsulta(error: unknown): string {
  const { estado, detalle } = (error ?? {}) as { estado?: number; detalle?: Record<string, unknown> };
  if (estado === 429) return "Hiciste muchas consultas seguidas. Espera un minuto e inténtalo de nuevo.";
  const cedula = detalle?.cedula;
  if (Array.isArray(cedula) && typeof cedula[0] === "string") return cedula[0];
  return "No pudimos consultar tu cédula. Revisa tu conexión e intenta nuevamente.";
}

/** "1020345678" → "•••• 5678": la cédula a la vista, pero no entera. */
export function cedulaOculta(cedula: string): string {
  return cedula.length > 4 ? `•••• ${cedula.slice(-4)}` : cedula;
}

interface Props {
  cedula: string;
  onCedula: (cedula: string) => void;
  /** La respuesta del servidor; quien orquesta decide a qué paso sigue. */
  onIdentificado: (consulta: ClienteConsultado, cedula: string) => void;
}

/**
 * Paso 1: ¿quién hace el pedido?
 *
 * La cédula se consulta en el servidor, que solo devuelve lo justo para que la
 * persona se reconozca ("Juan P.", "•••• 4567", "Cra 12…") y limita cuántas
 * consultas se hacen por minuto: probar cédulas ajenas no entrega el teléfono
 * ni la dirección de nadie (ver `backend/apps/orders/clientes_tienda.py`).
 *
 * Quien ya pidió desde este navegador no la vuelve a escribir: se consulta
 * sola y se pasa directo a confirmar sus datos.
 */
export function PasoIdentificacion({ cedula, onCedula, onIdentificado }: Props) {
  const recordada = useClienteTienda((s) => s.cedula);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConsultada = useRef(false);
  const campo = useRef<HTMLInputElement>(null);

  async function consultar(valor: string) {
    const digitos = soloDigitos(valor);
    if (digitos.length < 5) {
      setError("Escribe tu número de cédula, sin puntos (mínimo 5 dígitos).");
      campo.current?.focus();
      return;
    }
    setError(null);
    setConsultando(true);
    try {
      onCedula(digitos);
      onIdentificado(await consultarCliente(digitos), digitos);
    } catch (e) {
      setError(mensajeDeConsulta(e));
    } finally {
      setConsultando(false);
    }
  }

  useEffect(() => {
    if (recordada && !autoConsultada.current) {
      autoConsultada.current = true;
      void consultar(recordada);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordada]);

  return (
    <section className="chk-seccion" aria-labelledby="chk-ident-titulo">
      <h2 className="chk-titulo" id="chk-ident-titulo" tabIndex={-1}>
        <IdCard size={20} aria-hidden="true" /> ¿Quién hace el pedido?
      </h2>
      <p className="chk-texto">
        Escribe tu cédula. Si ya nos has pedido, recuperamos tus datos y no tendrás que volver a
        escribirlos; si es tu primera vez, te registramos en el siguiente paso.
      </p>

      <form
        className="ident-fila"
        onSubmit={(e) => {
          e.preventDefault();
          void consultar(cedula);
        }}
      >
        <label className="sr-only" htmlFor="chk-cedula">
          Número de cédula
        </label>
        <input
          ref={campo}
          id="chk-cedula"
          value={cedula}
          onChange={(e) => {
            onCedula(e.target.value);
            if (error) setError(null);
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Número de cédula"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "chk-cedula-error" : "chk-cedula-ayuda"}
          disabled={consultando}
        />
        <button type="submit" className="btn btn-verde ident-btn" disabled={consultando}>
          {consultando ? (
            <>
              <Loader2 size={18} className="girando" aria-hidden="true" /> Buscando…
            </>
          ) : (
            <>
              Continuar <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {consultando && (
        <p className="chk-estado" role="status">
          Buscando tus datos…
        </p>
      )}
      {error && (
        <p className="ident-error" id="chk-cedula-error" role="alert">
          {error}
        </p>
      )}
      <p className="chk-nota" id="chk-cedula-ayuda">
        <ShieldCheck size={14} aria-hidden="true" /> Por tu seguridad, solo mostramos tus datos
        parcialmente ocultos.
      </p>
    </section>
  );
}
