"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, IdCard, Loader2, MapPin, Phone, UserRound } from "lucide-react";
import { consultarCliente } from "@/lib/datos";
import type { ClienteConsultado } from "@/lib/tipos";
import { soloDigitos, useClienteTienda } from "@/estado/clienteTienda";

interface Props {
  cedula: string;
  onCedula: (cedula: string) => void;
  consulta: ClienteConsultado | null;
  onConsulta: (consulta: ClienteConsultado | null) => void;
  otraDireccion: boolean;
  onOtraDireccion: (activa: boolean) => void;
  direccionEntrega: string;
  onDireccionEntrega: (direccion: string) => void;
}

/** El mensaje que el servidor dio para la cédula, o uno por el tipo de fallo. */
export function mensajeDeConsulta(error: unknown): string {
  const { estado, detalle } = (error ?? {}) as { estado?: number; detalle?: Record<string, unknown> };
  if (estado === 429) return "Hiciste muchas consultas seguidas. Espera un minuto e inténtalo de nuevo.";
  const cedula = detalle?.cedula;
  if (Array.isArray(cedula) && typeof cedula[0] === "string") return cedula[0];
  return "No pudimos consultar tu cédula. Intenta nuevamente.";
}

/**
 * "¿Quién hace el pedido?" en tiendas que identifican por cédula.
 *
 * Con la cédula el servidor dice si ya pidió antes. Si es así, se le saluda y
 * no se le pide nada más —ni teléfono, ni dirección, ni volver a aceptar el
 * acuerdo de precios—. Si es su primer pedido, el checkout le muestra esos
 * campos una sola vez. Lo que se ve de un cliente conocido va enmascarado.
 */
export function IdentificacionCedula({
  cedula,
  onCedula,
  consulta,
  onConsulta,
  otraDireccion,
  onOtraDireccion,
  direccionEntrega,
  onDireccionEntrega,
}: Props) {
  const recordada = useClienteTienda((s) => s.cedula);
  const olvidar = useClienteTienda((s) => s.olvidar);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConsultada = useRef(false);

  async function consultar(valor: string) {
    const digitos = soloDigitos(valor);
    if (digitos.length < 5) {
      setError("Escribe tu número de cédula, sin puntos.");
      return;
    }
    setError(null);
    setConsultando(true);
    try {
      onCedula(digitos);
      onConsulta(await consultarCliente(digitos));
    } catch (e) {
      setError(mensajeDeConsulta(e));
    } finally {
      setConsultando(false);
    }
  }

  // Quien ya pidió desde este navegador no vuelve a escribir su cédula.
  useEffect(() => {
    if (recordada && !consulta && !autoConsultada.current) {
      autoConsultada.current = true;
      void consultar(recordada);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordada]);

  function cambiarCedula() {
    olvidar();
    onConsulta(null);
    onCedula("");
    onOtraDireccion(false);
    onDireccionEntrega("");
  }

  if (!consulta) {
    return (
      <div className="ident">
        <label className="ident-titulo" htmlFor="ident-cedula">
          <IdCard size={18} aria-hidden="true" /> ¿Quién hace el pedido?
        </label>
        <p className="ident-texto">
          Escribe tu cédula. Si ya nos has pedido, no tendrás que volver a escribir tus datos.
        </p>
        <div className="ident-fila">
          <input
            id="ident-cedula"
            value={cedula}
            onChange={(e) => onCedula(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void consultar(cedula);
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Número de cédula"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "ident-error" : undefined}
          />
          <button
            type="button"
            className="btn btn-verde ident-btn"
            onClick={() => void consultar(cedula)}
            disabled={consultando}
          >
            {consultando ? <Loader2 size={18} className="girando" aria-hidden="true" /> : "Continuar"}
            {!consultando && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
        {error && (
          <p className="ident-error" id="ident-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const conocido = consulta.existe && !consulta.requiere_datos;

  return (
    <div className="ident">
      <div className="ident-cedula">
        <span>
          <IdCard size={15} aria-hidden="true" /> Cédula <b>{cedula}</b>
        </span>
        <button type="button" className="ident-cambiar" onClick={cambiarCedula}>
          {conocido ? "¿No eres tú?" : "Cambiar"}
        </button>
      </div>

      {conocido ? (
        <div className="ident-bienvenida" aria-live="polite">
          <p className="ident-hola">
            <UserRound size={18} aria-hidden="true" /> Hola, {consulta.nombre}
          </p>
          <p className="ident-texto">Ya tenemos tus datos. Solo confirma tu pedido.</p>
          <ul className="ident-datos">
            {consulta.telefono && (
              <li>
                <Phone size={14} aria-hidden="true" /> {consulta.telefono}
              </li>
            )}
            {consulta.direccion && !otraDireccion && (
              <li>
                <MapPin size={14} aria-hidden="true" /> Entregamos en {consulta.direccion}
              </li>
            )}
          </ul>
          {otraDireccion ? (
            <div className="campo ident-otra">
              <label htmlFor="ident-otra-dir">Dirección de entrega para este pedido *</label>
              <input
                id="ident-otra-dir"
                value={direccionEntrega}
                onChange={(e) => onDireccionEntrega(e.target.value)}
                placeholder="Calle, número, barrio y una referencia"
                autoFocus
              />
              <button
                type="button"
                className="ident-cambiar"
                onClick={() => {
                  onOtraDireccion(false);
                  onDireccionEntrega("");
                }}
              >
                Usar mi dirección de siempre
              </button>
            </div>
          ) : (
            <button type="button" className="ident-cambiar" onClick={() => onOtraDireccion(true)}>
              Entregar en otra dirección
            </button>
          )}
        </div>
      ) : (
        <p className="ident-primera" aria-live="polite">
          {consulta.existe
            ? "Completa tus datos. Te los pedimos una sola vez."
            : "Es tu primer pedido con nosotros. Te pedimos estos datos una sola vez."}
        </p>
      )}
    </div>
  );
}
