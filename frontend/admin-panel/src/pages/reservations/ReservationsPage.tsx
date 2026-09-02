import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Settings2 } from "lucide-react";
import {
  cambiarEstado,
  crearRecurso,
  crearReserva,
  guardarConfiguracion,
  obtenerAgenda,
  obtenerConfiguracion,
  obtenerRecursos,
  type ConfiguracionReservas,
  type EstadoReserva,
  type Recurso,
  type Reserva,
} from "../../api/reservas";
import { Modal } from "../../components/Modal";
import { extraerMensajeError, tienePermiso } from "../../utils";
import { useAuth } from "../../auth/AuthContext";
import { alertaError, alertaExito } from "../../utils/alertas";

/**
 * La agenda.
 *
 * Toda la pantalla se titula con lo que el negocio dijo que reserva —«Mesas»,
 * «Canchas», «Sillas»—, y no hay ni un «Recurso» a la vista. Es la misma regla
 * que gobierna la tienda, aplicada al vocabulario: los datos NOMBRAN, el código
 * PINTA. Un panel que dijera «Recursos» le estaría enseñando al usuario la
 * palabra del programador.
 *
 * Los botones de estado tampoco se deciden aquí: cada reserva llega con su
 * lista de `siguientes`. Reimplementar la tabla de transiciones en TypeScript
 * es cómo acaban divergiendo el servidor y el panel, y el síntoma son botones
 * que se pulsan y no hacen nada.
 */
