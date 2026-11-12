/**
 * Integraciones: los servicios externos de los que depende la plataforma, su
 * estado REAL y una conexión guiada para completarlos.
 *
 * El estado sale de `/platform/integrations/`, que comprueba la base de datos
 * en el momento, mira qué variables del servidor están definidas (solo un sí o
 * un no por variable: ningún valor viaja al navegador) y cuenta las empresas
 * que usan WhatsApp. El backend en el que corre el panel aparece conectado por
 * defecto, porque si esta pantalla carga es que ya responde.
 *
 * Las credenciales viven en variables de entorno del servidor y este panel no
 * las guarda. Por eso la «conexión» es guiada: dice qué falta, deja probar la
 * conexión de verdad (base de datos, almacenamiento y correo) y explica cómo
 * completarlo. WhatsApp se activa por empresa y no tiene una prueba única.
 */
import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import { Check, Database, HardDrive, Loader2, Mail, MessageCircle, Plug, RefreshCw, Save, Server, X } from "lucide-react";
import { api } from "../api/cliente";
import { EncabezadoPagina } from "../componentes/piezas";
import type { Tono } from "../datos/derivados";
import { usarSalud } from "../datos/salud";
import { Aviso, Boton, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { ModalAsistente, Resumen } from "../ui/Asistente";
import { usarAviso } from "../ui/Notificaciones";

interface Variable {
  nombre: string;
  definida: boolean;
  requerida: boolean;
  nota: string;
  /** Se puede escribir desde el panel (DATABASE_URL, por ejemplo, no). */
  editable: boolean;
  /** Su valor nunca vuelve del servidor: solo se sabe si está definida. */
  secreta: boolean;
  origen: "panel" | "servidor" | null;
  /** Solo en las que no son secretas: para precargar el formulario. */
  valor?: string;
}

interface Estado {
  id: "base_datos" | "almacenamiento" | "correo" | "whatsapp";
  estado: "ok" | "aviso" | "malo";
  mensaje: string;
  ms?: number | null;
  detalle: Record<string, unknown>;
  variables: Variable[];
  puede_probar: boolean;
  /** Tras guardar R2: el almacenamiento se aplica por completo al reiniciar el servicio. */
  requiere_reinicio?: boolean;
}

interface Prueba {
  ok: boolean;
  mensaje: string;
  ms?: number;
}

const META: Record<Estado["id"], { nombre: string; proveedor: string; icono: ElementType; guia: string }> = {
  base_datos: {
    nombre: "Base de datos",
    proveedor: "PostgreSQL · Supabase",
    icono: Database,
    guia: "Se conecta con DATABASE_URL en el servidor. Si no responde, revisa que la URL, el usuario y el puerto (6543 para el pooler) sean los de Supabase.",
  },
  almacenamiento: {
    nombre: "Almacenamiento de archivos",
    proveedor: "Cloudflare R2",
    icono: HardDrive,
    guia: "Crea un token de R2 con acceso al bucket y define las cuatro variables obligatorias. Sin ellas, los archivos viven en el disco del contenedor y se pierden en cada despliegue.",
  },
  correo: {
    nombre: "Correo transaccional",
    proveedor: "Brevo",
    icono: Mail,
    guia: "Define BREVO_API_KEY y un DEFAULT_FROM_EMAIL de un remitente verificado en Brevo, y usa el backend de correo de Brevo.",
  },
  whatsapp: {
    nombre: "WhatsApp",
    proveedor: "Meta Cloud API · Twilio",
    icono: MessageCircle,
    guia: "Cada empresa activa su proveedor y sus plantillas desde su propia configuración. Aquí solo se definen las credenciales de la plataforma que esos proveedores necesitan.",
  },
};

const TONO: Record<Estado["estado"], Tono> = { ok: "ok", aviso: "aviso", malo: "malo" };
const ETIQUETA: Record<Estado["estado"], string> = { ok: "Conectada", aviso: "Incompleta", malo: "Sin conexión" };

export function Integraciones() {
  const avisar = usarAviso();
  const { healthz } = usarSalud();
  const [lista, setLista] = useState<Estado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<Estado | null>(null);
  const [probando, setProbando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setLista(await api.get<Estado[]>("/platform/integrations/"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function probar(id: Estado["id"]): Promise<Prueba> {
    setProbando(id);
    try {
      return await api.post<Prueba>(`/platform/integrations/${id}/probar/`, {});
    } catch (e) {
      return { ok: false, mensaje: (e as Error).message };
    } finally {
      setProbando(null);
    }
  }

  const cifras = useMemo(() => {
    const l = lista ?? [];
    return [
      { etiqueta: "Integraciones", valor: l.length + 1 },
      { etiqueta: "Conectadas", valor: l.filter((i) => i.estado === "ok").length + 1 },
      { etiqueta: "Incompletas", valor: l.filter((i) => i.estado === "aviso").length, tono: l.some((i) => i.estado === "aviso") ? ("aviso" as const) : undefined },
      { etiqueta: "Sin conexión", valor: l.filter((i) => i.estado === "malo").length, tono: l.some((i) => i.estado === "malo") ? ("malo" as const) : undefined },
    ];
  }, [lista]);

  const urlApi = (import.meta.env.VITE_API_URL as string | undefined) || `${window.location.origin}/api`;

  return (
    <>
      <EncabezadoPagina
        antetitulo="Sistema"
        icono={Plug}
        titulo="Integraciones"
        descripcion="Los servicios externos de los que depende la plataforma, su estado real y cómo completarlos."
        acciones={
          <Boton icono={cargando ? <Loader2 size={14} className="girando" /> : <RefreshCw size={14} />} onClick={cargar} disabled={cargando}>
            Actualizar
          </Boton>
        }
        cifras={cifras}
      />

      {error && <Aviso>{error}</Aviso>}

      <div className="rejilla-tarjetas">
        {/* El backend en el que corre el panel: si esta pantalla cargó, ya responde. */}
        <article className="tarjeta integracion">
          <div className="integracion__cabecera">
            <span className="integracion__icono" aria-hidden="true">
              <Server size={18} />
            </span>
            <Insignia tono={error ? "malo" : "ok"} punto>
              {error ? "Sin conexión" : "Sincronizado"}
            </Insignia>
          </div>
          <h2 className="integracion__nombre">API de la plataforma</h2>
          <p className="integracion__proveedor">Django · {healthz?.status === "ok" ? "healthz ok" : "en línea"}</p>
          <p className="integracion__descripcion">El backend al que está conectado este panel. Viene sincronizado por defecto.</p>
          <p className="integracion__detalle">
            <code>{urlApi}</code>
          </p>
        </article>

        {lista === null && !error
          ? Array.from({ length: 4 }, (_, i) => <Esqueleto key={i} alto={210} />)
          : (lista ?? []).map((i) => {
              const m = META[i.id];
              const Icono = m.icono;
              const faltan = i.variables.filter((v) => v.requerida && !v.definida).length;
              return (
                <article key={i.id} className="tarjeta integracion">
                  <div className="integracion__cabecera">
                    <span className="integracion__icono" aria-hidden="true">
                      <Icono size={18} />
                    </span>
                    <Insignia tono={TONO[i.estado]} punto>
                      {i.id === "whatsapp" && i.estado === "aviso" ? "Sin empresas" : ETIQUETA[i.estado]}
                    </Insignia>
                  </div>
                  <h2 className="integracion__nombre">{m.nombre}</h2>
                  <p className="integracion__proveedor">{m.proveedor}</p>
                  <p className="integracion__descripcion">{i.mensaje}</p>
                  <p className="integracion__detalle">
                    {faltan > 0
                      ? `Faltan ${faltan} ${faltan === 1 ? "variable obligatoria" : "variables obligatorias"} en el servidor.`
                      : "Variables del servidor completas."}
                    {i.ms != null && ` · ${i.ms} ms`}
                  </p>
                  <div className="integracion__acciones">
                    <Boton variante="primario" tamano="pequeno" onClick={() => setAbierta(i)}>
                      {i.estado === "ok" ? "Revisar conexión" : "Conectar"}
                    </Boton>
                    {i.puede_probar && (
                      <Boton
                        tamano="pequeno"
                        cargando={probando === i.id}
                        onClick={async () => {
                          const r = await probar(i.id);
                          avisar(r.mensaje, r.ok ? "ok" : "malo");
                        }}
                      >
                        Probar
                      </Boton>
                    )}
                  </div>
                </article>
              );
            })}
      </div>

      {lista !== null && lista.length === 0 && (
        <EstadoVacio icono={Plug} titulo="Sin integraciones">
          El servidor no devolvió ninguna integración.
        </EstadoVacio>
      )}

      {abierta && (
        <ModalConexion
          integracion={abierta}
          alProbar={() => probar(abierta.id)}
          alCerrar={() => {
            setAbierta(null);
            void cargar();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- conexión */

function ModalConexion({
  integracion: inicial,
  alProbar,
  alCerrar,
}: {
  integracion: Estado;
  alProbar: () => Promise<Prueba>;
  alCerrar: () => void;
}) {
  const avisar = usarAviso();
  const m = META[inicial.id];
  const [integracion, setIntegracion] = useState<Estado>(inicial);
  const [resultado, setResultado] = useState<Prueba | null>(null);
  const [probando, setProbando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  // Lo escrito en el formulario. Los secretos arrancan vacíos: nunca se muestran.
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(inicial.variables.filter((v) => v.editable).map((v) => [v.nombre, v.secreta ? "" : (v.valor ?? "")]))
  );
  const [quitar, setQuitar] = useState<Set<string>>(new Set());

  const editables = integracion.variables.filter((v) => v.editable);
  const fijas = integracion.variables.filter((v) => !v.editable);
  const faltan = integracion.variables.filter((v) => v.requerida && !v.definida);
  const opcionalesFaltan = integracion.variables.filter((v) => !v.requerida && !v.definida);

  // Solo se envía lo que cambió: un campo secreto vacío significa «dejar como está».
  const cambios = useMemo(() => {
    const c: Record<string, string> = {};
    for (const v of editables) {
      if (quitar.has(v.nombre)) c[v.nombre] = "";
      else if (v.secreta ? valores[v.nombre] !== "" : valores[v.nombre] !== (v.valor ?? "")) c[v.nombre] = valores[v.nombre] ?? "";
    }
    return c;
  }, [editables, valores, quitar]);
  const hayCambios = Object.keys(cambios).length > 0;

  async function guardar() {
    setGuardando(true);
    setErrores({});
    try {
      const nuevo = await api.patch<Estado>(`/platform/integrations/${integracion.id}/`, { valores: cambios });
      setIntegracion(nuevo);
      setQuitar(new Set());
      setValores(Object.fromEntries(nuevo.variables.filter((v) => v.editable).map((v) => [v.nombre, v.secreta ? "" : (v.valor ?? "")])));
      setResultado(null);
      avisar(nuevo.requiere_reinicio ? "Guardado. El almacenamiento se aplica por completo al reiniciar el servicio." : "Credenciales guardadas.");
    } catch (e) {
      const detalle = (e as { detalle?: { valores?: Record<string, string> } }).detalle?.valores;
      if (detalle) setErrores(detalle);
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setResultado(await alProbar());
    setProbando(false);
  }

  return (
    <ModalAsistente
      titulo={`Conectar ${m.nombre}`}
      descripcion={m.proveedor}
      ancho={620}
      etiquetaFinal="Listo"
      onCerrar={alCerrar}
      onFinalizar={alCerrar}
      pasos={[
        {
          id: "credenciales",
          titulo: "Credenciales",
          contenido: (
            <>
              <p className="tenue text-xs">{m.guia}</p>
              {editables.length > 0 ? (
                <div className="int-formulario">
                  {editables.map((v) => {
                    const marcadaParaQuitar = quitar.has(v.nombre);
                    return (
                      <div key={v.nombre} className={`int-campo ${errores[v.nombre] ? "int-campo--error" : ""}`}>
                        <label htmlFor={`int-${v.nombre}`}>
                          <code>{v.nombre}</code>
                          {v.requerida && <span className="int-campo__req"> obligatoria</span>}
                          <span className="int-campo__origen">
                            {v.origen === "panel" ? (
                              <Insignia tono="ok">Guardada en el panel</Insignia>
                            ) : v.origen === "servidor" ? (
                              <Insignia tono="info">Del servidor</Insignia>
                            ) : (
                              <Insignia tono={v.requerida ? "aviso" : "neutro"}>Sin definir</Insignia>
                            )}
                          </span>
                        </label>
                        <div className="int-campo__entrada">
                          <input
                            id={`int-${v.nombre}`}
                            type={v.secreta ? "password" : "text"}
                            value={marcadaParaQuitar ? "" : (valores[v.nombre] ?? "")}
                            disabled={marcadaParaQuitar}
                            onChange={(e) => setValores((x) => ({ ...x, [v.nombre]: e.target.value }))}
                            placeholder={v.secreta ? (v.definida ? "•••••••• guardada — escribe para reemplazar" : "Pega aquí el valor") : "Escribe el valor"}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          {v.origen === "panel" && (
                            <button
                              type="button"
                              className="int-campo__quitar"
                              onClick={() =>
                                setQuitar((q) => {
                                  const n = new Set(q);
                                  if (n.has(v.nombre)) n.delete(v.nombre);
                                  else n.add(v.nombre);
                                  return n;
                                })
                              }
                            >
                              {marcadaParaQuitar ? "Deshacer" : "Quitar"}
                            </button>
                          )}
                        </div>
                        <small className="tenue">{marcadaParaQuitar ? "Se quitará la del panel y volverá a mandar la del servidor, si existe." : v.nota}</small>
                        {errores[v.nombre] && <small className="int-campo__error" role="alert">{errores[v.nombre]}</small>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="tenue text-xs">Esta integración no se configura desde el panel.</p>
              )}

              {fijas.length > 0 && (
                <ul className="int-variables">
                  {fijas.map((v) => (
                    <li key={v.nombre} className={v.definida ? "esta-definida" : "esta-falta"}>
                      <span className="int-variables__marca" aria-hidden="true">{v.definida ? <Check size={13} /> : <X size={13} />}</span>
                      <span className="int-variables__texto">
                        <code>{v.nombre}</code>
                        <small className="tenue">{v.nota} Se configura en el servidor.</small>
                      </span>
                      <span className="int-variables__estado">{v.definida ? "Definida" : "Falta"}</span>
                    </li>
                  ))}
                </ul>
              )}

              {editables.length > 0 && (
                <div className="int-guardar">
                  <Boton variante="primario" icono={<Save size={14} />} cargando={guardando} disabled={!hayCambios} onClick={guardar}>
                    Guardar credenciales
                  </Boton>
                  <span className="tenue text-xs">
                    {hayCambios ? "Hay cambios sin guardar." : "Se guardan cifradas; el panel nunca las vuelve a mostrar."}
                  </span>
                </div>
              )}
              {integracion.requiere_reinicio && (
                <Aviso tono="aviso">El almacenamiento se aplica por completo al reiniciar el servicio (en Render, un nuevo despliegue o «Restart»).</Aviso>
              )}
              {faltan.length > 0 && (
                <Aviso tono="aviso">
                  Faltan {faltan.length} {faltan.length === 1 ? "variable obligatoria" : "variables obligatorias"}:{" "}
                  {faltan.map((v) => v.nombre).join(", ")}.
                </Aviso>
              )}
            </>
          ),
        },
        {
          id: "verificacion",
          titulo: "Verificación",
          contenido: integracion.puede_probar ? (
            <>
              <p className="tenue text-xs">
                Hace una comprobación real contra el servicio, ahora mismo. No cambia ningún dato
                {integracion.id === "correo" ? " ni envía ningún correo" : ""}.
              </p>
              {hayCambios && <Aviso tono="aviso">Tienes cambios sin guardar: la prueba usa lo que ya está guardado.</Aviso>}
              <Boton
                variante="primario"
                cargando={probando}
                icono={<Plug size={14} />}
                onClick={probar}
                disabled={integracion.id === "correo" && faltan.some((v) => v.nombre === "BREVO_API_KEY")}
              >
                Probar conexión
              </Boton>
              {resultado && (
                <div className={`int-resultado ${resultado.ok ? "es-ok" : "es-malo"}`} role="status">
                  {resultado.ok ? <Check size={16} /> : <X size={16} />}
                  <span>
                    {resultado.mensaje}
                    {resultado.ms != null && <small className="tenue"> {resultado.ms} ms</small>}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="tenue text-xs">
                WhatsApp no tiene una conexión única que probar: cada empresa activa su proveedor y su número desde su propia
                configuración.
              </p>
              <Resumen
                filas={[
                  { etiqueta: "Empresas que lo usan", valor: String(integracion.detalle.empresas_activas ?? 0) },
                  {
                    etiqueta: "Por proveedor",
                    valor: Object.entries((integracion.detalle.por_proveedor as Record<string, number>) ?? {})
                      .map(([p, n]) => `${p}: ${n}`)
                      .join(" · "),
                  },
                ]}
              />
              <p className="tenue text-xs">
                Los avisos disponibles están en <Link to="/automatizaciones">Automatizaciones</Link>.
              </p>
            </>
          ),
        },
        {
          id: "resumen",
          titulo: "Resumen",
          contenido: (
            <>
              <Resumen
                filas={[
                  { etiqueta: "Integración", valor: m.nombre },
                  { etiqueta: "Variables obligatorias", valor: faltan.length === 0 ? "Completas" : `Faltan ${faltan.length}` },
                  { etiqueta: "Opcionales sin definir", valor: opcionalesFaltan.length ? String(opcionalesFaltan.length) : "Ninguna" },
                  {
                    etiqueta: "Última prueba",
                    valor: resultado ? (resultado.ok ? "Correcta" : "Falló") : integracion.puede_probar ? "Sin probar" : "No aplica",
                  },
                ]}
              />
              {resultado && !resultado.ok && <Aviso>{resultado.mensaje}</Aviso>}
              <p className="tenue text-xs">Al cerrar se actualiza el estado de todas las integraciones.</p>
            </>
          ),
        },
      ]}
    />
  );
}
