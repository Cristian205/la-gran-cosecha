import { Building2, Lock, MapPin, MessageSquareText, Phone, Store, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { EventoPedido } from "../../../types";
import type { EntregaEditable } from "./modelo";
import type { GestionPedido } from "./useGestionPedido";

export function EntregaPedido({ g, soloLectura }: { g: GestionPedido; soloLectura: boolean }) {
  const pedido = g.pedido!;
  const e = g.entrega!;
  const base = g.entregaBase!;
  const errores = g.erroresEntrega;
  // La dirección que escribió el cliente al pedir, de la foto del pedido
  // recibido (si existe): la actual pudo cambiarla el negocio.
  const recibido = g.eventos?.find((ev: EventoPedido) => ev.tipo === "RECIBIDO" && !ev.datos.sin_foto);
  const direccionPedida = recibido?.datos.direccion;

  function campo(
    clave: keyof EntregaEditable,
    etiqueta: string,
    icono: ReactNode,
    opciones: { placeholder?: string; ayuda?: string; multilinea?: boolean; tipo?: string } = {}
  ) {
    const cambiado = e[clave].trim() !== base[clave].trim();
    const error = errores[clave];
    const id = `gp-entrega-${clave}`;
    const comun = {
      id,
      className: `gp-input ${error ? "invalido" : ""} ${cambiado ? "cambiado" : ""}`,
      value: e[clave],
      disabled: soloLectura,
      placeholder: opciones.placeholder,
      "aria-invalid": Boolean(error),
      "aria-describedby": opciones.ayuda || error ? `${id}-ayuda` : undefined,
    };
    return (
      <div className="gp-campo">
        <label htmlFor={id}>
          {icono} {etiqueta}
          {cambiado && <span className="gp-sin-guardar">Sin guardar</span>}
        </label>
        {opciones.multilinea ? (
          <textarea {...comun} rows={3} onChange={(ev) => g.cambiarEntrega(clave, ev.target.value)} />
        ) : (
          <input {...comun} type={opciones.tipo ?? "text"} onChange={(ev) => g.cambiarEntrega(clave, ev.target.value)} />
        )}
        {(error || opciones.ayuda) && (
          <small id={`${id}-ayuda`} className={error ? "gp-error-campo" : "gp-ayuda"}>
            {error ?? opciones.ayuda}
          </small>
        )}
      </div>
    );
  }

  return (
    <div className="gp-entrega">
      <section className="gp-superficie gp-entrega-cliente" aria-labelledby="gp-entrega-cliente-titulo">
        <header className="gp-superficie-cabecera">
          <h3 id="gp-entrega-cliente-titulo">
            <Store size={15} /> Proporcionado por el cliente
          </h3>
          <span className="gp-marca original">Solo lectura</span>
        </header>
        <dl className="gp-ficha una-columna">
          <div>
            <dt>
              <UserRound size={14} /> Cliente
            </dt>
            <dd>
              {pedido.cliente_nombre || "—"}
              {pedido.cliente_documento && <small>C.C./NIT {pedido.cliente_documento}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <Phone size={14} /> Teléfono registrado
            </dt>
            <dd>{pedido.cliente_telefono || <span className="gp-tenue">No registró teléfono</span>}</dd>
          </div>
          <div>
            <dt>
              <MapPin size={14} /> Dirección registrada
            </dt>
            <dd>{pedido.cliente_direccion || <span className="gp-tenue">No registró dirección</span>}</dd>
          </div>
          {direccionPedida && direccionPedida !== pedido.cliente_direccion && (
            <div>
              <dt>
                <MapPin size={14} /> Dirección indicada en este pedido
              </dt>
              <dd>{direccionPedida}</dd>
            </div>
          )}
          <div>
            <dt>
              <MessageSquareText size={14} /> Observaciones del pedido
            </dt>
            <dd>
              {pedido.observaciones?.trim() ? (
                <blockquote className="gp-cita">{pedido.observaciones}</blockquote>
              ) : (
                <span className="gp-tenue">Sin observaciones</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="gp-superficie gp-entrega-negocio" aria-labelledby="gp-entrega-negocio-titulo">
        <header className="gp-superficie-cabecera">
          <h3 id="gp-entrega-negocio-titulo">
            <Building2 size={15} /> Logística del negocio
          </h3>
          {!soloLectura && <span className="gp-tenue gp-pequeno">Los cambios quedan en el historial</span>}
        </header>

        {campo("direccion_entrega", "Dirección de entrega", <MapPin size={14} />, {
          placeholder: pedido.cliente_direccion || "Dirección donde se entrega",
          ayuda: e.direccion_entrega.trim()
            ? "Solo para este pedido: la dirección guardada del cliente no cambia."
            : "Vacío = la dirección registrada del cliente.",
        })}
        <div className="gp-fila-campos">
          {campo("telefono_entrega", "Teléfono de contacto", <Phone size={14} />, {
            placeholder: pedido.cliente_telefono || "Teléfono para la entrega",
            tipo: "tel",
            ayuda: e.telefono_entrega.trim() ? undefined : "Vacío = el teléfono del cliente.",
          })}
          {campo("recibe_nombre", "Persona que recibe", <UserRound size={14} />, {
            placeholder: pedido.cliente_nombre || "Nombre de quien recibe",
          })}
        </div>
        {campo("fecha_programada", "Fecha programada", null, {
          tipo: "datetime-local",
          ayuda: e.fecha_programada ? undefined : "Sin programar: la factura asume el día siguiente al pedido.",
        })}
        {campo("indicaciones_entrega", "Indicaciones de entrega", null, {
          multilinea: true,
          placeholder: "Ej.: timbre dañado, llamar al llegar. Dejar en portería.",
        })}

        <div className="gp-notas-internas">
          {campo("notas_internas", "Observaciones internas", <Lock size={14} />, {
            multilinea: true,
            placeholder: "Solo para el equipo",
            ayuda: "Nunca se le muestran al cliente ni salen en la factura.",
          })}
        </div>
      </section>
    </div>
  );
}