export function ReservationsPage() {
  const { usuario } = useAuth();
  const puedeReservar = tienePermiso(usuario, "reservations.add_reserva");
  const puedeAdministrar = tienePermiso(usuario, "reservations.change_recurso");

  const [config, setConfig] = useState<ConfiguracionReservas | null>(null);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [cargando, setCargando] = useState(true);

  const [nueva, setNueva] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [nuevoRecurso, setNuevoRecurso] = useState(false);

  const ventana = useMemo(() => {
    const inicio = new Date(`${dia}T00:00:00`);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);
    return [inicio.toISOString(), fin.toISOString()] as const;
  }, [dia]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cfg, recs, ags] = await Promise.all([
        obtenerConfiguracion(),
        obtenerRecursos(),
        obtenerAgenda(ventana[0], ventana[1]),
      ]);
      setConfig(cfg);
      setRecursos(recs);
      setReservas(ags);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo cargar la agenda."));
    } finally {
      setCargando(false);
    }
  }, [ventana]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombre = config?.nombre_recurso ?? "Recurso";
  const plural = config?.nombre_recurso_plural ?? "Recursos";

  async function avanzar(reserva: Reserva, estado: EstadoReserva) {
    try {
      await cambiarEstado(reserva.id, estado);
      await cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo cambiar el estado."));
    }
  }

  return (
    <div className="pagina">
      <div className="cabecera-pagina">
        <h2>
          <CalendarClock size={18} /> Reservas
        </h2>
        <div className="acciones">
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
          {puedeAdministrar && (
            <button className="btn secundario" onClick={() => setAjustes(true)}>
              <Settings2 size={15} /> Ajustes
            </button>
          )}
          {puedeReservar && recursos.length > 0 && (
            <button className="btn" onClick={() => setNueva(true)}>
              <Plus size={15} /> Reservar
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <p className="vacio">Cargando…</p>
      ) : recursos.length === 0 ? (
        <div className="panel">
          <p className="vacio">
            Todavía no has dado de alta ninguna {nombre.toLowerCase()}. Sin eso no
            hay nada que reservar.
          </p>
          {puedeAdministrar && (
            <button className="btn" onClick={() => setNuevoRecurso(true)}>
              <Plus size={15} /> Añadir {nombre.toLowerCase()}
            </button>
          )}
        </div>
      ) : (
        <div className="panel">
          <div className="modal-seccion">
            <span>
              {plural} · {reservas.length} reserva(s)
            </span>
            {puedeAdministrar && (
              <button className="btn-icon" onClick={() => setNuevoRecurso(true)} title={`Añadir ${nombre}`}>
                <Plus size={15} />
              </button>
            )}
          </div>

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>{nombre}</th>
                  <th>A nombre de</th>
                  <th>Personas</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reservas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="vacio">
                      Nada reservado para este día.
                    </td>
                  </tr>
                )}
                {reservas.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {new Date(r.inicio).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      {r.recurso_nombre}
                      {r.recurso_zona && <small> · {r.recurso_zona}</small>}
                    </td>
                    <td>
                      {r.nombre_contacto}
                      {r.telefono_contacto && <small> · {r.telefono_contacto}</small>}
                    </td>
                    <td>{r.personas}</td>
                    <td>{r.estado_display}</td>
                    <td>
                      {puedeReservar &&
                        r.siguientes.map((s) => (
                          <button
                            key={s.valor}
                            className="btn secundario"
                            style={{ marginRight: ".35rem" }}
                            onClick={() => void avanzar(r, s.valor)}
                          >
                            {s.etiqueta}
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nueva && config && (
        <ModalReserva
          recursos={recursos}
          dia={dia}
          nombre={nombre}
          onCerrar={() => setNueva(false)}
          onCreada={async () => {
            setNueva(false);
            await cargar();
          }}
        />
      )}

      {nuevoRecurso && (
        <ModalRecurso
          nombre={nombre}
          onCerrar={() => setNuevoRecurso(false)}
          onCreado={async () => {
            setNuevoRecurso(false);
            await cargar();
          }}
        />
      )}

      {ajustes && config && (
        <ModalAjustes
          config={config}
          onCerrar={() => setAjustes(false)}
          onGuardado={async () => {
            setAjustes(false);
            await cargar();
          }}
        />
      )}
    </div>
  );
}

// ==========================================================================
// NUEVA RESERVA
// ==========================================================================
function ModalReserva({
  recursos,
  dia,
  nombre,
  onCerrar,
  onCreada,
}: {
  recursos: Recurso[];
  dia: string;
  nombre: string;
  onCerrar: () => void;
  onCreada: () => Promise<void>;
}) {
  const [recursoId, setRecursoId] = useState<number>(recursos[0]?.id ?? 0);
  const [hora, setHora] = useState("20:00");
  const [personas, setPersonas] = useState(2);
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await crearReserva({
        recurso_id: recursoId,
        inicio: new Date(`${dia}T${hora}:00`).toISOString(),
        personas,
        nombre_contacto: contacto,
        telefono_contacto: telefono,
      });
      alertaExito("Reserva creada.");
      await onCreada();
    } catch (err) {
      // «Mesa 1 ya está ocupada a esa hora» viene escrito para quien atiende:
      // se muestra tal cual.
      alertaError(extraerMensajeError(err, "No se pudo reservar."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Nueva reserva" onCerrar={onCerrar}>
      <div className="campo">
        <label>{nombre}</label>
        <select value={recursoId} onChange={(e) => setRecursoId(Number(e.target.value))}>
          {recursos
            .filter((r) => r.activo)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
                {r.capacidad > 0 ? ` · hasta ${r.capacidad}` : ""}
              </option>
            ))}
        </select>
      </div>
      <div className="campo">
        <label>Hora</label>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        <small className="campo-ayuda">
          La duración la pone el negocio en sus ajustes.
        </small>
      </div>
      <div className="campo">
        <label>Personas</label>
        <input
          type="number"
          min={1}
          value={personas}
          onChange={(e) => setPersonas(Number(e.target.value))}
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
      <div className="acciones">
        <button className="btn secundario" onClick={onCerrar}>
          Cancelar
        </button>
        <button className="btn" disabled={guardando || !contacto} onClick={() => void guardar()}>
          Reservar
        </button>
      </div>
    </Modal>
  );
}

// ==========================================================================
// NUEVO RECURSO
// ==========================================================================
function ModalRecurso({
  nombre,
  onCerrar,
  onCreado,
}: {
  nombre: string;
  onCerrar: () => void;
  onCreado: () => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [zona, setZona] = useState("");
  const [capacidad, setCapacidad] = useState(4);
  const [simultaneas, setSimultaneas] = useState(1);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await crearRecurso({
        codigo: texto
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40),
        nombre: texto,
        zona,
        capacidad,
        reservas_simultaneas: simultaneas,
        activo: true,
        orden: 0,
        ubicacion_id: null,
      });
      await onCreado();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Nueva ${nombre.toLowerCase()}`} onCerrar={onCerrar}>
      <div className="campo">
        <label>Nombre</label>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="campo">
        <label>Zona</label>
        <input
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          placeholder="Salón, terraza, piso 2…"
        />
      </div>
      <div className="campo">
        <label>Cuánta gente cabe</label>
        <input
          type="number"
          min={0}
          value={capacidad}
          onChange={(e) => setCapacidad(Number(e.target.value))}
        />
        <small className="campo-ayuda">
          Cero si no aplica: una hora de servicio no tiene aforo.
        </small>
      </div>
      <div className="campo">
        <label>Reservas a la vez</label>
        <input
          type="number"
          min={1}
          value={simultaneas}
          onChange={(e) => setSimultaneas(Number(e.target.value))}
        />
        <small className="campo-ayuda">
          Una mesa admite una; una sala de clases, varias.
        </small>
      </div>
      <div className="acciones">
        <button className="btn secundario" onClick={onCerrar}>
          Cancelar
        </button>
        <button className="btn" disabled={guardando || !texto} onClick={() => void guardar()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

// ==========================================================================
// AJUSTES
// ==========================================================================
function ModalAjustes({
  config,
  onCerrar,
  onGuardado,
}: {
  config: ConfiguracionReservas;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [valores, setValores] = useState(config);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await guardarConfiguracion(valores);
      await onGuardado();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Ajustes de reservas" onCerrar={onCerrar}>
      <div className="campo">
        <label>Cómo llamas a lo que se reserva</label>
        <input
          value={valores.nombre_recurso}
          onChange={(e) => setValores({ ...valores, nombre_recurso: e.target.value })}
          placeholder="Mesa, cancha, silla…"
        />
        <small className="campo-ayuda">
          Es lo que verás en toda la pantalla y en la caja.
        </small>
      </div>
      <div className="campo">
        <label>En plural</label>
        <input
          value={valores.nombre_recurso_plural}
          onChange={(e) =>
            setValores({ ...valores, nombre_recurso_plural: e.target.value })
          }
        />
      </div>
      <div className="campo">
        <label>Cuánto dura una reserva (minutos)</label>
        <input
          type="number"
          min={5}
          value={valores.duracion_minutos}
          onChange={(e) =>
            setValores({ ...valores, duracion_minutos: Number(e.target.value) })
          }
        />
      </div>
      <div className="campo">
        <label>Con cuánta antelación se puede reservar (días)</label>
        <input
          type="number"
          min={1}
          value={valores.antelacion_maxima_dias}
          onChange={(e) =>
            setValores({ ...valores, antelacion_maxima_dias: Number(e.target.value) })
          }
        />
      </div>
      <div className="acciones">
        <button className="btn secundario" onClick={onCerrar}>
          Cancelar
        </button>
        <button className="btn" disabled={guardando} onClick={() => void guardar()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
