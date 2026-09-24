"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, LoaderCircle, Send } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { enviarMensajeContacto } from "@/lib/datos";
import { whatsappHref } from "@/lib/utiles";
import { ContactSuccess } from "./ContactSuccess";

/**
 * El formulario de /contacto, como conversación y no como planilla.
 *
 * Cada campo es una frase que el cliente completa ("Soy…", "Estoy
 * buscando…", "Necesito aproximadamente…"), y la solicitud avanza a la vista:
 * cuántos datos faltan y, cuando no falta ninguno, "✓ Solicitud preparada".
 *
 * # Qué recibe el backend
 *
 * `contact.MensajeContacto`: nombre, teléfono, correo (opcional si hay
 * teléfono), `motivo` y el `mensaje`. Los datos propios de cada caso —tipo de
 * negocio, cantidad, fecha— van REDACTADOS dentro del mensaje, en líneas
 * legibles: quien responde es una persona, y así los lee en la bandeja sin
 * que el panel tenga que saber de cotizaciones.
 *
 * # Estados
 *
 * vacío → escribiendo → (error) → enviando → enviado. Un fallo del servidor
 * NO borra lo escrito: la persona reintenta o se lleva la misma solicitud a
 * WhatsApp, ya redactada.
 */
export interface DefinicionCampo {
  nombre: string;
  /** La frase que el cliente completa: "Mi teléfono", "Estoy buscando". */
  etiqueta: string;
  tipo?: "texto" | "tel" | "email" | "fecha" | "area" | "opciones";
  opciones?: string[];
  placeholder?: string;
  ayuda?: string;
  requerido?: boolean;
  /** Dato para responder por la web; por WhatsApp sobra (ya se sabe quién escribe). */
  soloWeb?: boolean;
  autoComplete?: string;
  /** Ocupa media fila en escritorio. */
  medio?: boolean;
  /** Cómo se llama el dato dentro del mensaje ("Cantidad aproximada"). */
  rotulo?: string;
}

export interface DefinicionSolicitud {
  motivo: string;
  /** Primera línea del mensaje: qué tipo de solicitud es. */
  asunto: string;
  campos: DefinicionCampo[];
  /** Al menos uno de estos (teléfono o correo) para poder responder. */
  unoDe?: [string, string];
  boton?: string;
}

type Valores = Record<string, string>;
type Errores = Record<string, string>;
type Canal = "web" | "whatsapp";

const SOLO_DIGITOS = /\D/g;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(def: DefinicionSolicitud, v: Valores, canal: Canal): Errores {
  const errores: Errores = {};
  for (const c of def.campos) {
    const valor = (v[c.nombre] ?? "").trim();
    if (canal === "whatsapp" && c.soloWeb) continue;
    if (c.requerido && !valor) {
      errores[c.nombre] = c.tipo === "opciones" ? "Elige una opción." : "Cuéntanos esto para poder ayudarte.";
      continue;
    }
    if (!valor) continue;
    if (c.tipo === "tel" && valor.replace(SOLO_DIGITOS, "").length < 7) {
      errores[c.nombre] = "Revisa el número: le faltan dígitos.";
    }
    if (c.tipo === "email" && !CORREO.test(valor)) {
      errores[c.nombre] = "Revisa el correo: parece incompleto.";
    }
  }
  if (canal === "web" && def.unoDe) {
    const [a, b] = def.unoDe;
    if (!v[a]?.trim() && !v[b]?.trim() && !errores[a] && !errores[b]) {
      errores[a] = "Déjanos un teléfono o un correo para responderte.";
    }
  }
  return errores;
}

