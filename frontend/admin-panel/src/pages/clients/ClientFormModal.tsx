import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, BellRing, Info, Mail, Megaphone, MessageCircle, UserRound, type LucideIcon } from "lucide-react";
import { Modal } from "../../components/Modal";
import { actualizarCliente, crearCliente, obtenerAlertasCliente, type AlertaCliente } from "../../api/resources";
import type { Cliente } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  cliente: Cliente | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

type Pestana = "info" | "alertas";

/** Cómo se agrupan en la pestaña: primero lo que el cliente necesita, luego lo comercial. */
const GRUPOS: { clave: string; titulo: string; icono: LucideIcon; filtro: (a: AlertaCliente) => boolean }[] = [
  { clave: "utilidad", titulo: "Avisos de sus pedidos · WhatsApp", icono: BellRing, filtro: (a) => a.tipo === "UTILIDAD" },
  {
    clave: "mkt-wa",
    titulo: "Marketing por WhatsApp",
    icono: MessageCircle,
    filtro: (a) => a.tipo === "MARKETING" && a.canal === "WHATSAPP",
  },
  {
    clave: "mkt-correo",
    titulo: "Marketing por correo",
    icono: Mail,
    filtro: (a) => a.tipo === "MARKETING" && a.canal === "CORREO",
  },
];

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO");
}

function Interruptor({
  id,
  titulo,
  descripcion,
  activo,
  onCambiar,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  activo: boolean;
  onCambiar: (v: boolean) => void;
}) {
  return (
    <div className="cliente-alerta">
      <div className="cliente-alerta-texto">
        <label htmlFor={id} className="campo-switch-titulo">
          {titulo}
        </label>
        <div className="campo-switch-desc" id={`${id}-desc`}>
          {descripcion}
        </div>
      </div>
      <label className="switch">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={activo}
          aria-describedby={`${id}-desc`}
          onChange={(e) => onCambiar(e.target.checked)}
        />
        <span className="switch-riel" />
      </label>
    </div>
  );
}

/**
 * Crear o editar un cliente en dos pestañas: «Información del cliente» y
 * «Alertas» (qué avisos y mensajes comerciales puede recibir). Un solo
 * «Guardar» guarda las dos; de las alertas solo se envían las que cambiaron.
 */
