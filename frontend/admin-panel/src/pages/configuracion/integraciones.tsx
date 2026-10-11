import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, KeyRound, LayoutList, MessageCircle, Trash2, X } from "lucide-react";
import { borrarExclusion, crearExclusion, obtenerExclusiones, type ExclusionWhatsApp, type ProveedorWhatsApp } from "../../api/whatsapp";
import { Tooltip } from "../../components/Tooltip";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarEliminar } from "../../utils/alertas";
import { rutaDe } from "./rutas";
import { CabeceraVista, Cargando, ErrorCarga, Estado, Fila, Grupo, Interruptor, SoloLectura } from "./ui";
import { useWhatsApp } from "./whatsapp";

const PROVEEDORES: { valor: ProveedorWhatsApp; etiqueta: string; texto: string }[] = [
  { valor: "META", etiqueta: "Meta", texto: "WhatsApp Cloud API, directo con Meta." },
  { valor: "TWILIO", etiqueta: "Twilio", texto: "A través de Twilio." },
  { valor: "SIMULADO", etiqueta: "Simulado", texto: "No envía nada: solo registra. Para probar sin gastar mensajes." },
];

export function WhatsAppVista() {
  const wa = useWhatsApp();
  const { config, puedeEditar, guardar, guardando } = wa;
  const [exclusiones, setExclusiones] = useState<ExclusionWhatsApp[]>([]);
  const [remitentes, setRemitentes] = useState({ meta: "", twilio: "" });
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [baja, setBaja] = useState("");

  useEffect(() => {
    obtenerExclusiones().then(setExclusiones).catch(() => setExclusiones([]));
  }, []);
  useEffect(() => {
    if (config) setRemitentes({ meta: config.meta_phone_number_id, twilio: config.twilio_remitente });
  }, [config?.meta_phone_number_id, config?.twilio_remitente]); // eslint-disable-line react-hooks/exhaustive-deps

  const remitentesCambiados =
    config && (remitentes.meta.trim() !== config.meta_phone_number_id || remitentes.twilio.trim() !== config.twilio_remitente);

  const conexion = !config
    ? null
    : !config.activo
      ? { tipo: "inactivo" as const, texto: "Apagado" }
      : wa.proveedorListo
        ? { tipo: "activo" as const, texto: config.proveedor === "SIMULADO" ? "Modo simulado" : "Conectado" }
        : { tipo: "aviso" as const, texto: "Requiere atención" };

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo="WhatsApp"
        descripcion="La conexión por la que salen los avisos a clientes y las alertas al equipo. Las reglas de envío están en Automatizaciones."
        acciones={
          <Link className="btn secundario sm" to={rutaDe("automatizaciones/reglas")}>
            Ver reglas
          </Link>
        }
      />
      {wa.cargando ? (
        <Cargando />
      ) : wa.error || !config || !conexion ? (
        <ErrorCarga mensaje={wa.error ?? "Sin datos."} onReintentar={wa.cargar} />
      ) : (
        <>
          {!puedeEditar && <SoloLectura>Solo el dueño o un administrador puede cambiar la conexión.</SoloLectura>}

          <Grupo sinRelleno>
            <Fila
              titulo={
                <span className="cfg-fila-con-icono">
                  <MessageCircle size={16} aria-hidden /> Estado de la conexión
                </span>
              }
              estado={<Estado tipo={conexion.tipo}>{conexion.texto}</Estado>}
              descripcion={
                config.activo && !wa.proveedorListo
                  ? "Faltan credenciales en el servidor o el remitente de este negocio: los mensajes quedarán fallidos hasta completarlo."
                  : "Apagado, no sale nada: ni avisos a clientes ni alertas al equipo."
              }
            >
              <Interruptor etiqueta="WhatsApp encendido" activo={config.activo} deshabilitado={!puedeEditar || guardando} onCambiar={(v) => guardar({ activo: v })} />
            </Fila>
            <Fila titulo="Proveedor principal" descripcion={PROVEEDORES.find((p) => p.valor === config.proveedor)?.texto}>
              <div className="segmentado" role="radiogroup" aria-label="Proveedor principal">
                {PROVEEDORES.map((p) => (
                  <button
                    key={p.valor}
                    type="button"
                    role="radio"
                    aria-checked={config.proveedor === p.valor}
                    disabled={!puedeEditar || guardando}
                    className={config.proveedor === p.valor ? "activo" : ""}
                    onClick={() => guardar({ proveedor: p.valor })}
                  >
                    {p.etiqueta}
                  </button>
                ))}
              </div>
            </Fila>
            <Fila titulo="Respaldo automático" descripcion="Si el principal falla, el mismo mensaje sale por el otro proveedor.">
              <Interruptor
                etiqueta="Respaldo automático"
                activo={config.respaldo_activo}
                deshabilitado={!puedeEditar || guardando || config.proveedor === "SIMULADO"}
                onCambiar={(v) => guardar({ respaldo_activo: v })}
              />
            </Fila>
            <Fila titulo="Solo a clientes que aceptaron" descripcion="Lo exige Meta: el cliente lo acepta en el checkout o lo registras en su ficha.">
              <Interruptor
                etiqueta="Solo a clientes que aceptaron"
                activo={config.exige_consentimiento}
                deshabilitado={!puedeEditar || guardando}
                onCambiar={(v) => guardar({ exige_consentimiento: v })}
              />
            </Fila>
            <Fila
              titulo={
                <span className="cfg-fila-con-icono">
                  <KeyRound size={15} aria-hidden /> Credenciales del servidor
                </span>
              }
              descripcion="Los tokens no se guardan en el panel: los configura Kryon X en el servidor."
            >
              <span className="cfg-chips">
                <Estado tipo={config.credenciales_plataforma.meta ? "activo" : "inactivo"}>Meta</Estado>
                <Estado tipo={config.credenciales_plataforma.meta_webhook ? "activo" : "inactivo"}>Webhook</Estado>
                <Estado tipo={config.credenciales_plataforma.twilio ? "activo" : "inactivo"}>Twilio</Estado>
              </span>
            </Fila>
          </Grupo>

          <Grupo titulo="Remitentes" descripcion="Los números de tu negocio en cada proveedor.">
            <form
              className="cfg-rejilla-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await guardar({ meta_phone_number_id: remitentes.meta.trim(), twilio_remitente: remitentes.twilio.trim() })) {
                  alertaExito("Remitentes guardados");
                }
              }}
            >
              <div className="campo">
                <label htmlFor="wa-meta">Meta · Phone number ID</label>
                <input id="wa-meta" value={remitentes.meta} disabled={!puedeEditar} placeholder="123456789012345" onChange={(e) => setRemitentes((r) => ({ ...r, meta: e.target.value }))} />
              </div>
              <div className="campo">
                <label htmlFor="wa-twilio">Twilio · Remitente</label>
                <input id="wa-twilio" value={remitentes.twilio} disabled={!puedeEditar} placeholder="whatsapp:+14155238886" onChange={(e) => setRemitentes((r) => ({ ...r, twilio: e.target.value }))} />
              </div>
              {puedeEditar && remitentesCambiados && (
                <div className="cfg-acciones-form">
                  <button type="button" className="btn secundario sm" onClick={() => setRemitentes({ meta: config.meta_phone_number_id, twilio: config.twilio_remitente })}>
                    Descartar
                  </button>
                  <button type="submit" className="btn primario sm" disabled={guardando}>
                    Guardar remitentes
                  </button>
                </div>
              )}
            </form>
          </Grupo>

          <Grupo titulo="Alertas al equipo" descripcion="Estos números reciben las alertas de pedido nuevo, mensajes de contacto y envíos devueltos.">
            <div className="cfg-chips cfg-chips-lista">
              {config.telefonos_alertas.length === 0 && <span className="cfg-tabla-sub">Nadie recibe alertas todavía.</span>}
              {config.telefonos_alertas.map((t) => (
                <span key={t} className="cfg-chip">
                  {t}
                  {puedeEditar && (
                    <button type="button" aria-label={`Quitar ${t}`} onClick={() => guardar({ telefonos_alertas: config.telefonos_alertas.filter((x) => x !== t) })}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {puedeEditar && (
              <form
                className="cfg-agregar"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const t = nuevoTelefono.trim();
                  if (!t) return;
                  if (await guardar({ telefonos_alertas: [...config.telefonos_alertas, t] })) setNuevoTelefono("");
                }}
              >
                <input value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} placeholder="300 123 4567" inputMode="tel" aria-label="Teléfono para alertas" />
                <button type="submit" className="btn secundario sm" disabled={!nuevoTelefono.trim() || guardando}>
                  Agregar
                </button>
              </form>
            )}
          </Grupo>

          <Grupo titulo="Números que no reciben mensajes" descripcion="Quien responde «BAJA» entra aquí solo. También puedes agregar uno a mano." sinRelleno>
            {exclusiones.length === 0 ? (
              <p className="cfg-vacio">Ninguno.</p>
            ) : (
              exclusiones.map((x) => (
                <Fila key={x.id} titulo={x.telefono} descripcion={`${x.motivo || "Sin motivo"} · ${new Date(x.fecha).toLocaleDateString("es-CO")}`}>
                  {puedeEditar && (
                    <Tooltip label="Volver a permitir">
                      <button
                        type="button"
                        className="btn-icon peligro"
                        aria-label={`Volver a permitir ${x.telefono}`}
                        onClick={async () => {
                          if (!(await confirmarEliminar("¿Volver a enviarle mensajes?", "Hazlo solo si la persona lo pidió."))) return;
                          try {
                            await borrarExclusion(x.id);
                            setExclusiones((l) => l.filter((y) => y.id !== x.id));
                          } catch (e) {
                            alertaError(extraerMensajeError(e, "No se pudo quitar."));
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </Tooltip>
                  )}
                </Fila>
              ))
            )}
            {puedeEditar && (
              <form
                className="cfg-agregar cfg-grupo-relleno"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const nueva = await crearExclusion(baja, "Agregado desde el panel");
                    setExclusiones((l) => [nueva, ...l]);
                    setBaja("");
                  } catch (err) {
                    alertaError(extraerMensajeError(err, "Teléfono no válido."));
                  }
                }}
              >
                <input value={baja} onChange={(e) => setBaja(e.target.value)} placeholder="300 123 4567" inputMode="tel" aria-label="Teléfono a excluir" />
                <button type="submit" className="btn secundario sm" disabled={!baja.trim()}>
                  Excluir
                </button>
              </form>
            )}
          </Grupo>
        </>
      )}
    </div>
  );
}

/** Lo personal de cada usuario vive en Preferencias; aquí, el acceso. */
export function PreferenciasVista() {
  const enlaces = [
    { icono: LayoutList, titulo: "Menú lateral", texto: "Ordena y agrupa las secciones de tu menú." },
    { icono: Bell, titulo: "Notificaciones", texto: "Qué avisos quieres recibir en el panel." },
    { icono: KeyRound, titulo: "Contraseña", texto: "Cambia tu contraseña de acceso." },
  ];
  return (
    <div className="cfg-vista">
      <CabeceraVista titulo="Preferencias" descripcion="Ajustes personales de tu usuario: solo te afectan a ti, no al negocio." />
      <Grupo sinRelleno>
        {enlaces.map(({ icono: Icono, titulo, texto }) => (
          <Fila
            key={titulo}
            titulo={
              <span className="cfg-fila-con-icono">
                <Icono size={15} aria-hidden /> {titulo}
              </span>
            }
            descripcion={texto}
          >
            <Link className="btn secundario sm" to="/configuracion">
              Abrir
            </Link>
          </Fila>
        ))}
      </Grupo>
    </div>
  );
}
