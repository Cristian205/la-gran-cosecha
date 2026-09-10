import { useCallback, useEffect, useState } from "react";
import { Bike, Plus, Settings2 } from "lucide-react";
import {
  asignarEnvio,
  cambiarEstado,
  crearEnvio,
  guardarConfiguracion,
  guardarRepartidor,
  guardarZona,
  obtenerConfiguracion,
  obtenerRepartidores,
  obtenerTablero,
  obtenerZonas,
  type ConfiguracionEnvios,
  type Envio,
  type EstadoEnvio,
  type Repartidor,
  type Zona,
} from "../../api/domicilios";
import { Modal } from "../../components/Modal";
import { extraerMensajeError, tienePermiso } from "../../utils";
import { useAuth } from "../../auth/AuthContext";
import { alertaError, alertaExito } from "../../utils/alertas";

/**
 * El tablero de despacho.
 *
 * Toda la pantalla se rotula con la palabra que el negocio eligió para quien
 * reparte —«Domiciliario», «Mensajero», «Técnico»— y no hay ni un «Repartidor»
 * fijo a la vista. Misma regla que gobierna la tienda y la agenda, aplicada al
 * vocabulario: los datos NOMBRAN, el código PINTA.
 *
 * Los botones de estado tampoco se deciden aquí: cada envío llega con su lista
 * de `siguientes`. Reimplementar la tabla de transiciones en TypeScript es cómo
 * acaban divergiendo el servidor y el panel, y el síntoma son botones que se
 * pulsan y no hacen nada.
 *
 * Las columnas son los ESTADOS y no los repartidores, y eso decide qué pregunta
 * contesta la pantalla: quien la abre está mirando qué falta por salir, no
 * quién está ocupado. Lo segundo cabe en una línea por persona, y ahí está.
 */

const COLUMNAS: { estado: EstadoEnvio; titulo: string }[] = [
  { estado: "PENDIENTE", titulo: "Por asignar" },
  { estado: "ASIGNADO", titulo: "Asignados" },
  { estado: "EN_RUTA", titulo: "En ruta" },
];

function hora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Si ya pasó la hora prometida y todavía no ha llegado. Es la única alarma de
 *  esta pantalla, y por eso no compite con ninguna otra. */
function vaTarde(envio: Envio): boolean {
  if (!envio.prometido_para || envio.entrega) return false;
  return new Date(envio.prometido_para) < new Date();
}

