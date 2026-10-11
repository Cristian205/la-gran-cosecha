import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History, Pencil, Plus, RefreshCw, Send, Sparkles, Zap } from "lucide-react";
import {
  crearPlantillasSugeridas,
  enviarPrueba,
  obtenerMensajes,
  reintentarMensaje,
  type EstadoMensaje,
  type EventoWhatsApp,
  type MensajeWhatsApp,
  type PlantillaWhatsApp,
} from "../../api/whatsapp";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito } from "../../utils/alertas";
import { rutaDe } from "./rutas";
import { CabeceraVista, Cargando, ErrorCarga, Estado, Grupo, Interruptor, SoloLectura, type TipoEstado } from "./ui";
import { ModalPlantilla, useWhatsApp } from "./whatsapp";

const ESTADO_MENSAJE: Record<EstadoMensaje, { tipo: TipoEstado; texto: string }> = {
  PENDIENTE: { tipo: "aviso", texto: "Pendiente" },
  ENVIADO: { tipo: "activo", texto: "Enviado" },
  ENTREGADO: { tipo: "activo", texto: "Entregado" },
  LEIDO: { tipo: "activo", texto: "Leído" },
  FALLIDO: { tipo: "bloqueado", texto: "Fallido" },
  OMITIDO: { tipo: "inactivo", texto: "Omitido" },
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Automatizaciones: cada aviso de WhatsApp es una regla «cuando pasa X,
 * envía Y a Z». Las reglas las define la plataforma (un evento que nadie
 * dispara sería una regla que nunca corre); el negocio las enciende, ajusta
 * su mensaje y ve cada ejecución.
 */
export function AutomatizacionesVista() {
  const wa = useWhatsApp();
  const { config, plantillas, setPlantillas, puedeEditar } = wa;
  const [mensajes, setMensajes] = useState<MensajeWhatsApp[] | null>(null);
  const [filtro, setFiltro] = useState({ estado: "", evento: "" });
  const [editando, setEditando] = useState<{ evento: EventoWhatsApp; plantilla: PlantillaWhatsApp | null } | null>(null);
  const [probando, setProbando] = useState<EventoWhatsApp | null>(null);
  const [eligiendo, setEligiendo] = useState(false);

  const cargarMensajes = useCallback(async (f: { estado: string; evento: string }) => {
    try {
      setMensajes(await obtenerMensajes(f));
    } catch {
      setMensajes([]);
    }
  }, []);

  useEffect(() => {
    void cargarMensajes(filtro);
  }, [cargarMensajes, filtro]);

  const plantillaDe = (codigo: string) => plantillas.find((p) => p.evento === codigo) ?? null;

  const filas = useMemo(() => {
    if (!config) return [];
    return config.eventos.map((evento) => {
      const plantilla = plantillaDe(evento.codigo);
      const encendida = !config.eventos_apagados.includes(evento.codigo);
      const completa = Boolean(plantilla && plantilla.activa);
      const sinDestino = evento.destinatario === "negocio" && config.telefonos_alertas.length === 0;
      const ultimo = mensajes?.find((m) => m.evento === evento.codigo) ?? null;
      let estado: { tipo: TipoEstado; texto: string };
      if (!encendida) estado = { tipo: "inactivo", texto: "Apagada" };
      else if (!completa) estado = { tipo: "aviso", texto: "Falta la plantilla" };
      else if (sinDestino) estado = { tipo: "aviso", texto: "Sin teléfonos" };
      else if (!config.activo) estado = { tipo: "neutro", texto: "En pausa" };
      else estado = { tipo: "activo", texto: "Activa" };
      return { evento, plantilla, encendida, completa, estado, ultimo };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, plantillas, mensajes]);

  async function alternar(evento: EventoWhatsApp, encender: boolean) {
    if (!config) return;
    const ok = await wa.guardar({
      eventos_apagados: encender
        ? config.eventos_apagados.filter((c) => c !== evento.codigo)
        : [...config.eventos_apagados, evento.codigo],
    });
    if (ok) alertaExito(encender ? "Regla activada" : "Regla apagada");
  }

  async function sugeridas() {
    try {
      const nuevas = await crearPlantillasSugeridas();
      setPlantillas((p) => [...p, ...nuevas]);
      alertaExito(`Se crearon ${nuevas.length} plantillas con el texto sugerido`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudieron crear las plantillas."));
    }
  }

  const activas = filas.filter((f) => f.estado.tipo === "activo").length;
  const hace24 = Date.now() - 86_400_000;
  const recientes = (mensajes ?? []).filter((m) => new Date(m.fecha_creacion).getTime() > hace24);
  const fallidasRecientes = recientes.filter((m) => m.estado === "FALLIDO").length;
  const pendientes = filas.filter((f) => !f.completa || !f.encendida);

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo="Automatizaciones"
        descripcion="Mensajes que salen solos cuando algo pasa en tu negocio: cada regla tiene un evento, una condición y una acción."
        acciones={
          puedeEditar && config ? (
            <button type="button" className="btn primario sm cfg-btn-icono" onClick={() => setEligiendo(true)}>
              <Plus size={14} aria-hidden /> Nueva regla
            </button>
          ) : undefined
        }
      />
      {wa.cargando ? (
        <Cargando />
      ) : wa.error || !config ? (
        <ErrorCarga mensaje={wa.error ?? "Sin datos."} onReintentar={wa.cargar} />
      ) : (
        <>
          {!puedeEditar && <SoloLectura>Solo el dueño o un administrador puede cambiar las reglas.</SoloLectura>}
          {!config.activo && (
            <div className="cfg-aviso info" role="status">
              <Zap size={15} aria-hidden /> Las reglas están en pausa porque WhatsApp está apagado.{" "}
              <Link to={rutaDe("integraciones/whatsapp")}>Enciéndelo en Integraciones</Link>.
            </div>
          )}

          <div className="cfg-metricas">
            <div>
              <strong>{activas}</strong>
              <span>de {filas.length} reglas activas</span>
            </div>
            <div>
              <strong>{recientes.length}</strong>
              <span>ejecuciones en 24 h</span>
            </div>
            <div className={fallidasRecientes ? "alerta" : ""}>
              <strong>{fallidasRecientes}</strong>
              <span>fallidas en 24 h</span>
            </div>
          </div>

          <Grupo
            titulo="Reglas"
            sinRelleno
            acciones={
              puedeEditar && plantillas.length < config.eventos.length ? (
                <button type="button" className="btn secundario sm cfg-btn-icono" onClick={sugeridas}>
                  <Sparkles size={14} aria-hidden /> Completar con textos sugeridos
                </button>
              ) : undefined
            }
          >
            <div className="cfg-tabla-scroll">
              <table className="cfg-tabla">
                <thead>
                  <tr>
                    <th>Regla</th>
                    <th>Cuando</th>
                    <th>Condición</th>
                    <th>Acción</th>
                    <th>Última ejecución</th>
                    <th>Estado</th>
                    <th aria-label="Opciones" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ evento, plantilla, encendida, estado, ultimo }) => (
                    <tr key={evento.codigo}>
                      <td>
                        <strong>{evento.nombre}</strong>
                      </td>
                      <td>{evento.cuando ?? "—"}</td>
                      <td>
                        {evento.destinatario === "cliente"
                          ? config.exige_consentimiento
                            ? "El cliente aceptó WhatsApp"
                            : "Siempre"
                          : config.telefonos_alertas.length
                            ? `${config.telefonos_alertas.length} ${config.telefonos_alertas.length === 1 ? "teléfono" : "teléfonos"} de alerta`
                            : "Sin teléfonos de alerta"}
                      </td>
                      <td>
                        WhatsApp {evento.destinatario === "cliente" ? "al cliente" : "al equipo"}
                        <div className="cfg-tabla-sub">{plantilla ? `Plantilla «${plantilla.meta_nombre || "sin nombre"}»` : "Sin plantilla"}</div>
                      </td>
                      <td>
                        {ultimo ? (
                          <>
                            {fecha(ultimo.fecha_creacion)}
                            <div className="cfg-tabla-sub">{ESTADO_MENSAJE[ultimo.estado].texto}</div>
                          </>
                        ) : (
                          <span className="cfg-tabla-sub">Nunca</span>
                        )}
                      </td>
                      <td>
                        <div className="cfg-celda-estado">
                          <Interruptor
                            etiqueta={`${encendida ? "Apagar" : "Activar"} ${evento.nombre}`}
                            activo={encendida}
                            deshabilitado={!puedeEditar || wa.guardando}
                            onCambiar={(v) => alternar(evento, v)}
                          />
                          <Estado tipo={estado.tipo}>{estado.texto}</Estado>
                        </div>
                      </td>
                      <td>
                        <div className="acciones">
                          {puedeEditar && (
                            <Tooltip label="Editar mensaje">
                              <button type="button" className="btn-icon editar" aria-label={`Editar ${evento.nombre}`} onClick={() => setEditando({ evento, plantilla })}>
                                <Pencil size={15} />
                              </button>
                            </Tooltip>
                          )}
                          {puedeEditar && (
                            <Tooltip label="Enviar prueba">
                              <button type="button" className="btn-icon" aria-label={`Probar ${evento.nombre}`} onClick={() => setProbando(evento)} disabled={!config.activo}>
                                <Send size={15} />
                              </button>
                            </Tooltip>
                          )}
                          <Tooltip label="Ver ejecuciones">
                            <button
                              type="button"
                              className="btn-icon info"
                              aria-label={`Ver ejecuciones de ${evento.nombre}`}
                              onClick={() => {
                                setFiltro({ estado: "", evento: evento.codigo });
                                document.getElementById("cfg-registro")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                            >
                              <History size={15} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Grupo>

          <div id="cfg-registro">
            <Grupo
              titulo="Registro de ejecuciones"
              descripcion="Cada mensaje que una regla intentó enviar, con su resultado."
              sinRelleno
              acciones={
                <div className="cfg-filtros">
                  <select aria-label="Filtrar por regla" value={filtro.evento} onChange={(e) => setFiltro((f) => ({ ...f, evento: e.target.value }))}>
                    <option value="">Todas las reglas</option>
                    {config.eventos.map((ev) => (
                      <option key={ev.codigo} value={ev.codigo}>
                        {ev.nombre}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Filtrar por estado" value={filtro.estado} onChange={(e) => setFiltro((f) => ({ ...f, estado: e.target.value }))}>
                    <option value="">Todos los estados</option>
                    {Object.entries(ESTADO_MENSAJE).map(([valor, { texto }]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                  <Tooltip label="Actualizar">
                    <button type="button" className="btn-icon" aria-label="Actualizar registro" onClick={() => cargarMensajes(filtro)}>
                      <RefreshCw size={15} />
                    </button>
                  </Tooltip>
                </div>
              }
            >
              {!mensajes ? (
                <Cargando />
              ) : mensajes.length === 0 ? (
                <p className="cfg-vacio">Sin ejecuciones con estos filtros.</p>
              ) : (
                <div className="cfg-tabla-scroll">
                  <table className="cfg-tabla">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Regla</th>
                        <th>Para</th>
                        <th>Resultado</th>
                        <th>Detalle</th>
                        <th aria-label="Opciones" />
                      </tr>
                    </thead>
                    <tbody>
                      {mensajes.map((m) => (
                        <tr key={m.id}>
                          <td className="cfg-nowrap">{fecha(m.fecha_creacion)}</td>
                          <td>
                            {config.eventos.find((e) => e.codigo === m.evento)?.nombre ?? m.evento}
                            {m.pedido_id && <div className="cfg-tabla-sub">Pedido #{m.pedido_id}</div>}
                          </td>
                          <td className="cfg-nowrap">{m.destino}</td>
                          <td>
                            <Estado tipo={ESTADO_MENSAJE[m.estado].tipo}>{ESTADO_MENSAJE[m.estado].texto}</Estado>
                            {m.proveedor && <div className="cfg-tabla-sub">vía {m.proveedor}</div>}
                          </td>
                          <td className="cfg-detalle">
                            {m.error ? <span className="cfg-texto-error">{m.error}</span> : m.texto}
                            {m.estado === "PENDIENTE" && m.proximo_intento && <div className="cfg-tabla-sub">Reintento: {fecha(m.proximo_intento)}</div>}
                          </td>
                          <td>
                            {puedeEditar && (m.estado === "FALLIDO" || m.estado === "OMITIDO") && (
                              <Tooltip label="Reintentar">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  aria-label="Reintentar envío"
                                  onClick={async () => {
                                    try {
                                      await reintentarMensaje(m.id);
                                      alertaExito("Reintento en cola");
                                      await cargarMensajes(filtro);
                                    } catch (e) {
                                      alertaError(extraerMensajeError(e, "No se pudo reintentar."));
                                    }
                                  }}
                                >
                                  <RefreshCw size={15} />
                                </button>
                              </Tooltip>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Grupo>
          </div>
        </>
      )}

      {editando && (
        <ModalPlantilla
          evento={editando.evento}
          plantilla={editando.plantilla}
          onCerrar={() => setEditando(null)}
          onGuardada={async (p) => {
            setPlantillas((l) => [...l.filter((x) => x.id !== p.id), p]);
            // Configurar una regla es querer que funcione: si estaba apagada, se enciende.
            if (config?.eventos_apagados.includes(editando.evento.codigo)) {
              await wa.guardar({ eventos_apagados: config.eventos_apagados.filter((c) => c !== editando.evento.codigo) });
            }
            setEditando(null);
            alertaExito("Regla guardada");
          }}
        />
      )}
      {probando && <ModalPrueba evento={probando} onCerrar={() => setProbando(null)} onEnviada={() => cargarMensajes(filtro)} />}
      {eligiendo && config && (
        <Modal amplio medio cerrarConEscape titulo="Nueva regla" onCerrar={() => setEligiendo(false)}>
          {pendientes.length === 0 ? (
            <p className="cfg-texto">
              Todas las reglas disponibles ya están configuradas y encendidas. Puedes ajustar el mensaje de cualquiera desde la tabla.
            </p>
          ) : (
            <>
              <p className="cfg-texto">Elige qué quieres automatizar. Podrás revisar el mensaje antes de activarla.</p>
              <ul className="cfg-lista-opciones">
                {pendientes.map(({ evento, plantilla }) => (
                  <li key={evento.codigo}>
                    <button
                      type="button"
                      onClick={() => {
                        setEligiendo(false);
                        setEditando({ evento, plantilla });
                      }}
                    >
                      <strong>{evento.nombre}</strong>
                      <span>
                        {evento.cuando} → WhatsApp {evento.destinatario === "cliente" ? "al cliente" : "al equipo"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function ModalPrueba({ evento, onCerrar, onEnviada }: { evento: EventoWhatsApp; onCerrar: () => void; onEnviada: () => void }) {
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!/\d{7,}/.test(telefono.replace(/\D/g, ""))) {
      setError("Escribe un número de celular válido.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const m = await enviarPrueba(evento.codigo, telefono);
      if (m.estado === "FALLIDO") {
        setError(`No salió: ${m.error}`);
      } else {
        alertaExito(`Prueba ${ESTADO_MENSAJE[m.estado].texto.toLowerCase()}`);
        onEnviada();
        onCerrar();
      }
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo enviar la prueba."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      amplio
      medio
      cerrarConEscape
      titulo={`Probar · ${evento.nombre}`}
      onCerrar={onCerrar}
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" form="form-prueba" className="btn primario" disabled={enviando} aria-busy={enviando}>
            {enviando ? "Enviando…" : "Enviar prueba"}
          </button>
        </>
      }
    >
      <form id="form-prueba" onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="pr-tel">Tu celular</label>
          <input
            id="pr-tel"
            autoFocus
            inputMode="tel"
            placeholder="300 123 4567"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "pr-tel-error" : undefined}
          />
          {error && (
            <p className="campo-error" id="pr-tel-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <p className="cfg-texto">Se envía con datos de ejemplo y queda en el registro de ejecuciones.</p>
      </form>
    </Modal>
  );
}