function fechaLegible(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

/** Las líneas legibles de la solicitud (lo que llega a la bandeja y a WhatsApp). */
function redactar(def: DefinicionSolicitud, v: Valores): string {
  const lineas = def.campos
    .filter((c) => !c.soloWeb && (v[c.nombre] ?? "").trim())
    .map((c) => {
      const valor = v[c.nombre].trim();
      return `${c.rotulo ?? c.etiqueta}: ${c.tipo === "fecha" ? fechaLegible(valor) : valor}`;
    });
  return [def.asunto, ...lineas].join("\n");
}

export function Solicitud({ def }: { def: DefinicionSolicitud }) {
  const { config } = useSiteConfig();
  const base = useId();
  const inicial = () => Object.fromEntries(def.campos.map((c) => [c.nombre, ""]));
  const [valores, setValores] = useState<Valores>(inicial);
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [exito, setExito] = useState(false);
  const [fallo, setFallo] = useState("");

  const errores = intentado ? validar(def, valores, "web") : {};
  const hayErrores = Object.keys(errores).length > 0;
  const requeridos = def.campos.filter((c) => c.requerido);
  const completos = requeridos.filter((c) => valores[c.nombre]?.trim()).length;
  const lista = Object.keys(validar(def, valores, "web")).length === 0;
  const escrito = Object.values(valores).some((x) => x.trim());
  const estado = enviado
    ? "enviado"
    : enviando
      ? "enviando"
      : fallo || (intentado && hayErrores)
        ? "error"
        : escrito
          ? "escribiendo"
          : "vacio";

  const idDe = (nombre: string) => `${base}-${nombre}`;
  const nombre = (valores.nombre ?? "").trim();
  const cuerpo = redactar(def, valores);
  const textoWhatsapp = `Hola${nombre ? `, soy ${nombre}` : ""}. ${cuerpo}`;

  // El botón muestra "✓ Solicitud enviada" un instante antes de dar paso a
  // la confirmación: la persona ve que SU acción funcionó, no un salto.
  useEffect(() => {
    if (!enviado) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setExito(true), quieto ? 0 : 850);
    return () => window.clearTimeout(t);
  }, [enviado]);

  function cambiar(campo: string, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (fallo) setFallo("");
  }

  function enfocarPrimerError(errs: Errores) {
    const primero = def.campos.find((c) => errs[c.nombre]);
    if (primero) document.getElementById(idDe(primero.nombre))?.focus();
  }

  async function enviar(canal: Canal) {
    const errs = validar(def, valores, canal);
    if (Object.keys(errs).length > 0) {
      setIntentado(true);
      enfocarPrimerError(errs);
      return;
    }
    if (canal === "whatsapp") {
      window.open(whatsappHref(config.whatsapp_numero, textoWhatsapp), "_blank", "noopener,noreferrer");
      return;
    }
    setIntentado(true);
    setEnviando(true);
    setFallo("");
    try {
      await enviarMensajeContacto({
        nombre: nombre || "Sin nombre",
        telefono: (valores.telefono ?? "").trim(),
        email: (valores.email ?? "").trim(),
        mensaje: cuerpo,
        motivo: def.motivo,
      });
      setEnviado(true);
    } catch {
      setFallo(
        config.whatsapp_numero
          ? "No pudimos enviar tu solicitud. Lo que escribiste sigue aquí: intenta de nuevo o envíala por WhatsApp."
          : "No pudimos enviar tu solicitud. Lo que escribiste sigue aquí: intenta de nuevo en un momento."
      );
    } finally {
      setEnviando(false);
    }
  }

  function otra() {
    setValores(inicial());
    setIntentado(false);
    setEnviado(false);
    setExito(false);
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (!enviando && !enviado) void enviar("web");
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {exito ? (
        <motion.div
          key="exito"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <ContactSuccess resumen={cuerpo} whatsappMensaje={textoWhatsapp} onOtra={otra} />
        </motion.div>
      ) : (
        <motion.form
          key="form"
          className="ct-form"
          data-estado={estado}
          noValidate
          onSubmit={alEnviar}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          aria-busy={enviando}
        >
          <div className="ct-form-campos">
            {def.campos.map((c) => (
              <Campo
                key={c.nombre}
                id={idDe(c.nombre)}
                def={c}
                valor={valores[c.nombre] ?? ""}
                error={errores[c.nombre]}
                onCambio={(v) => cambiar(c.nombre, v)}
              />
            ))}
          </div>

          {hayErrores && (
            <p className="ct-form-aviso ct-form-aviso--error" role="alert">
              Falta{Object.keys(errores).length > 1 ? "n" : ""} {Object.keys(errores).length}{" "}
              {Object.keys(errores).length > 1 ? "datos" : "dato"} para enviar tu solicitud. Te los marcamos arriba.
            </p>
          )}
          {fallo && (
            <p className="ct-form-aviso ct-form-aviso--error" role="alert">
              {fallo}
            </p>
          )}

          <div className="ct-form-pie">
            <Avance lista={lista} completos={completos} total={requeridos.length} />
            <div className="ct-form-acciones">
              <button
                type="submit"
                className={`ct-enviar ${enviado ? "ct-enviar--ok" : ""}`}
                disabled={enviando || enviado}
              >
                {enviado ? (
                  <>
                    <Check size={19} aria-hidden="true" /> Solicitud enviada
                  </>
                ) : enviando ? (
                  <>
                    <LoaderCircle size={19} className="ct-gira" aria-hidden="true" /> Enviando…
                  </>
                ) : (
                  <>
                    {def.boton ?? "Enviar solicitud"} <Send size={17} aria-hidden="true" />
                  </>
                )}
              </button>
              {config.whatsapp_numero && (
                <button
                  type="button"
                  className="ct-alterno"
                  onClick={() => void enviar("whatsapp")}
                  disabled={enviando || enviado}
                >
                  <WhatsAppIcon size={17} /> Enviarla por WhatsApp
                </button>
              )}
            </div>
          </div>
          <p className="ct-sr" aria-live="polite">
            {enviando ? "Enviando tu solicitud." : enviado ? "Solicitud enviada." : lista ? "Solicitud preparada." : ""}
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

/** "Faltan 2 datos" → "✓ Solicitud preparada": la solicitud avanza a la vista. */
function Avance({ lista, completos, total }: { lista: boolean; completos: number; total: number }) {
  const faltan = Math.max(total - completos, 0);
  return (
    <div className={`ct-avance ${lista ? "ct-avance--lista" : ""}`}>
      <span className="ct-avance-barra" aria-hidden="true">
        <span style={{ transform: `scaleX(${lista ? 1 : total ? completos / total : 0})` }} />
      </span>
      <span className="ct-avance-texto">
        {lista ? (
          <>
            <Check size={15} aria-hidden="true" /> Solicitud preparada
          </>
        ) : faltan > 0 ? (
          `Faltan ${faltan} ${faltan === 1 ? "dato" : "datos"}`
        ) : (
          "Falta cómo responderte"
        )}
      </span>
    </div>
  );
}

function Campo({
  id,
  def,
  valor,
  error,
  onCambio,
}: {
  id: string;
  def: DefinicionCampo;
  valor: string;
  error?: string;
  onCambio: (v: string) => void;
}) {
  const describe = [def.ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const comunes = {
    id,
    name: def.nombre,
    value: valor,
    required: def.requerido,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describe,
    autoComplete: def.autoComplete,
  };
  const hoy = new Date();
  const minimo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  return (
    <div className={`ct-campo ${def.medio ? "ct-campo--medio" : ""} ${error ? "ct-campo--error" : ""} ${valor.trim() ? "ct-campo--lleno" : ""}`}>
      <label className="ct-etiqueta" htmlFor={id}>
        {def.etiqueta}
        {!def.requerido && <span className="ct-opcional">opcional</span>}
      </label>
      {def.tipo === "area" ? (
        <textarea {...comunes} rows={3} placeholder={def.placeholder} onChange={(e) => onCambio(e.target.value)} />
      ) : def.tipo === "opciones" ? (
        <select {...comunes} onChange={(e) => onCambio(e.target.value)}>
          <option value="">{def.placeholder ?? "Elige una opción"}</option>
          {(def.opciones ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...comunes}
          type={def.tipo === "tel" ? "tel" : def.tipo === "email" ? "email" : def.tipo === "fecha" ? "date" : "text"}
          inputMode={def.tipo === "tel" ? "tel" : def.tipo === "email" ? "email" : undefined}
          min={def.tipo === "fecha" ? minimo : undefined}
          placeholder={def.placeholder}
          onChange={(e) => onCambio(e.target.value)}
        />
      )}
      {def.ayuda && (
        <p id={`${id}-ayuda`} className="ct-ayuda">
          {def.ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="ct-error">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Las tres solicitudes. Solo cambia QUÉ se pregunta: el cómo es el mismo.
// ---------------------------------------------------------------------------
const TIPOS_DE_NEGOCIO = ["Restaurante", "Frutería", "Cafetería", "Tienda o comercio", "Otro negocio"];

const NOMBRE: DefinicionCampo = {
  nombre: "nombre",
  etiqueta: "Mi nombre o el de mi negocio",
  placeholder: "Ej: Restaurante La Esquina",
  requerido: true,
  soloWeb: true,
  autoComplete: "organization",
  medio: true,
};

const TELEFONO: DefinicionCampo = {
  nombre: "telefono",
  etiqueta: "Mi teléfono",
  tipo: "tel",
  placeholder: "Para responderte",
  requerido: true,
  soloWeb: true,
  autoComplete: "tel",
  medio: true,
};

const NOTAS: DefinicionCampo = {
  nombre: "notas",
  etiqueta: "Algo más que debamos saber",
  tipo: "area",
  placeholder: "Dirección de entrega, horario en que recibes, calidad o tamaño que prefieres…",
  rotulo: "Observaciones",
};

/** Pedido grande: lo que hace falta para revisar disponibilidad y precio. */
export const COTIZACION: DefinicionSolicitud = {
  motivo: "COTIZACION",
  asunto: "Solicitud de cotización (pedido grande)",
  boton: "Enviar solicitud",
  campos: [
    {
      nombre: "negocio",
      etiqueta: "Soy",
      tipo: "opciones",
      opciones: TIPOS_DE_NEGOCIO,
      placeholder: "Elige tu tipo de negocio",
      rotulo: "Tipo de negocio",
      medio: true,
    },
    {
      nombre: "fecha",
      etiqueta: "Lo necesito para",
      tipo: "fecha",
      rotulo: "Fecha en que lo necesita",
      medio: true,
    },
    {
      nombre: "busca",
      etiqueta: "Estoy buscando",
      tipo: "area",
      placeholder: "Los productos o el requerimiento. Ej: tomate chonto, cebolla cabezona y papa pastusa.",
      requerido: true,
      rotulo: "Productos o requerimiento",
    },
    {
      nombre: "cantidad",
      etiqueta: "Necesito aproximadamente",
      placeholder: "Ej: dos bultos de cada uno, cada semana",
      requerido: true,
      rotulo: "Cantidad aproximada",
    },
    NOMBRE,
    TELEFONO,
    NOTAS,
  ],
};

/** Un producto que no aparece: qué es y cuánto, para saber si se consigue. */
export const PRODUCTO_ESPECIAL: DefinicionSolicitud = {
  motivo: "PRODUCTO_ESPECIAL",
  asunto: "Busco un producto que no aparece en el catálogo",
  boton: "Enviar lo que busco",
  campos: [
    {
      nombre: "producto",
      etiqueta: "Estoy buscando",
      placeholder: "El producto, la variedad o la presentación que necesitas",
      requerido: true,
      rotulo: "Producto",
    },
    {
      nombre: "cantidad",
      etiqueta: "Necesito aproximadamente",
      placeholder: "Ej: una caja por semana",
      rotulo: "Cantidad aproximada",
      medio: true,
    },
    {
      nombre: "fecha",
      etiqueta: "Lo necesito para",
      tipo: "fecha",
      rotulo: "Fecha en que lo necesita",
      medio: true,
    },
    NOMBRE,
    TELEFONO,
    NOTAS,
  ],
};

/** Una pregunta o un requerimiento especial: lo mínimo para responder. */
export const CONVERSACION: DefinicionSolicitud = {
  motivo: "CONSULTA",
  asunto: "Consulta desde la página de contacto",
  boton: "Enviar mensaje",
  unoDe: ["telefono", "email"],
  campos: [
    {
      nombre: "mensaje",
      etiqueta: "Quiero hablar sobre",
      tipo: "area",
      placeholder: "Tu pregunta o lo que necesitas",
      requerido: true,
      rotulo: "Mensaje",
    },
    { ...NOMBRE, etiqueta: "Mi nombre", placeholder: "Cómo te llamamos", autoComplete: "name", medio: false },
    { ...TELEFONO, requerido: false, ayuda: "Un teléfono o un correo: el que prefieras." },
    {
      nombre: "email",
      etiqueta: "Mi correo",
      tipo: "email",
      placeholder: "tu@correo.com",
      soloWeb: true,
      autoComplete: "email",
      medio: true,
    },
  ],
};