export function DeliveryPage() {
  const { usuario } = useAuth();
  const puedeDespachar = tienePermiso(usuario, "delivery.add_envio");
  const puedeAdministrar = tienePermiso(usuario, "delivery.change_zona");

  const [config, setConfig] = useState<ConfiguracionEnvios | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevo, setNuevo] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [nuevaZona, setNuevaZona] = useState(false);
  const [nuevoRepartidor, setNuevoRepartidor] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cfg, zns, reps, tab] = await Promise.all([
        obtenerConfiguracion(),
        obtenerZonas(),
        obtenerRepartidores(),
        obtenerTablero(),
      ]);
      setConfig(cfg);
      setZonas(zns);
      setRepartidores(reps);
      setEnvios(tab);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo abrir el tablero."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function conError(accion: () => Promise<void>) {
    try {
      await accion();
    } catch (err) {
      // Los mensajes del servidor están escritos para quien despacha —«Carlos
      // ya lleva 3 envíos»—, así que se muestran tal cual.
      alertaError(extraerMensajeError(err, "No se pudo completar la operación."));
    }
  }

  const quien = config?.nombre_repartidor ?? "Repartidor";
  const quienes = config?.nombre_repartidor_plural ?? "Repartidores";

  return (
    <div className="pagina">
      <div className="cabecera-pagina">
        <h2>
          <Bike size={18} /> Domicilios
        </h2>
        <div className="acciones">
          {puedeDespachar && (
            <button className="btn" onClick={() => setNuevo(true)}>
              <Plus size={15} /> Nuevo domicilio
            </button>
          )}
          {puedeAdministrar && (
            <button className="btn secundario" onClick={() => setAjustes(true)}>
              <Settings2 size={15} /> Ajustes
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="panel">
          <p className="vacio">Abriendo el tablero…</p>
        </div>
      ) : (
        <div className="tablero-envios">
          {COLUMNAS.map((col) => {
            const suyos = envios.filter((e) => e.estado === col.estado);
            return (
              <div className="panel" key={col.estado}>
                <div className="cabecera">
                  <h2>
                    {col.titulo} ({suyos.length})
                  </h2>
                </div>

                {suyos.length === 0 ? (
                  <p className="vacio">Nada aquí</p>
                ) : (
                  <div className="envios-lista">
                    {suyos.map((envio) => (
                      <TarjetaEnvio
                        key={envio.id}
                        envio={envio}
                        quien={quien}
                        repartidores={repartidores}
                        puedeDespachar={puedeDespachar}
                        onCambio={cargar}
                        conError={conError}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="panel">
            <div className="cabecera">
              <h2>{quienes}</h2>
              {puedeAdministrar && (
                <button
                  className="btn secundario"
                  onClick={() => setNuevoRepartidor(true)}
                >
                  <Plus size={15} /> Añadir
                </button>
              )}
            </div>
            {repartidores.length === 0 ? (
              <p className="vacio">
                Nadie dado de alta todavía. Sin {quienes.toLowerCase()} se pueden
                anotar domicilios, pero no despacharlos.
              </p>
            ) : (
              <div className="envios-lista">
                {repartidores.map((r) => (
                  <div className="envio-tarjeta" key={r.id}>
                    <strong>{r.nombre}</strong>
                    <p className="campo-ayuda">
                      Lleva {r.carga_actual} de {r.carga_maxima}
                      {r.vehiculo && ` · ${r.vehiculo}`}
                      {r.telefono && ` · ${r.telefono}`}
                      {!r.activo && " · inactivo"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {nuevo && config && (
        <ModalEnvio
          zonas={zonas}
          exigeZona={config.exige_zona}
          onCerrar={() => setNuevo(false)}
          onCreado={async () => {
            setNuevo(false);
            await cargar();
            alertaExito("Domicilio anotado.");
          }}
        />
      )}

      {ajustes && config && (
        <ModalAjustes
          config={config}
          zonas={zonas}
          onCerrar={() => setAjustes(false)}
          onNuevaZona={() => setNuevaZona(true)}
          onGuardado={async () => {
            setAjustes(false);
            await cargar();
            alertaExito("Ajustes guardados.");
          }}
        />
      )}

      {nuevaZona && (
        <ModalZona
          onCerrar={() => setNuevaZona(false)}
          onCreada={async () => {
            setNuevaZona(false);
            setZonas(await obtenerZonas());
          }}
        />
      )}

      {nuevoRepartidor && (
        <ModalRepartidor
          quien={quien}
          onCerrar={() => setNuevoRepartidor(false)}
          onCreado={async () => {
            setNuevoRepartidor(false);
            setRepartidores(await obtenerRepartidores());
          }}
        />
      )}
    </div>
  );
}

// ==========================================================================
// UNA TARJETA DEL TABLERO
// ==========================================================================
function TarjetaEnvio({
  envio,
  quien,
  repartidores,
  puedeDespachar,
  onCambio,
  conError,
}: {
  envio: Envio;
  quien: string;
  repartidores: Repartidor[];
  puedeDespachar: boolean;
  onCambio: () => Promise<void>;
  conError: (accion: () => Promise<void>) => Promise<void>;
}) {
  return (
    <div className="envio-tarjeta">
      <strong>{envio.nombre_contacto}</strong>
      <p className="campo-ayuda">{envio.direccion}</p>
      {envio.referencia && <p className="campo-ayuda">{envio.referencia}</p>}
      <p className="campo-ayuda">
        {envio.zona_nombre || "Sin zona"} · {envio.tarifa}
        {envio.cobro_contra_entrega && ` · cobra ${envio.monto_a_cobrar}`}
      </p>
      <p className={vaTarde(envio) ? "envio-tarde" : "campo-ayuda"}>
        Prometido {hora(envio.prometido_para)}
        {envio.repartidor_nombre && ` · ${envio.repartidor_nombre}`}
      </p>

      {puedeDespachar && (
        <>
          {/* Asignar es lo único que no es un cambio de estado: hay que decir a
              quién, y el servidor puede negarse porque esa persona va llena. */}
          <select
            value={envio.repartidor ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (!id) return;
              void conError(async () => {
                await asignarEnvio(envio.id, id);
                await onCambio();
              });
            }}
          >
            <option value="">Asignar {quien.toLowerCase()}…</option>
            {repartidores
              .filter((r) => r.activo)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.carga_actual}/{r.carga_maxima})
                </option>
              ))}
          </select>

          <div className="acciones">
            {envio.siguientes.map((s) => (
              <button
                key={s.valor}
                className="btn secundario sm"
                onClick={() =>
                  void conError(async () => {
                    await cambiarEstado(envio.id, s.valor);
                    await onCambio();
                  })
                }
              >
                {s.etiqueta}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================================================
// NUEVO DOMICILIO
// ==========================================================================
function ModalEnvio({
  zonas,
  exigeZona,
  onCerrar,
  onCreado,
}: {
  zonas: Zona[];
  exigeZona: boolean;
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [zona, setZona] = useState("");
  const [contraEntrega, setContraEntrega] = useState(false);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await crearEnvio({
        direccion,
        referencia,
        nombre_contacto: contacto,
        telefono_contacto: telefono,
        zona_id: zona ? Number(zona) : null,
        cobro_contra_entrega: contraEntrega,
        monto_a_cobrar: monto || "0",
        nota,
      });
      await onCreado();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo anotar el domicilio."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Nuevo domicilio"
      onCerrar={onCerrar}
      footer={
        <div className="acciones">
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn"
            disabled={guardando || !direccion || !contacto}
            onClick={() => void guardar()}
          >
            Anotar
          </button>
        </div>
      }
    >
      <div className="campo">
        <label>Dirección</label>
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
      </div>
      <div className="campo">
        <label>Referencia</label>
        <input
          value={referencia}
          placeholder="Casa blanca, portón verde"
          onChange={(e) => setReferencia(e.target.value)}
        />
      </div>
      <div className="campo">
        <label>A nombre de</label>
        <input value={contacto} onChange={(e) => setContacto(e.target.value)} />
      </div>
      <div className="campo">
        <label>Teléfono</label>
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </div>
      <div className="campo">
        <label>Zona</label>
        <select value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">{exigeZona ? "Elige la zona" : "Sin zona"}</option>
          {zonas
            .filter((z) => z.activa)
            .map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre} · {z.tarifa}
              </option>
            ))}
        </select>
      </div>
      <div className="campo">
        <label>
          <input
            type="checkbox"
            checked={contraEntrega}
            onChange={(e) => setContraEntrega(e.target.checked)}
          />{" "}
          Cobra al entregar
        </label>
        {contraEntrega && (
          <input
            type="number"
            step="0.01"
            min="0"
            value={monto}
            placeholder="Cuánto tiene que traer de vuelta"
            onChange={(e) => setMonto(e.target.value)}
          />
        )}
      </div>
      <div className="campo">
        <label>Nota</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
    </Modal>
  );
}

// ==========================================================================
// AJUSTES
// ==========================================================================
function ModalAjustes({
  config,
  zonas,
  onCerrar,
  onNuevaZona,
  onGuardado,
}: {
  config: ConfiguracionEnvios;
  zonas: Zona[];
  onCerrar: () => void;
  onNuevaZona: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [valores, setValores] = useState<ConfiguracionEnvios>(config);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarConfiguracion(valores);
      await onGuardado();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudieron guardar los ajustes."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Ajustes de domicilios"
      onCerrar={onCerrar}
      footer={
        <div className="acciones">
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn" disabled={guardando} onClick={() => void guardar()}>
            Guardar
          </button>
        </div>
      }
    >
      {/* Estas dos cajas son las que hacen que la pantalla entera hable el
          idioma del negocio. No son cosmética: son el mecanismo. */}
      <div className="campo">
        <label>Cómo llamas a quien reparte</label>
        <input
          value={valores.nombre_repartidor}
          onChange={(e) =>
            setValores({ ...valores, nombre_repartidor: e.target.value })
          }
        />
      </div>
      <div className="campo">
        <label>En plural</label>
        <input
          value={valores.nombre_repartidor_plural}
          onChange={(e) =>
            setValores({ ...valores, nombre_repartidor_plural: e.target.value })
          }
        />
      </div>
      <div className="campo">
        <label>Tarifa cuando no hay zona</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={valores.tarifa_base}
          onChange={(e) => setValores({ ...valores, tarifa_base: e.target.value })}
        />
      </div>
      <div className="campo">
        <label>Minutos que se prometen</label>
        <input
          type="number"
          min="1"
          value={valores.minutos_de_promesa}
          onChange={(e) =>
            setValores({ ...valores, minutos_de_promesa: Number(e.target.value) })
          }
        />
      </div>
      <div className="campo">
        <label>
          <input
            type="checkbox"
            checked={valores.exige_zona}
            onChange={(e) => setValores({ ...valores, exige_zona: e.target.checked })}
          />{" "}
          Solo reparto en mis zonas
        </label>
        <small className="campo-ayuda">
          Encendido, una dirección sin zona se rechaza en vez de cobrarse a tarifa
          base.
        </small>
      </div>

      <div className="campo">
        <label>Zonas</label>
        {zonas.length === 0 ? (
          <small className="campo-ayuda">
            Ninguna todavía: todo se cobra a la tarifa base.
          </small>
        ) : (
          zonas.map((z) => (
            <p key={z.id} className="campo-ayuda">
              {z.nombre} · {z.tarifa}
              {z.minutos_de_promesa > 0 && ` · ${z.minutos_de_promesa} min`}
              {!z.activa && " · inactiva"}
            </p>
          ))
        )}
        <button type="button" className="btn secundario sm" onClick={onNuevaZona}>
          <Plus size={14} /> Añadir zona
        </button>
      </div>
    </Modal>
  );
}

// ==========================================================================
// NUEVA ZONA
// ==========================================================================
function ModalZona({
  onCerrar,
  onCreada,
}: {
  onCerrar: () => void;
  onCreada: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [minutos, setMinutos] = useState("0");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarZona({
        nombre,
        codigo,
        tarifa: tarifa || "0",
        minutos_de_promesa: Number(minutos) || 0,
        activa: true,
      });
      await onCreada();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo crear la zona."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Nueva zona"
      onCerrar={onCerrar}
      footer={
        <div className="acciones">
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn"
            disabled={guardando || !nombre || !codigo}
            onClick={() => void guardar()}
          >
            Crear
          </button>
        </div>
      }
    >
      <div className="campo">
        <label>Nombre</label>
        <input
          value={nombre}
          placeholder="Modelia"
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div className="campo">
        <label>Código</label>
        <input
          value={codigo}
          placeholder="modelia"
          onChange={(e) => setCodigo(e.target.value)}
        />
      </div>
      <div className="campo">
        <label>Tarifa</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={tarifa}
          onChange={(e) => setTarifa(e.target.value)}
        />
      </div>
      <div className="campo">
        <label>Minutos que se prometen</label>
        <input
          type="number"
          min="0"
          value={minutos}
          onChange={(e) => setMinutos(e.target.value)}
        />
        <small className="campo-ayuda">
          0 significa «lo que diga el negocio», no cero minutos.
        </small>
      </div>
    </Modal>
  );
}

// ==========================================================================
// NUEVO REPARTIDOR
// ==========================================================================
function ModalRepartidor({
  quien,
  onCerrar,
  onCreado,
}: {
  quien: string;
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [carga, setCarga] = useState("3");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarRepartidor({
        nombre,
        telefono,
        vehiculo,
        carga_maxima: Number(carga) || 1,
        activo: true,
      });
      await onCreado();
    } catch (err) {
      alertaError(extraerMensajeError(err, `No se pudo crear el ${quien.toLowerCase()}.`));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Nuevo ${quien.toLowerCase()}`}
      onCerrar={onCerrar}
      footer={
        <div className="acciones">
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn" disabled={guardando || !nombre} onClick={() => void guardar()}>
            Crear
          </button>
        </div>
      }
    >
      <div className="campo">
        <label>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="campo">
        <label>Teléfono</label>
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </div>
      <div className="campo">
        <label>Vehículo</label>
        <input
          value={vehiculo}
          placeholder="Moto, bicicleta, a pie…"
          onChange={(e) => setVehiculo(e.target.value)}
        />
      </div>
      <div className="campo">
        <label>Cuántos envíos lleva a la vez</label>
        <input
          type="number"
          min="1"
          value={carga}
          onChange={(e) => setCarga(e.target.value)}
        />
        <small className="campo-ayuda">
          Al llegar al tope, el servidor se niega a asignarle más.
        </small>
      </div>
    </Modal>
  );
}
