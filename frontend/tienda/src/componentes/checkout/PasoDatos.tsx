"use client";

import { useState } from "react";
import { Check, IdCard, MapPin, PencilLine, Phone, ShieldCheck, UserRound } from "lucide-react";
import type { ClienteConsultado } from "@/lib/tipos";
import { cedulaOculta } from "./PasoIdentificacion";

/** Códigos de país del selector de teléfono. Colombia primero y por
 *  defecto: es donde opera el negocio; el resto cubre proveedores o
 *  sucursales fuera del país sin obligarlos a escribir el código a mano. */
export const CODIGOS_PAIS = [
  { valor: "+57", etiqueta: "🇨🇴 +57" },
  { valor: "+1", etiqueta: "🇺🇸 +1" },
  { valor: "+52", etiqueta: "🇲🇽 +52" },
  { valor: "+51", etiqueta: "🇵🇪 +51" },
  { valor: "+593", etiqueta: "🇪🇨 +593" },
  { valor: "+58", etiqueta: "🇻🇪 +58" },
];

export interface DatosNuevos {
  nombre: string;
  /** Nombre del negocio por el que pide. */
  negocio: string;
  codigoPais: string;
  telefono: string;
  direccion: string;
}

/** Lo que un cliente conocido pide cambiar. Ver la nota de `FichaCliente`. */
export interface Actualizacion {
  direccionEntrega: string;
  solicitud: string;
}

interface Props {
  porCedula: boolean;
  cedula: string;
  consulta: ClienteConsultado | null;
  /** Cliente con cédula y datos completos: se confirma la ficha, no se escribe. */
  conocido: boolean;
  datos: DatosNuevos;
  onDatos: (datos: DatosNuevos) => void;
  /** Errores por campo del formulario de registro (los marca quien valida). */
  errores: Partial<Record<keyof DatosNuevos, string>>;
  actualizacion: Actualizacion;
  onActualizacion: (a: Actualizacion) => void;
  onConfirmar: () => void;
  onCambiarCedula: () => void;
}

/**
 * Paso 2: los datos de quien pide.
 *
 *   - Cliente conocido (cédula con datos completos): una ficha para
 *     reconocerse y confirmar. No se avanza sin pulsar una de las dos.
 *   - Cliente nuevo, o con datos a medias: el registro, una sola vez.
 *   - Tienda que identifica por nombre: el mismo formulario.
 */
export function PasoDatos(props: Props) {
  const { porCedula, conocido, consulta } = props;
  return (
    <section className="chk-seccion" aria-labelledby="chk-datos-titulo">
      {porCedula && conocido && consulta ? (
        <FichaCliente {...props} consulta={consulta} />
      ) : (
        <Registro {...props} />
      )}
    </section>
  );
}

/**
 * Lo que se ve de un cliente conocido va enmascarado, tal como lo devuelve el
 * servidor: saber una cédula no basta para leer el teléfono o la dirección de
 * otra persona.
 *
 * Por la misma razón, "actualizar mis datos" NO reescribe la ficha guardada:
 * el servidor no deja que quien escribe una cédula cambie el teléfono o la
 * dirección de esa persona (`_cliente_por_cedula`). Lo que sí se puede:
 *   - Otra dirección de entrega PARA ESTE PEDIDO (`direccion_entrega`), que
 *     el pedido guarda aparte sin tocar la del cliente.
 *   - Pedir el cambio del teléfono o el nombre: viaja en las observaciones
 *     del pedido y el negocio lo verifica con el cliente antes de cambiarlo
 *     desde el panel.
 *
 * Integración pendiente: con una verificación de identidad (código de un solo
 * uso por SMS o WhatsApp al teléfono guardado) el cliente podría editar su
 * ficha él mismo. Hoy el proyecto no tiene ese canal; el segundo nivel de
 * identificación (usuario y contraseña) está declarado en
 * `StoreSettings.IDENTIFICACIONES` pero sin construir.
 */
