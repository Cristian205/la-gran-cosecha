import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { DatosContacto, Solucion } from "../contenido/tipos";
import { registrar } from "../lib/analitica";
import { enviarSolicitud, urlWhatsApp, type SolicitudComercial } from "../lib/contacto";
import { usarSolucionElegida } from "../lib/solucion";

type Opcion = SolicitudComercial["solucion"];
type Estado = "reposo" | "enviando" | "enviado" | "error";

const EXPRESION_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Un correo o un teléfono: algo a lo que se pueda responder. Misma regla que el backend. */
function contactoValido(valor: string): boolean {
  const v = valor.trim();
  const digitos = v.replace(/\D/g, "");
  return EXPRESION_CORREO.test(v) || (digitos.length >= 7 && digitos.length <= 15 && /^[\d\s()+\-.]+$/.test(v));
}

const MENSAJES_ERROR: Record<string, string> = {
  limite: "Enviaste varias solicitudes seguidas. Espera un rato e inténtalo de nuevo.",
  red: "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",
  servidor: "No pudimos guardar tu solicitud. Inténtalo de nuevo en unos minutos.",
};

/**
 * El formulario comercial de la escena 08. Pregunta lo mínimo para empezar una
 * conversación: nombre, negocio, tipo de solución, una descripción breve y
 * cómo responderle.
 *
 * - La modalidad llega elegida si la persona pulsó antes un botón de Commerce,
 *   Custom o Growth, y viaja con la solicitud junto con el `origen` de ese
 *   botón: así se sabe qué escena convierte.
 * - `sitio_web` es una trampa para bots (va escondido): una persona nunca lo
 *   llena y el backend descarta lo que llega con algo ahí.
 * - Si no se puede enviar, la persona no pierde lo que escribió: se le ofrece
 *   seguir por WhatsApp con el mensaje ya armado.
 */
