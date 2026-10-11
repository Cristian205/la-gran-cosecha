import { useCallback, useEffect, useState } from "react";
import {
  guardarConfiguracion,
  guardarPlantilla,
  obtenerConfiguracion,
  obtenerPlantillas,
  type ConfiguracionWhatsApp,
  type EventoWhatsApp,
  type PlantillaWhatsApp,
} from "../../api/whatsapp";
import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/Modal";
import { extraerMensajeError } from "../../utils";
import { alertaError } from "../../utils/alertas";
import { Fila, Grupo, Interruptor } from "./ui";

/**
 * Lo que comparten Automatizaciones e Integraciones: la configuración de
 * WhatsApp del negocio y sus plantillas.
 *
 * Lo ve todo el equipo —saber si a un cliente le llegó su aviso es parte de
 * atenderlo—; lo cambia el dueño o un administrador (el servidor lo exige).
 */
export function useWhatsApp() {
  const { usuario } = useAuth();
  const puedeEditar = Boolean(usuario?.es_administrador);
  const [config, setConfig] = useState<ConfiguracionWhatsApp | null>(null);
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [c, p] = await Promise.all([obtenerConfiguracion(), obtenerPlantillas()]);
      setConfig(c);
      setPlantillas(p);
    } catch (e) {
      setError(extraerMensajeError(e, "No se pudo cargar la configuración de WhatsApp."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Guarda al instante; devuelve si salió bien. */
  async function guardar(cambios: Parameters<typeof guardarConfiguracion>[0]): Promise<boolean> {
    setGuardando(true);
    try {
      setConfig(await guardarConfiguracion(cambios));
      return true;
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar."));
      return false;
    } finally {
      setGuardando(false);
    }
  }

  const cred = config?.credenciales_plataforma;
  const proveedorListo = Boolean(
    config &&
      cred &&
      (config.proveedor === "SIMULADO" ||
        (config.proveedor === "META" && cred.meta && config.meta_phone_number_id) ||
        (config.proveedor === "TWILIO" && cred.twilio && config.twilio_remitente))
  );

  return { puedeEditar, config, plantillas, setPlantillas, cargando, error, cargar, guardando, guardar, proveedorListo };
}

/** Editar (o crear) la plantilla de un evento. */
export function ModalPlantilla({
  evento,
  plantilla,
  onCerrar,
  onGuardada,
}: {
  evento: EventoWhatsApp;
  plantilla: PlantillaWhatsApp | null;
  onCerrar: () => void;
  onGuardada: (p: PlantillaWhatsApp) => void;
}) {
  const [datos, setDatos] = useState({
    meta_nombre: plantilla?.meta_nombre ?? evento.codigo.toLowerCase(),
    meta_idioma: plantilla?.meta_idioma ?? "es",
    twilio_content_sid: plantilla?.twilio_content_sid ?? "",
    cuerpo: plantilla?.cuerpo ?? evento.texto,
    activa: plantilla?.activa ?? true,
  });
  const [guardando, setGuardando] = useState(false);
  const campo = <K extends keyof typeof datos>(k: K, v: (typeof datos)[K]) => setDatos((d) => ({ ...d, [k]: v }));

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      onGuardada(await guardarPlantilla({ id: plantilla?.id, evento: evento.codigo, ...datos }));
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar la plantilla."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      amplio
      medio
      cerrarConEscape
      titulo={plantilla ? `Editar regla · ${evento.nombre}` : `Configurar regla · ${evento.nombre}`}
      subtitulo={`${evento.cuando ?? evento.nombre} → WhatsApp ${evento.destinatario === "cliente" ? "al cliente" : "al equipo"}`}
      onCerrar={onCerrar}
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="btn primario" onClick={guardar} disabled={guardando} aria-busy={guardando}>
            {guardando ? "Guardando…" : "Guardar regla"}
          </button>
        </>
      }
    >
      <div className="campo">
        <label htmlFor="pl-cuerpo">Mensaje</label>
        <textarea id="pl-cuerpo" rows={4} value={datos.cuerpo} onChange={(e) => campo("cuerpo", e.target.value)} aria-describedby="pl-cuerpo-ayuda" />
        <p className="campo-ayuda" id="pl-cuerpo-ayuda">
          Debe ser el mismo texto aprobado en Meta. Variables, en este orden:{" "}
          {evento.variables.map((v, i) => (
            <code key={v} className="cfg-codigo">
              {`{{${i + 1}}}`} {v}
            </code>
          ))}
        </p>
      </div>
      <div className="cfg-rejilla-2">
        <div className="campo">
          <label htmlFor="pl-meta">Nombre de la plantilla en Meta</label>
          <input id="pl-meta" value={datos.meta_nombre} onChange={(e) => campo("meta_nombre", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="pl-idioma">Idioma</label>
          <input id="pl-idioma" value={datos.meta_idioma} onChange={(e) => campo("meta_idioma", e.target.value)} placeholder="es" />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="pl-twilio">ContentSid en Twilio (respaldo)</label>
        <input id="pl-twilio" value={datos.twilio_content_sid} onChange={(e) => campo("twilio_content_sid", e.target.value)} placeholder="HX…" />
      </div>
      <Grupo sinRelleno>
        <Fila titulo="Plantilla activa" descripcion="Apagada, la regla no envía aunque esté encendida.">
          <Interruptor etiqueta="Plantilla activa" activo={datos.activa} onCambiar={(v) => campo("activa", v)} />
        </Fila>
      </Grupo>
    </Modal>
  );
}