function FichaCliente({
  cedula,
  consulta,
  actualizacion,
  onActualizacion,
  onConfirmar,
  onCambiarCedula,
}: Props & { consulta: ClienteConsultado }) {
  const [actualizando, setActualizando] = useState(
    Boolean(actualizacion.direccionEntrega || actualizacion.solicitud)
  );
  const [error, setError] = useState<string | null>(null);

  function guardarCambios() {
    if (!actualizacion.direccionEntrega.trim() && !actualizacion.solicitud.trim()) {
      setError("Escribe la nueva dirección de entrega o qué dato necesitas cambiar.");
      return;
    }
    setError(null);
    onConfirmar();
  }

  return (
    <>
      <h2 className="chk-titulo" id="chk-datos-titulo" tabIndex={-1}>
        <UserRound size={20} aria-hidden="true" /> Hola, {consulta.nombre}
      </h2>
      <p className="chk-texto">Encontramos tus datos. Confirma que son los tuyos para seguir.</p>

      <dl className="chk-ficha">
        <div>
          <dt>
            <UserRound size={15} aria-hidden="true" /> Nombre
          </dt>
          <dd>{consulta.nombre}</dd>
        </div>
        <div>
          <dt>
            <IdCard size={15} aria-hidden="true" /> Documento
          </dt>
          <dd>{cedulaOculta(cedula)}</dd>
        </div>
        <div>
          <dt>
            <Phone size={15} aria-hidden="true" /> Teléfono
          </dt>
          <dd>{consulta.telefono || "Sin registrar"}</dd>
        </div>
        <div>
          <dt>
            <MapPin size={15} aria-hidden="true" /> Dirección de entrega
          </dt>
          <dd>
            {actualizacion.direccionEntrega.trim() ? (
              <>
                <s className="chk-tachado">{consulta.direccion}</s> {actualizacion.direccionEntrega}
              </>
            ) : (
              consulta.direccion || "Sin registrar"
            )}
          </dd>
        </div>
      </dl>
      <p className="chk-nota">
        <ShieldCheck size={14} aria-hidden="true" /> Por tu seguridad, tus datos se muestran
        parcialmente ocultos.
      </p>

      {!actualizando ? (
        <div className="chk-ficha-acciones">
          <button type="button" className="btn btn-verde" onClick={onConfirmar}>
            <Check size={17} aria-hidden="true" /> Sí, estos son mis datos
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setActualizando(true)}>
            <PencilLine size={16} aria-hidden="true" /> Necesito actualizar mis datos
          </button>
        </div>
      ) : (
        <div className="chk-actualizar">
          <div className="campo">
            <label htmlFor="chk-dir-entrega">Entregar este pedido en otra dirección</label>
            <input
              id="chk-dir-entrega"
              value={actualizacion.direccionEntrega}
              onChange={(e) => onActualizacion({ ...actualizacion, direccionEntrega: e.target.value })}
              placeholder="Calle, número, barrio y una referencia"
              autoComplete="street-address"
            />
          </div>
          <div className="campo">
            <label htmlFor="chk-solicitud">¿Cambió tu teléfono o tu nombre?</label>
            <textarea
              id="chk-solicitud"
              rows={2}
              value={actualizacion.solicitud}
              onChange={(e) => onActualizacion({ ...actualizacion, solicitud: e.target.value })}
              placeholder="Ej: mi nuevo teléfono es 300 123 4567"
            />
            <p className="chk-ayuda">
              Por tu seguridad no cambiamos estos datos desde la tienda: el negocio los verifica
              contigo y los actualiza.
            </p>
          </div>
          {error && (
            <p className="ident-error" role="alert">
              {error}
            </p>
          )}
          <div className="chk-ficha-acciones">
            <button type="button" className="btn btn-verde" onClick={guardarCambios}>
              <Check size={17} aria-hidden="true" /> Continuar con estos cambios
            </button>
            <button
              type="button"
              className="ident-cambiar"
              onClick={() => {
                onActualizacion({ direccionEntrega: "", solicitud: "" });
                setError(null);
                setActualizando(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="chk-otra-persona">
        ¿No eres tú?{" "}
        <button type="button" className="ident-cambiar" onClick={onCambiarCedula}>
          Usar otra cédula
        </button>
      </p>
    </>
  );
}

function Registro({ porCedula, cedula, consulta, datos, onDatos, errores, onCambiarCedula }: Props) {
  const cambiar = (campo: keyof DatosNuevos) => (e: { target: { value: string } }) =>
    onDatos({ ...datos, [campo]: e.target.value });
  const completar = porCedula && consulta?.existe;

  return (
    <>
      <h2 className="chk-titulo" id="chk-datos-titulo" tabIndex={-1}>
        <UserRound size={20} aria-hidden="true" />{" "}
        {completar ? "Completa tus datos" : porCedula ? "Regístrate en un minuto" : "Tus datos de entrega"}
      </h2>
      <p className="chk-texto">
        {porCedula
          ? completar
            ? "Te los pedimos una sola vez; en tus próximos pedidos solo escribirás tu cédula."
            : "Es tu primer pedido con nosotros. Te pedimos estos datos una sola vez."
          : "Para saber a quién y dónde entregar tu pedido."}
      </p>

      {porCedula && (
        <p className="ident-cedula chk-cedula-registro">
          <span>
            <IdCard size={15} aria-hidden="true" /> Cédula <b>{cedula}</b>
          </span>
          <button type="button" className="ident-cambiar" onClick={onCambiarCedula}>
            Cambiar
          </button>
        </p>
      )}

      <div className="campo">
        <label htmlFor="chk-nombre">Tu nombre *</label>
        <input
          id="chk-nombre"
          value={datos.nombre}
          onChange={cambiar("nombre")}
          placeholder="Ej: José Pérez"
          autoComplete="name"
          aria-invalid={Boolean(errores.nombre)}
          aria-describedby={errores.nombre ? "chk-nombre-error" : undefined}
        />
        {errores.nombre && (
          <p className="ident-error" id="chk-nombre-error">
            {errores.nombre}
          </p>
        )}
      </div>
      <div className="campo">
        <label htmlFor="chk-negocio">Nombre del negocio *</label>
        <input
          id="chk-negocio"
          value={datos.negocio}
          onChange={cambiar("negocio")}
          placeholder="Ej: Tienda Don José"
          autoComplete="organization"
          aria-invalid={Boolean(errores.negocio)}
          aria-describedby={errores.negocio ? "chk-negocio-error" : undefined}
        />
        {errores.negocio && (
          <p className="ident-error" id="chk-negocio-error">
            {errores.negocio}
          </p>
        )}
      </div>
      <div className="campo">
        <label htmlFor="chk-telefono">Teléfono *</label>
        <div className="campo-telefono">
          <select value={datos.codigoPais} onChange={cambiar("codigoPais")} aria-label="Código de país">
            {CODIGOS_PAIS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
          <input
            id="chk-telefono"
            value={datos.telefono}
            onChange={cambiar("telefono")}
            placeholder="300 123 4567"
            inputMode="tel"
            autoComplete="tel-national"
            aria-invalid={Boolean(errores.telefono)}
            aria-describedby={errores.telefono ? "chk-telefono-error" : undefined}
          />
        </div>
        {errores.telefono && (
          <p className="ident-error" id="chk-telefono-error">
            {errores.telefono}
          </p>
        )}
      </div>
      <div className="campo">
        <label htmlFor="chk-direccion">Dirección de entrega *</label>
        <input
          id="chk-direccion"
          value={datos.direccion}
          onChange={cambiar("direccion")}
          placeholder="Calle, número, barrio y una referencia para encontrarte"
          autoComplete="street-address"
          aria-invalid={Boolean(errores.direccion)}
          aria-describedby={errores.direccion ? "chk-direccion-error" : undefined}
        />
        {errores.direccion && (
          <p className="ident-error" id="chk-direccion-error">
            {errores.direccion}
          </p>
        )}
      </div>
    </>
  );
}