export function FormularioComercial({ datos }: { datos: DatosContacto }) {
  const elegida = usarSolucionElegida();
  const [campos, setCampos] = useState({
    nombre: "",
    negocio: "",
    solucion: "por_definir" as Opcion,
    descripcion: "",
    contacto: "",
    sitio_web: "",
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Estado>("reposo");
  const [fallo, setFallo] = useState<string | null>(null);
  const iniciado = useRef(false);

  /* Un botón de modalidad en cualquier escena deja elegida esa opción aquí. */
  useEffect(() => {
    if (elegida.solucion) setCampos((c) => ({ ...c, solucion: elegida.solucion as Solucion }));
  }, [elegida]);

  function alCambiar(evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = evento.target;
    setCampos((c) => ({ ...c, [name]: value }));
    if (errores[name]) setErrores((e) => ({ ...e, [name]: "" }));
  }

  function alEnfocar() {
    if (iniciado.current) return;
    iniciado.current = true;
    registrar("formulario_iniciado", { solucion: campos.solucion, origen: elegida.origen ?? "" });
  }

  function validar(): Record<string, string> {
    const e: Record<string, string> = {};
    if (campos.nombre.trim().length < 2) e.nombre = "Cuéntanos cómo te llamas.";
    if (!contactoValido(campos.contacto)) e.contacto = "Déjanos un correo o un teléfono válido para responderte.";
    return e;
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) {
      document.getElementById(e.nombre ? "campo-nombre" : "campo-contacto")?.focus();
      return;
    }
    setEstado("enviando");
    setFallo(null);
    const respuesta = await enviarSolicitud({
      ...campos,
      nombre: campos.nombre.trim(),
      negocio: campos.negocio.trim(),
      descripcion: campos.descripcion.trim(),
      contacto: campos.contacto.trim(),
      origen: elegida.origen ?? "formulario",
    });
    if (respuesta.ok) {
      registrar("formulario_enviado", { solucion: campos.solucion, origen: elegida.origen ?? "formulario" });
      setEstado("enviado");
      return;
    }
    if (respuesta.motivo === "validacion") {
      setErrores(respuesta.errores);
      setEstado("reposo");
      return;
    }
    registrar("formulario_error", { motivo: respuesta.motivo });
    setFallo(MENSAJES_ERROR[respuesta.motivo] ?? MENSAJES_ERROR.servidor!);
    setEstado("error");
  }

  /* El mensaje de WhatsApp lleva lo que la persona ya escribió. */
  const resumen = [
    campos.nombre && `Soy ${campos.nombre.trim()}${campos.negocio ? `, de ${campos.negocio.trim()}` : ""}.`,
    campos.descripcion && campos.descripcion.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  const urlWa = urlWhatsApp(campos.solucion === "por_definir" ? null : campos.solucion, resumen || undefined);

  if (estado === "enviado") {
    return (
      <div className="formulario formulario--exito" role="status">
        <CheckCircle2 aria-hidden="true" />
        <h3>¡Recibimos tu solicitud!</h3>
        <p>Te escribiremos al contacto que dejaste para conversar sobre tu proyecto.</p>
        {urlWa && (
          <a
            className="boton boton--secundario"
            href={urlWa}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => registrar("contacto_whatsapp", { origen: "formulario-exito", solucion: campos.solucion })}
          >
            <MessageCircle className="boton__icono" aria-hidden="true" /> Continuar por WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form className="formulario" onSubmit={alEnviar} noValidate>
      <fieldset className="formulario__soluciones">
        <legend>¿Qué necesitas?</legend>
        <div className="opciones-solucion">
          {datos.opciones.map((o) => (
            <label key={o.valor} className={`opcion-solucion ${campos.solucion === o.valor ? "activa" : ""}`}>
              <input
                type="radio"
                name="solucion"
                value={o.valor}
                checked={campos.solucion === o.valor}
                onChange={() => {
                  setCampos((c) => ({ ...c, solucion: o.valor }));
                  if (o.valor !== "por_definir") registrar("solucion_seleccionada", { solucion: o.valor, origen: "formulario" });
                }}
                onFocus={alEnfocar}
              />
              <span>{o.etiqueta}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="formulario__par">
        <Campo
          id="campo-nombre"
          etiqueta="Tu nombre"
          error={errores.nombre}
          requerido
          input={
            <input
              id="campo-nombre"
              name="nombre"
              autoComplete="name"
              value={campos.nombre}
              onChange={alCambiar}
              onFocus={alEnfocar}
              aria-invalid={Boolean(errores.nombre)}
              aria-describedby={errores.nombre ? "error-nombre" : undefined}
              maxLength={120}
            />
          }
        />
        <Campo
          id="campo-negocio"
          etiqueta="Tu negocio"
          input={<input id="campo-negocio" name="negocio" autoComplete="organization" value={campos.negocio} onChange={alCambiar} onFocus={alEnfocar} maxLength={160} />}
        />
      </div>

      <Campo
        id="campo-descripcion"
        etiqueta="Cuéntanos tu proyecto"
        ayuda="Opcional. Dos líneas bastan."
        input={<textarea id="campo-descripcion" name="descripcion" rows={3} value={campos.descripcion} onChange={alCambiar} onFocus={alEnfocar} maxLength={1500} />}
      />

      <Campo
        id="campo-contacto"
        etiqueta="Correo o teléfono"
        error={errores.contacto}
        requerido
        input={
          <input
            id="campo-contacto"
            name="contacto"
            autoComplete="email"
            inputMode="email"
            value={campos.contacto}
            onChange={alCambiar}
            onFocus={alEnfocar}
            aria-invalid={Boolean(errores.contacto)}
            aria-describedby={errores.contacto ? "error-contacto" : undefined}
            maxLength={160}
          />
        }
      />

      {/* Trampa para bots: escondida para las personas y para los lectores de pantalla. */}
      <div className="formulario__trampa" aria-hidden="true">
        <label>
          No lo llenes
          <input name="sitio_web" tabIndex={-1} autoComplete="off" value={campos.sitio_web} onChange={alCambiar} />
        </label>
      </div>

      <AnimatePresence>
        {fallo && (
          <motion.div className="formulario__fallo" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p>{fallo}</p>
            {urlWa && (
              <a
                href={urlWa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrar("contacto_whatsapp", { origen: "formulario-error", solucion: campos.solucion })}
              >
                Escríbenos por WhatsApp con lo que ya llenaste
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button type="submit" className="boton boton--primario formulario__enviar" disabled={estado === "enviando"}>
        <span className="boton__texto">{estado === "enviando" ? "Enviando…" : "Hablemos de tu proyecto"}</span>
        {estado === "enviando" ? <Loader2 className="boton__icono boton__icono--giro" aria-hidden="true" /> : <Send className="boton__icono" aria-hidden="true" />}
      </button>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  requerido = false,
  input,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  input: ReactNode;
}) {
  return (
    <div className={`campo ${error ? "campo--error" : ""}`}>
      <label htmlFor={id}>
        <span>
          {etiqueta}
          {requerido && <span aria-hidden="true"> *</span>}
        </span>
        {ayuda && <small>{ayuda}</small>}
      </label>
      {input}
      {error && (
        <span className="campo__error" id={`error-${id.replace("campo-", "")}`}>
          {error}
        </span>
      )}
    </div>
  );
}
