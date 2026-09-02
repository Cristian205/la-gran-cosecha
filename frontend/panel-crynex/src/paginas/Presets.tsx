/**
 * Los presets de negocio.
 *
 * Un preset es el punto de partida de un tipo de negocio: qué sabe hacer, qué
 * módulos usa, cómo describe sus productos y con qué tienda arranca. Adoptarlo
 * COPIA todo eso al negocio, así que editar aquí no toca a ningún cliente que
 * ya lo adoptó — igual que con las plantillas, y por la misma razón: un negocio
 * en producción no puede cambiar solo.
 *
 * Esta pantalla es la prueba de la promesa central de Crynex: dar de alta
 * «floristería» tiene que ser un formulario, no una migración. Si algún día hay
 * que tocar el backend para añadir un tipo de negocio, la arquitectura dejó de
 * cumplir lo que prometía.
 *
 * # Lo que deliberadamente NO se puede hacer aquí
 *
 * Inventar capacidades. La lista de interruptores es fija porque cada capacidad
 * tiene un consumidor real en el código: una bandera que nadie lee prometería
 * una configurabilidad que no existe. Se amplía cuando se construye el módulo
 * que la consume, no antes.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Sparkles, Star, Trash2, Wand2 } from "lucide-react";
import {
  CAPACIDADES,
  SENALES,
  negocio,
  type ModuloComercial,
  type Preset,
} from "../api/negocio";
import { Aviso, Boton, Campo, Esqueleto, EstadoVacio, Insignia } from "../ui/basicos";
import { Confirmar, Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

function presetVacio(): Partial<Preset> {
  return {
    nombre: "",
    descripcion: "",
    sector: "",
    modulos: [],
    capacidades: {},
    esquema_atributos: [],
    politica_stock: { permite_negativo: false },
    dashboard: [],
    senales: {},
    activo: true,
    es_predeterminado: false,
    orden: 0,
  };
}

export function Presets() {
  const avisar = usarAviso();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [modulos, setModulos] = useState<ModuloComercial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [elegido, setElegido] = useState<string | null>(null);
  /** El borrador local. Nada se envía hasta pulsar Guardar. */
  const [borrador, setBorrador] = useState<Preset | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [borrando, setBorrando] = useState<Preset | null>(null);

  async function recargar(seleccionar?: string) {
    const [p, m] = await Promise.all([negocio.presets(), negocio.modulos()]);
    setPresets(p);
    setModulos(m);
    const destino = seleccionar ?? elegido ?? p[0]?.slug ?? null;
    setElegido(destino);
    return p;
  }

  useEffect(() => {
    recargar()
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
    // Solo al montar: recargar() ya decide qué queda seleccionado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El borrador se rehace al cambiar de preset. Editar sobre una copia es lo
  // que permite descartar cerrando sin guardar.
  useEffect(() => {
    const actual = presets.find((p) => p.slug === elegido) ?? null;
    setBorrador(actual ? structuredClone(actual) : null);
  }, [elegido, presets]);

  const sucio = useMemo(() => {
    if (!borrador) return false;
    const original = presets.find((p) => p.slug === borrador.slug);
    return original ? JSON.stringify(original) !== JSON.stringify(borrador) : false;
  }, [borrador, presets]);

  function cambiar(cambios: Partial<Preset>) {
    setBorrador((prev) => (prev ? { ...prev, ...cambios } : prev));
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      await negocio.guardar(borrador.slug, {
        nombre: borrador.nombre,
        descripcion: borrador.descripcion,
        sector: borrador.sector,
        modulos: borrador.modulos,
        capacidades: borrador.capacidades,
        politica_stock: borrador.politica_stock,
        senales: borrador.senales,
        activo: borrador.activo,
        es_predeterminado: borrador.es_predeterminado,
        orden: borrador.orden,
      });
      await recargar(borrador.slug);
      // La versión la sube el servidor, no esta pantalla: si la manejara el
      // cliente, alguien la olvidaría y `preset_version_origen` dejaría de
      // decir nada.
      avisar("Preset guardado. Los negocios que ya lo adoptaron no cambian.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function crear() {
    if (!nombreNuevo.trim()) return;
    setGuardando(true);
    try {
      const creado = await negocio.crear({
        ...presetVacio(),
        nombre: nombreNuevo.trim(),
        // El slug lo deriva el panel del nombre. Es la llave de por vida del
        // preset, así que se ve en la pantalla y no se puede cambiar después.
        slug: nombreNuevo
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 50),
      });
      await recargar(creado.slug);
      setCreando(false);
      setNombreNuevo("");
      avisar("Preset creado. Ya se puede elegir en el alta de un negocio.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!borrando) return;
    setGuardando(true);
    try {
      await negocio.borrar(borrando.slug);
      setBorrando(null);
      setElegido(null);
      await recargar();
      avisar("Preset retirado. Los negocios que lo adoptaron siguen igual.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="grid gap-3 grid-cols-[260px_1fr]">
        <Esqueleto alto={280} />
        <Esqueleto alto={420} />
      </div>
    );
  }

  return (
    <>
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Presets de negocio</h1>
          <p className="tenue">
            El punto de partida de cada tipo de negocio. Adoptarlo copia estos
            valores; editarlos aquí no cambia a ningún cliente que ya lo tenga.
          </p>
        </div>
        <Boton variante="primario" icono={<Plus size={14} />} onClick={() => setCreando(true)}>
          Nuevo preset
        </Boton>
      </header>

      {error && <Aviso>{error}</Aviso>}

      {presets.length === 0 ? (
        <EstadoVacio
          icono={Wand2}
          titulo="Todavía no hay presets"
          accion={
            <Boton variante="primario" onClick={() => setCreando(true)}>
              Crear el primero
            </Boton>
          }
        >
          Sin ninguno, el alta de un negocio no tiene nada que sugerir.
        </EstadoVacio>
      ) : (
        <div className="grid gap-3 items-start grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          {/* ---------- la lista ---------- */}
          <nav className="tarjeta" aria-label="Presets">
            <div className="tarjeta__cuerpo flex flex-col gap-1">
              {presets.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setElegido(p.slug)}
                  className={`text-left rounded px-3 py-2 ${
                    elegido === p.slug ? "bg-[var(--acento-suave,#eef2ff)] font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.nombre}
                    {p.es_predeterminado && <Star size={12} aria-label="Por defecto" />}
                  </div>
                  <div className="tenue text-xs">
                    {p.sector || "Sin sector"} · v{p.version}
                    {!p.activo && " · retirado"}
                  </div>
                </button>
              ))}
            </div>
          </nav>

          {/* ---------- el editor ---------- */}
          {borrador && (
            <section className="tarjeta">
              <header className="tarjeta__cabecera">
                <div>
                  <h2>{borrador.nombre}</h2>
                  <p className="tenue text-xs">
                    <code>{borrador.slug}</code> · versión {borrador.version}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Boton
                    variante="peligro"
                    tamano="pequeno"
                    icono={<Trash2 size={13} />}
                    onClick={() => setBorrando(borrador)}
                  >
                    Retirar
                  </Boton>
                  <Boton
                    variante="primario"
                    icono={<Save size={14} />}
                    cargando={guardando}
                    disabled={!sucio}
                    onClick={guardar}
                  >
                    {sucio ? "Guardar" : "Sin cambios"}
                  </Boton>
                </div>
              </header>

              <div className="tarjeta__cuerpo flex flex-col gap-4">
                <Campo etiqueta="Nombre">
                  <input
                    value={borrador.nombre}
                    onChange={(e) => cambiar({ nombre: e.target.value })}
                  />
                </Campo>

                <Campo etiqueta="Descripción" ayuda="Lo que lee el dueño del negocio al elegir.">
                  <input
                    value={borrador.descripcion}
                    onChange={(e) => cambiar({ descripcion: e.target.value })}
                  />
                </Campo>

                <Campo
                  etiqueta="Sector"
                  ayuda="Solo una etiqueta: se muestra y puntúa en el alta. Nada del sistema se comporta distinto por ella."
                >
                  <input
                    value={borrador.sector}
                    onChange={(e) => cambiar({ sector: e.target.value })}
                  />
                </Campo>

                {/* ---------- capacidades ---------- */}
                <div>
                  <p className="plan__subtitulo">Qué sabe hacer</p>
                  <p className="tenue text-xs mb-2">
                    Esto sí gobierna el comportamiento. La lista es corta porque
                    cada una tiene un consumidor real en el código.
                  </p>
                  <div className="flex flex-col gap-2">
                    {CAPACIDADES.map((cap) => (
                      <label key={cap.codigo} className="flex gap-2 items-start">
                        <input
                          type="checkbox"
                          checked={Boolean(borrador.capacidades[cap.codigo])}
                          onChange={(e) =>
                            cambiar({
                              capacidades: {
                                ...borrador.capacidades,
                                [cap.codigo]: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>
                          <span className="block">{cap.nombre}</span>
                          <span className="tenue text-xs">{cap.descripcion}</span>
                        </span>
                      </label>
                    ))}
                    <label className="flex gap-2 items-start">
                      <input
                        type="checkbox"
                        checked={Boolean(borrador.politica_stock?.permite_negativo)}
                        onChange={(e) =>
                          cambiar({
                            politica_stock: {
                              ...borrador.politica_stock,
                              permite_negativo: e.target.checked,
                            },
                          })
                        }
                      />
                      <span>
                        <span className="block">Permite vender sin existencias</span>
                        <span className="tenue text-xs">
                          Una ferretería prefiere vender y cuadrar después; una
                          farmacia, no.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* ---------- módulos ---------- */}
                <div>
                  <p className="plan__subtitulo">Módulos recomendados</p>
                  <p className="tenue text-xs mb-2">
                    Solo se encienden los que el plan del negocio cubra. Los
                    demás se omiten sin dar error: un preset recomienda, no vende.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {modulos.map((m) => {
                      const puesto = borrador.modulos.includes(m.slug);
                      return (
                        <button
                          key={m.slug}
                          type="button"
                          onClick={() =>
                            cambiar({
                              modulos: puesto
                                ? borrador.modulos.filter((s) => s !== m.slug)
                                : [...borrador.modulos, m.slug],
                            })
                          }
                        >
                          <Insignia tono={puesto ? "ok" : "neutro"} punto={puesto}>
                            {m.nombre}
                          </Insignia>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ---------- señales ---------- */}
                <div>
                  <p className="plan__subtitulo">
                    <Sparkles size={13} /> Cómo se sugiere en el alta
                  </p>
                  <p className="tenue text-xs mb-2">
                    Cuánto pesa cada respuesta del alta para proponer este
                    preset. Cero es «no lo distingue»; dos es «esto lo delata».
                  </p>
                  <div className="flex flex-col gap-1">
                    {SENALES.map((s) => (
                      <div key={s.codigo} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{s.texto}</span>
                        <select
                          value={String(borrador.senales[s.codigo] ?? 0)}
                          onChange={(e) => {
                            const peso = Number(e.target.value);
                            const siguientes = { ...borrador.senales };
                            // Un peso de cero se BORRA en vez de guardarse: el
                            // scoring recorre las claves presentes, y dejar
                            // ceros solo ensucia el JSON sin cambiar nada.
                            if (peso === 0) delete siguientes[s.codigo];
                            else siguientes[s.codigo] = peso;
                            cambiar({ senales: siguientes });
                          }}
                        >
                          <option value="0">No influye</option>
                          <option value="1">Suma</option>
                          <option value="2">Lo delata</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---------- estado ---------- */}
                <div className="flex flex-col gap-2">
                  <label className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={borrador.activo}
                      onChange={(e) => cambiar({ activo: e.target.checked })}
                    />
                    <span>
                      Disponible en el alta
                      <span className="tenue text-xs block">
                        Retirarlo lo oculta a los negocios nuevos; los que ya lo
                        adoptaron siguen igual.
                      </span>
                    </span>
                  </label>
                  <label className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={borrador.es_predeterminado}
                      onChange={(e) => cambiar({ es_predeterminado: e.target.checked })}
                    />
                    <span>
                      Es el de reserva
                      <span className="tenue text-xs block">
                        Al que cae un alta sin candidato claro. Solo puede haber
                        uno; marcarlo aquí lo quita del anterior.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {creando && (
        <Modal
          titulo="Nuevo preset"
          descripcion="Un tipo de negocio nuevo. No hace falta tocar código."
          onCerrar={() => setCreando(false)}
          pie={
            <>
              <Boton onClick={() => setCreando(false)}>Cancelar</Boton>
              <Boton variante="primario" cargando={guardando} onClick={crear}>
                Crear
              </Boton>
            </>
          }
        >
          <Campo etiqueta="Nombre" ayuda="Por ejemplo: Floristería, Panadería, Perfumería.">
            <input
              autoFocus
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crear()}
            />
          </Campo>
        </Modal>
      )}

      {borrando && (
        <Confirmar
          titulo={`¿Retirar «${borrando.nombre}»?`}
          etiquetaAccion="Retirar"
          peligrosa
          trabajando={guardando}
          onCerrar={() => setBorrando(null)}
          onConfirmar={borrar}
          consecuencias={
            <>
              Dejará de ofrecerse en el alta de negocios nuevos. Los que ya lo
              adoptaron conservan su configuración: la copiaron, no la
              referencian.
            </>
          }
        />
      )}
    </>
  );
}