export function ClientFormModal({ cliente, onCerrar, onGuardado }: Props) {
  const esEdicion = cliente !== null;
  const id = useId();

  const [pestana, setPestana] = useState<Pestana>("info");
  const [nombre, setNombre] = useState(cliente?.nombre_cliente ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono_cliente ?? "");
  const [direccion, setDireccion] = useState(cliente?.direccion_cliente ?? "");
  const [documento, setDocumento] = useState(cliente?.documento_cliente ?? "");
  const [aceptaWhatsapp, setAceptaWhatsapp] = useState(cliente?.acepta_whatsapp ?? false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState<AlertaCliente[]>([]);
  const [alertas, setAlertas] = useState<Record<string, boolean>>({});
  const [cargandoAlertas, setCargandoAlertas] = useState(true);
  const [errorAlertas, setErrorAlertas] = useState<string | null>(null);

  useEffect(() => {
    obtenerAlertasCliente()
      .then((cat) => {
        setCatalogo(cat);
        // Lo del cliente si ya existe; si es nuevo, lo que trae cada alerta por defecto.
        setAlertas(Object.fromEntries(cat.map((a) => [a.codigo, cliente?.alertas?.[a.codigo] ?? a.por_defecto])));
      })
      .catch(() => setErrorAlertas("No se pudieron cargar las alertas."))
      .finally(() => setCargandoAlertas(false));
  }, [cliente]);

  const errorNombre = nombre.trim() ? null : "El nombre del cliente es obligatorio.";

  /** Solo las alertas que difieren de como estaban: no se pisa lo que no se tocó. */
  function alertasCambiadas(): Record<string, boolean> {
    const cambios: Record<string, boolean> = {};
    for (const a of catalogo) {
      const antes = cliente?.alertas?.[a.codigo] ?? a.por_defecto;
      if (alertas[a.codigo] !== antes) cambios[a.codigo] = alertas[a.codigo];
    }
    return cambios;
  }
  const hayAlertasSinGuardar = !cargandoAlertas && Object.keys(alertasCambiadas()).length > 0;

  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    setIntentoGuardar(true);
    setError(null);
    if (errorNombre) {
      setPestana("info");
      return;
    }

    const cambios = alertasCambiadas();
    const payload = {
      nombre_cliente: nombre.trim(),
      telefono_cliente: telefono.trim(),
      direccion_cliente: direccion.trim(),
      documento_cliente: documento.trim(),
      acepta_whatsapp: aceptaWhatsapp,
      ...(Object.keys(cambios).length > 0 ? { alertas: cambios } : {}),
    };

    setGuardando(true);
    try {
      if (esEdicion) await actualizarCliente(cliente!.id, payload);
      else await crearCliente(payload);
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el cliente."));
    } finally {
      setGuardando(false);
    }
  }

  // Pestañas accesibles: flechas izquierda/derecha para moverse entre ellas.
  const refPestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const pestanas: { clave: Pestana; etiqueta: string; icono: LucideIcon }[] = [
    { clave: "info", etiqueta: "Información del cliente", icono: UserRound },
    { clave: "alertas", etiqueta: "Alertas", icono: BellRing },
  ];
  function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = pestanas.findIndex((p) => p.clave === pestana);
    const siguiente = (i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
    setPestana(pestanas[siguiente].clave);
    refPestanas.current[siguiente]?.focus();
  }

  const encendidas = catalogo.filter((a) => alertas[a.codigo]).length;

  return (
    <Modal
      amplio
      medio
      titulo={esEdicion ? `Editar a ${cliente!.nombre_cliente}` : "Nuevo cliente"}
      subtitulo={esEdicion && cliente!.telefono_cliente ? cliente!.telefono_cliente : undefined}
      onCerrar={() => !guardando && onCerrar()}
      cerrarConEscape={!guardando}
      footer={
        <>
          {hayAlertasSinGuardar && (
            <span className="pie-aviso" role="status">
              Alertas sin guardar
            </span>
          )}
          <button type="button" className="btn secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" form={`${id}-form`} className="btn primario" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={guardar} noValidate className="cliente-editor">
        <div className="gestion-tabs cliente-editor-tabs" role="tablist" aria-label="Secciones del cliente" onKeyDown={alTeclado}>
          {pestanas.map((p, i) => {
            const Icono = p.icono;
            const activa = pestana === p.clave;
            return (
              <button
                key={p.clave}
                ref={(el) => {
                  refPestanas.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${p.clave}`}
                aria-selected={activa}
                aria-controls={`${id}-panel-${p.clave}`}
                tabIndex={activa ? 0 : -1}
                className={activa ? "activo" : ""}
                onClick={() => setPestana(p.clave)}
              >
                <Icono size={15} aria-hidden="true" /> {p.etiqueta}
                {p.clave === "alertas" && !cargandoAlertas && catalogo.length > 0 && (
                  <span className="gestion-tab-num">{encendidas}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <div role="tabpanel" id={`${id}-panel-info`} aria-labelledby={`${id}-tab-info`} hidden={pestana !== "info"}>
          <div className="campo">
            <label htmlFor={`${id}-nombre`}>Nombre del cliente *</label>
            <input
              id={`${id}-nombre`}
              value={nombre}
              aria-invalid={intentoGuardar && Boolean(errorNombre)}
              aria-describedby={intentoGuardar && errorNombre ? `${id}-nombre-error` : undefined}
              onChange={(e) => setNombre(e.target.value)}
            />
            {intentoGuardar && errorNombre && (
              <p className="campo-error" id={`${id}-nombre-error`}>
                <AlertCircle size={14} aria-hidden="true" /> {errorNombre}
              </p>
            )}
          </div>

          <div className="campo">
            <label htmlFor={`${id}-documento`}>Cédula</label>
            <input
              id={`${id}-documento`}
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              inputMode="numeric"
              placeholder="Sin puntos"
              aria-describedby={`${id}-documento-ayuda`}
            />
            <p className="campo-ayuda" id={`${id}-documento-ayuda`}>
              Con la cédula, el cliente puede pedir y ver sus pedidos en la tienda sin volver a escribir sus datos (si la
              tienda identifica por cédula).
              {cliente?.acepto_precios_en && ` Aceptó el ajuste de precios el ${fechaCorta(cliente.acepto_precios_en)}.`}
            </p>
          </div>

          <div className="campo">
            <label htmlFor={`${id}-telefono`}>Teléfono</label>
            <input id={`${id}-telefono`} value={telefono} inputMode="tel" onChange={(e) => setTelefono(e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor={`${id}-direccion`}>Dirección</label>
            <textarea id={`${id}-direccion`} rows={3} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>

          {esEdicion && (
            <p className="campo-ayuda">
              {cliente?.autorizo_datos_en
                ? `Autorizó el tratamiento de sus datos el ${fechaCorta(cliente.autorizo_datos_en)}.`
                : "Aún no ha autorizado el tratamiento de sus datos en la tienda: se le pedirá en su próximo pedido."}
            </p>
          )}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel-alertas`}
          aria-labelledby={`${id}-tab-alertas`}
          hidden={pestana !== "alertas"}
        >
          <div className={`cliente-consentimiento ${aceptaWhatsapp ? "si" : "no"}`}>
            <Interruptor
              id={`${id}-acepta-whatsapp`}
              titulo="Acepta mensajes por WhatsApp"
              descripcion={
                "Márcalo solo si el cliente te lo autorizó (por teléfono, en persona o en la tienda). Sin esto no se le " +
                "envía nada por WhatsApp, aunque las alertas estén activas." +
                (cliente?.whatsapp_decidido_en ? ` Última decisión: ${fechaCorta(cliente.whatsapp_decidido_en)}.` : "")
              }
              activo={aceptaWhatsapp}
              onCambiar={setAceptaWhatsapp}
            />
          </div>

          {errorAlertas && <div className="error-box">{errorAlertas}</div>}
          {cargandoAlertas ? (
            <div className="vacio">Cargando…</div>
          ) : (
            GRUPOS.map((g) => {
              const lista = catalogo.filter(g.filtro);
              if (lista.length === 0) return null;
              const Icono = g.icono;
              const esMarketing = g.clave !== "utilidad";
              const esCorreo = g.clave === "mkt-correo";
              return (
                <section key={g.clave} className="cliente-alertas-grupo" aria-labelledby={`${id}-${g.clave}`}>
                  <h3 id={`${id}-${g.clave}`}>
                    <Icono size={15} aria-hidden="true" /> {g.titulo}
                  </h3>
                  {esMarketing && (
                    <p className="cliente-alertas-nota">
                      {g.clave === "mkt-wa" ? <Megaphone size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
                      <span>
                        Actívalas solo si el cliente pidió recibir promociones.{" "}
                        {esCorreo
                          ? "La ficha del cliente aún no guarda un correo: la preferencia queda lista para cuando lo tenga."
                          : "La plataforma todavía no envía campañas: la preferencia queda guardada para cuando las haya."}
                      </span>
                    </p>
                  )}
                  <div className="cliente-alertas-lista">
                    {lista.map((a) => (
                      <Interruptor
                        key={a.codigo}
                        id={`${id}-${a.codigo}`}
                        titulo={a.nombre}
                        descripcion={a.descripcion}
                        activo={Boolean(alertas[a.codigo])}
                        onCambiar={(v) => setAlertas((prev) => ({ ...prev, [a.codigo]: v }))}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </form>
    </Modal>
  );
}
