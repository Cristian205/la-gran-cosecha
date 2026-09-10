/**
 * Los planes de Crynex, uno al lado del otro.
 *
 * La pregunta que se hace aquí es comparativa —"¿qué diferencia hay entre
 * Starter y Business?"— y por eso los planes se dibujan en columnas con las
 * mismas filas, no en fichas sueltas: el ojo compara verticalmente sin tener
 * que recordar lo que decía la tarjeta anterior.
 *
 * Qué permisos concede cada plan se edita en la matriz, no aquí. Son dos
 * preguntas distintas y mezclarlas convertiría esta pantalla en un formulario.
 *
 * Lo que sí se edita aquí es el plan en sí —nombre, límites, prueba gratuita,
 * precios— y su ciclo de vida: crear, duplicar, retirar, marcar por defecto.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Pencil, Plus, Power, Star } from "lucide-react";
import type { Periodicidad, Plan, PrecioPlan } from "../api/tipos";
import { usarPlataforma } from "../datos/plataforma";
import { modulosDe } from "../datos/derivados";
import { fechaCorta, moneda, numero, tamano } from "../datos/formato";
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { Confirmar, Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

const MONEDAS = ["COP", "USD", "EUR"] as const;
const PERIODICIDADES: Periodicidad[] = [
  "UNICO",
  "MENSUAL",
  "BIMESTRAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
];
const ETIQUETA_PERIODICIDAD: Record<Periodicidad, string> = {
  UNICO: "Pago único",
  MENSUAL: "Mensual",
  BIMESTRAL: "Bimestral",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

function limiteTexto(plan: Plan, clave: string): string {
  const valor = plan.limites?.[clave];
  if (valor === undefined) return "por defecto";
  if (valor === null) return "Sin límite";
  return clave === "max_almacenamiento_mb" ? tamano(valor) : numero(valor);
}

function slugificar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function Planes() {
  const {
    planes,
    permisos,
    cargando,
    error,
    crearPlan,
    guardarPlan,
    archivarPlan,
    marcarPredeterminado,
    duplicarPlan,
  } = usarPlataforma();
  const avisar = usarAviso();
  const [retirando, setRetirando] = useState<Plan | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Plan | null>(null);
  const [duplicando, setDuplicando] = useState<Plan | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  if (cargando) {
    return (
      <div className="grid items-stretch gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="plan">
            <Esqueleto alto={16} ancho="50%" />
            <Esqueleto alto={30} ancho="70%" />
            <Esqueleto alto={90} />
          </div>
        ))}
      </div>
    );
  }

  /** Envuelve cualquier accion sobre un plan con su aviso y su error. */
  async function actuar(accion: () => Promise<unknown>, mensaje: string) {
    setTrabajando(true);
    try {
      await accion();
      avisar(mensaje);
      setRetirando(null);
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Planes</h1>
          <p className="tenue">
            Lo que una empresa contrata: qué límites tiene y cuánto paga. Los
            permisos que concede cada plan se administran en{" "}
            <Link to="/permisos">la matriz</Link>.
          </p>
        </div>
        <Boton variante="primario" icono={<Plus size={14} />} onClick={() => setCreando(true)}>
          Nuevo plan
        </Boton>
      </header>

      {error && <Aviso>{error}</Aviso>}

      {planes.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay planes"
          accion={
            <Boton variante="primario" onClick={() => setCreando(true)}>
              Crear el primero
            </Boton>
          }
        >
          Sin planes, ninguna empresa puede tener permisos.
        </EstadoVacio>
      ) : (
        <div className="grid items-stretch gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          {planes.map((plan) => {
            const modulos = modulosDe(permisos, plan).filter(
              (m) => m.concedidos.length > 0
            );
            return (
              <article
                key={plan.id}
                className={`plan ${plan.activo ? "" : "esta-retirado"} ${
                  plan.es_predeterminado ? "es-predeterminado" : ""
                }`}
              >
                <header className="plan__cabecera">
                  <h2>{plan.nombre}</h2>
                  <div className="plan__marcas">
                    {plan.es_predeterminado && (
                      <Insignia tono="info">
                        <Star size={11} /> Por defecto
                      </Insignia>
                    )}
                    {!plan.activo && <Insignia tono="neutro">Retirado</Insignia>}
                  </div>
                </header>

                <p className="plan__precio">
                  {Number(plan.precio_mensual) === 0 ? (
                    "Gratis"
                  ) : (
                    <>
                      {moneda(plan.precio_mensual, plan.moneda)}
                      <span className="tenue"> /mes</span>
                    </>
                  )}
                </p>
                {plan.descripcion && <p className="tenue">{plan.descripcion}</p>}
                {plan.trial_dias > 0 && (
                  <p className="tenue">{plan.trial_dias} días de prueba gratis</p>
                )}

                <dl className="plan__limites">
                  <div>
                    <dt>Usuarios</dt>
                    <dd>{limiteTexto(plan, "max_usuarios")}</dd>
                  </div>
                  <div>
                    <dt>Dominios</dt>
                    <dd>{limiteTexto(plan, "max_dominios")}</dd>
                  </div>
                  <div>
                    <dt>Productos</dt>
                    <dd>{limiteTexto(plan, "max_productos")}</dd>
                  </div>
                  <div>
                    <dt>Almacenamiento</dt>
                    <dd>{limiteTexto(plan, "max_almacenamiento_mb")}</dd>
                  </div>
                </dl>

                <div className="plan__modulos">
                  <p className="plan__subtitulo">
                    {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"} ·{" "}
                    {plan.permisos.length} permisos
                  </p>
                  <ul>
                    {modulos.map((modulo) => (
                      <li key={modulo.nombre}>
                        <Check size={13} /> {modulo.nombre}
                      </li>
                    ))}
                  </ul>
                </div>

                <footer className="plan__pie">
                  <span className="tenue">
                    {plan.negocios} {plan.negocios === 1 ? "empresa" : "empresas"}
                  </span>
                  <div className="plan__botones">
                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      icono={<Pencil size={13} />}
                      onClick={() => setEditando(plan)}
                    >
                      Editar
                    </Boton>
                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      icono={<Copy size={13} />}
                      onClick={() => setDuplicando(plan)}
                    >
                      Duplicar
                    </Boton>
                    {!plan.es_predeterminado && plan.activo && (
                      <Boton
                        tamano="pequeno"
                        onClick={() =>
                          actuar(
                            () => marcarPredeterminado(plan),
                            `Las empresas nuevas entrarán en ${plan.nombre}.`
                          )
                        }
                      >
                        Hacer predeterminado
                      </Boton>
                    )}
                    {plan.activo ? (
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        icono={<Power size={13} />}
                        onClick={() => setRetirando(plan)}
                      >
                        Retirar
                      </Boton>
                    ) : (
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        icono={<Power size={13} />}
                        onClick={() =>
                          actuar(
                            () => guardarPlan(plan.id, { estado: "ACTIVO" }),
                            `${plan.nombre} vuelve a estar disponible.`
                          )
                        }
                      >
                        Reactivar
                      </Boton>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {retirando && (
        <Confirmar
          titulo={`Retirar ${retirando.nombre}`}
          afecta={
            retirando.negocios > 0
              ? `${retirando.negocios} ${
                  retirando.negocios === 1 ? "empresa que lo tiene" : "empresas que lo tienen"
                }`
              : "ninguna empresa"
          }
          etiquetaAccion="Retirar el plan"
          peligrosa
          trabajando={trabajando}
          onCerrar={() => setRetirando(null)}
          onConfirmar={() =>
            actuar(
              () => archivarPlan(retirando),
              `${retirando.nombre} queda archivado.`
            )
          }
          consecuencias={
            <>
              <p>
                Deja de poder contratarse. Las empresas que ya lo tienen lo conservan
                intacto: nadie pierde permisos por retirar un plan.
              </p>
              <p className="tenue">Se puede reactivar en cualquier momento.</p>
            </>
          }
        />
      )}

      {creando && (
        <ModalNuevoPlan
          onCerrar={() => setCreando(false)}
          onCrear={async (datos) => {
            const creado = await crearPlan(datos);
            setCreando(false);
            avisar(`${creado.nombre} creado. Edítalo para fijarle límites y precio.`);
            setEditando(creado);
          }}
        />
      )}

      {editando && (
        <ModalEditarPlan
          plan={planes.find((p) => p.id === editando.id) ?? editando}
          onCerrar={() => setEditando(null)}
        />
      )}

      {duplicando && (
        <ModalDuplicarPlan
          plan={duplicando}
          onCerrar={() => setDuplicando(null)}
          onDuplicar={async (datos) => {
            const copia = await duplicarPlan(duplicando, datos);
            setDuplicando(null);
            avisar(
              datos.nueva_version
                ? `${duplicando.nombre} queda archivado; ${copia.nombre} es la versión vigente.`
                : `${copia.nombre} creado a partir de ${duplicando.nombre}.`
            );
          }}
        />
      )}
    </>
  );
}

// -------------------------------------------------------------- nuevo plan

function ModalNuevoPlan({
  onCerrar,
  onCrear,
}: {
  onCerrar: () => void;
  onCrear: (datos: { slug: string; nombre: string }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugificar(nombre);

  async function crear() {
    if (!nombre.trim() || !slug) return;
    setGuardando(true);
    setError(null);
    try {
      await onCrear({ slug, nombre: nombre.trim() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Nuevo plan"
      descripcion="Nace sin límites ni precio: se completan al editarlo."
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            cargando={guardando}
            disabled={!nombre.trim()}
            onClick={crear}
          >
            Crear
          </Boton>
        </>
      }
    >
      {error && <Aviso>{error}</Aviso>}
      <Campo etiqueta="Nombre" ayuda="Por ejemplo: Starter, Growth, Business.">
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
        />
      </Campo>
      {slug && (
        <p className="tenue text-xs">
          Identificador: <code>{slug}</code>
        </p>
      )}
    </Modal>
  );
}

// -------------------------------------------------------------- editar plan

function ModalEditarPlan({ plan, onCerrar }: { plan: Plan; onCerrar: () => void }) {
  const { tiposLimite, guardarPlan, crearPrecio } = usarPlataforma();
  const avisar = usarAviso();
  const [nombre, setNombre] = useState(plan.nombre);
  const [descripcion, setDescripcion] = useState(plan.descripcion);
  const [trialDias, setTrialDias] = useState(String(plan.trial_dias));
  const [limites, setLimites] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(plan.limites ?? {}).map(([clave, valor]) => [
        clave,
        valor === null ? "" : String(valor),
      ])
    )
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiado =
    nombre !== plan.nombre ||
    descripcion !== plan.descripcion ||
    trialDias !== String(plan.trial_dias) ||
    JSON.stringify(limites) !== JSON.stringify(
      Object.fromEntries(
        Object.entries(plan.limites ?? {}).map(([c, v]) => [c, v === null ? "" : String(v)])
      )
    );

  function fijarLimite(codigo: string, valor: string) {
    setLimites((previos) => ({ ...previos, [codigo]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const limitesLimpios: Record<string, number | null> = {};
      for (const tipo of tiposLimite) {
        const bruto = limites[tipo.codigo];
        if (bruto === undefined || bruto === "") continue; // hereda el defecto
        const n = Number(bruto);
        limitesLimpios[tipo.codigo] = Number.isFinite(n) ? n : null;
      }
      await guardarPlan(plan.id, {
        nombre,
        descripcion,
        trial_dias: Number(trialDias) || 0,
        limites: limitesLimpios,
      });
      avisar("Plan actualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar ${plan.nombre}`} ancho={560} onCerrar={onCerrar}>
      {error && <Aviso>{error}</Aviso>}

      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Descripción" ayuda="Lo que lee el cliente al comparar planes.">
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Prueba gratuita (días)"
          ayuda="Cero desactiva la prueba gratuita en este plan."
        >
          <input
            type="number"
            min={0}
            value={trialDias}
            onChange={(e) => setTrialDias(e.target.value)}
          />
        </Campo>

        <div>
          <p className="plan__subtitulo">Límites</p>
          <p className="tenue text-xs mb-2">
            Vacío hereda el valor por defecto del catálogo de límites.
          </p>
          <div className="flex flex-col gap-2">
            {tiposLimite.map((tipo) => (
              <Campo
                key={tipo.codigo}
                etiqueta={tipo.nombre}
                ayuda={
                  tipo.valor_por_defecto === null
                    ? "Por defecto: sin límite"
                    : `Por defecto: ${tipo.valor_por_defecto}`
                }
              >
                <input
                  type="number"
                  min={0}
                  placeholder="sin límite"
                  value={limites[tipo.codigo] ?? ""}
                  onChange={(e) => fijarLimite(tipo.codigo, e.target.value)}
                />
              </Campo>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Boton
            variante="primario"
            cargando={guardando}
            disabled={!cambiado}
            onClick={guardar}
          >
            Guardar cambios
          </Boton>
        </div>

        <hr className="constructor-separador" />

        <PreciosDePlan plan={plan} crearPrecio={crearPrecio} avisar={avisar} />
      </div>
    </Modal>
  );
}

function PreciosDePlan({
  plan,
  crearPrecio,
  avisar,
}: {
  plan: Plan;
  crearPrecio: (planId: number, datos: Partial<PrecioPlan>) => Promise<PrecioPlan>;
  avisar: (mensaje: string, tono?: "ok" | "malo") => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [divisa, setDivisa] = useState<(typeof MONEDAS)[number]>("COP");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>("MENSUAL");
  const [importe, setImporte] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    if (!importe) return;
    setGuardando(true);
    try {
      await crearPrecio(plan.id, {
        moneda: divisa,
        periodicidad,
        importe,
        vigente_desde: vigenteDesde,
      });
      avisar("Precio agregado.");
      setAgregando(false);
      setImporte("");
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="plan__subtitulo">Precios</p>
        {!agregando && (
          <Boton tamano="pequeno" icono={<Plus size={13} />} onClick={() => setAgregando(true)}>
            Agregar precio
          </Boton>
        )}
      </div>

      {plan.precios.length === 0 ? (
        <p className="tenue text-xs">Sin precios: hoy este plan es gratis.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {plan.precios.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span>
                {new Intl.NumberFormat("es-CO", {
                  style: "currency",
                  currency: p.moneda,
                  maximumFractionDigits: 0,
                }).format(Number(p.importe))}{" "}
                <span className="tenue">
                  · {ETIQUETA_PERIODICIDAD[p.periodicidad]} · desde{" "}
                  {fechaCorta(p.vigente_desde)}
                </span>
              </span>
              {p.esta_vigente ? (
                <Insignia tono="ok">Vigente</Insignia>
              ) : (
                <Insignia tono="neutro">Cerrado</Insignia>
              )}
            </li>
          ))}
        </ul>
      )}

      {agregando && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="grid gap-2 grid-cols-2">
            <Campo etiqueta="Moneda">
              <select value={divisa} onChange={(e) => setDivisa(e.target.value as typeof divisa)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Periodicidad">
              <select
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p} value={p}>
                    {ETIQUETA_PERIODICIDAD[p]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="grid gap-2 grid-cols-2">
            <Campo etiqueta="Importe">
              <input
                type="number"
                min={0}
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Vigente desde">
              <input
                type="date"
                value={vigenteDesde}
                onChange={(e) => setVigenteDesde(e.target.value)}
              />
            </Campo>
          </div>
          <div className="flex gap-2 justify-end">
            <Boton tamano="pequeno" onClick={() => setAgregando(false)}>
              Cancelar
            </Boton>
            <Boton
              tamano="pequeno"
              variante="primario"
              cargando={guardando}
              disabled={!importe}
              onClick={agregar}
            >
              Guardar precio
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ duplicar plan

function ModalDuplicarPlan({
  plan,
  onCerrar,
  onDuplicar,
}: {
  plan: Plan;
  onCerrar: () => void;
  onDuplicar: (datos: { slug: string; nombre?: string; nueva_version: boolean }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(`${plan.nombre} (copia)`);
  const [nuevaVersion, setNuevaVersion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugificar(nuevaVersion ? `${plan.slug}-v${plan.version + 1}` : nombre);

  async function duplicar() {
    setGuardando(true);
    setError(null);
    try {
      await onDuplicar({ slug, nombre: nombre.trim() || undefined, nueva_version: nuevaVersion });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Duplicar ${plan.nombre}`}
      descripcion="Copia los mismos permisos, límites y precios."
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" cargando={guardando} onClick={duplicar}>
            Duplicar
          </Boton>
        </>
      }
    >
      {error && <Aviso>{error}</Aviso>}
      <label className="flex gap-2 items-start mb-3">
        <input
          type="checkbox"
          checked={nuevaVersion}
          onChange={(e) => setNuevaVersion(e.target.checked)}
        />
        <span>
          Es la siguiente versión de este plan
          <span className="tenue text-xs block">
            Archiva {plan.nombre}: nadie más lo contrata, pero quien ya lo tiene sigue
            igual. Úsalo para subir un precio sin tocar a los clientes actuales.
          </span>
        </span>
      </label>
      {!nuevaVersion && (
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
      )}
      {slug && (
        <p className="tenue text-xs">
          Identificador: <code>{slug}</code>
        </p>
      )}
    </Modal>
  );
}
