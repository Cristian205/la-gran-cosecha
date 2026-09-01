/**
 * Las plantillas de tienda de Crynex.
 *
 * Una plantilla es la tienda de arranque de un sector: qué bloques trae cada
 * ruta y con qué aspecto. Adoptarla COPIA todo eso al borrador del negocio, así
 * que editar aquí no toca ninguna tienda publicada — eso es lo que permite
 * retocar «Mercado» sin miedo con cuarenta clientes usándola.
 *
 * La pantalla es un editor a pantalla completa con la vista previa al lado. Una
 * plantilla no pertenece a ningún negocio, así que no hay tienda propia contra
 * la que verla: se previsualiza sobre una tienda de referencia, mandándole la
 * composición y el tema por `postMessage`. Lo que se ve es «cómo quedaría este
 * molde», sin que la tienda real cambie nada.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Layers,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import {
  tienda,
  type Bloque,
  type Composicion,
  type Plantilla,
  type TokenTema,
} from "../api/tienda";
import { Aviso, Boton, Dato, EstadoVacio, Insignia } from "../ui/basicos";
import { Confirmar, Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";
import { Editor } from "../constructor/Editor";
import { PanelTema, variablesDe } from "../constructor/PanelTema";
import { usarPrevia } from "../constructor/usarPrevia";

/** Las rutas que una plantilla puede componer hoy. */
const RUTAS = [
  { ruta: "/", nombre: "Inicio" },
  { ruta: "/nosotros", nombre: "Nosotros" },
  { ruta: "/contacto", nombre: "Contacto" },
];

const PANTALLAS = [
  { clave: "escritorio", icono: Monitor, nombre: "Escritorio", ancho: "100%" },
  { clave: "tablet", icono: Tablet, nombre: "Tablet", ancho: "834px" },
  { clave: "movil", icono: Smartphone, nombre: "Móvil", ancho: "390px" },
] as const;

function urlTienda(): string | null {
  const bruta = import.meta.env.VITE_TIENDA_URL;
  return bruta ? String(bruta).replace(/\/+$/, "") : null;
}

export function Plantillas() {
  const avisar = usarAviso();
  const [catalogo, setCatalogo] = useState<Bloque[]>([]);
  const [tokens, setTokens] = useState<TokenTema[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [elegida, setElegida] = useState<number | null>(null);
  const [ruta, setRuta] = useState("/");
  const [pestana, setPestana] = useState<"secciones" | "tema" | "datos">(
    "secciones"
  );
  const [bloqueElegido, setBloqueElegido] = useState<string | null>(null);
  const [pantalla, setPantalla] = useState<(typeof PANTALLAS)[number]["clave"]>(
    "escritorio"
  );

  /** El borrador local. Nada se envía hasta pulsar Guardar. */
  const [borrador, setBorrador] = useState<Plantilla | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState<Plantilla | null>(null);

  const origen = urlTienda();
  const composicion = borrador?.paginas[ruta] ?? [];
  const valoresTema = useMemo(
    () => (borrador?.tema_valores ?? {}) as Record<string, string>,
    [borrador]
  );
  const variables = useMemo(
    () => variablesDe(tokens, valoresTema),
    [tokens, valoresTema]
  );

  const alSeleccionar = useCallback((id: string) => {
    setBloqueElegido(id);
    setPestana("secciones");
  }, []);

  const { marco, reiniciar } = usarPrevia({
    origen,
    composicion,
    variables,
    elegido: bloqueElegido,
    onSeleccion: alSeleccionar,
  });

  useEffect(() => {
    Promise.all([tienda.bloques(), tienda.plantillas(), tienda.tokens()])
      .then(([b, p, t]) => {
        setCatalogo(b);
        setPlantillas(p);
        setTokens(t);
        if (p.length > 0) setElegida(p[0].id);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  // El borrador se rehace al cambiar de plantilla. Editar sobre una copia es lo
  // que permite descartar cerrando sin guardar.
  useEffect(() => {
    const original = plantillas.find((p) => p.id === elegida) ?? null;
    setBorrador(original ? structuredClone(original) : null);
    setRuta("/");
    setBloqueElegido(null);
    reiniciar();
  }, [elegida, plantillas, reiniciar]);

  const original = plantillas.find((p) => p.id === elegida) ?? null;
  const cambiado =
    borrador !== null &&
    original !== null &&
    JSON.stringify(borrador) !== JSON.stringify(original);

  function componer(siguiente: Composicion) {
    if (!borrador) return;
    setBorrador({
      ...borrador,
      paginas: { ...borrador.paginas, [ruta]: siguiente },
    });
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      const actualizada = await tienda.guardarPlantilla(borrador.id, {
        nombre: borrador.nombre,
        descripcion: borrador.descripcion,
        sector: borrador.sector,
        paginas: borrador.paginas,
        tema_valores: borrador.tema_valores,
        activa: borrador.activa,
      });
      setPlantillas((previas) =>
        previas.map((p) => (p.id === actualizada.id ? actualizada : p))
      );
      avisar(`«${actualizada.nombre}» guardada.`);
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(plantilla: Plantilla) {
    try {
      await tienda.borrarPlantilla(plantilla.id);
      setPlantillas((previas) => previas.filter((p) => p.id !== plantilla.id));
      setElegida((actual) => (actual === plantilla.id ? null : actual));
      avisar(`«${plantilla.nombre}» eliminada.`);
      setBorrando(null);
    } catch (e) {
      avisar((e as Error).message, "malo");
    }
  }

  if (cargando) return <p className="tenue">Cargando el catálogo…</p>;

  if (plantillas.length === 0) {
    return (
      <>
        {error && <Aviso>{error}</Aviso>}
        <EstadoVacio
          icono={Layers}
          titulo="Todavía no hay plantillas"
          accion={
            <Boton variante="primario" onClick={() => setCreando(true)}>
              Crear la primera
            </Boton>
          }
        >
          Una plantilla define qué trae la tienda de un negocio recién dado de
          alta: sus secciones y su aspecto.
        </EstadoVacio>
        {creando && (
          <DialogoNueva
            onCerrar={() => setCreando(false)}
            onCreada={(nueva) => {
              setPlantillas([nueva]);
              setElegida(nueva.id);
              setCreando(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="taller">
      <header className="taller__barra">
        <div className="taller__izq">
          <select
            value={elegida ?? ""}
            onChange={(e) => setElegida(Number(e.target.value))}
          >
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.es_predeterminada ? " · por defecto" : ""}
                {p.activa ? "" : " · retirada"}
              </option>
            ))}
          </select>
          <select value={ruta} onChange={(e) => setRuta(e.target.value)}>
            {RUTAS.map((r) => (
              <option key={r.ruta} value={r.ruta}>
                {r.nombre} ({borrador?.paginas[r.ruta]?.length ?? 0})
              </option>
            ))}
          </select>
          <Boton
            tamano="pequeno"
            icono={<Plus size={13} />}
            onClick={() => setCreando(true)}
          >
            Nueva
          </Boton>
        </div>

        <div className="taller__pantallas">
          {PANTALLAS.map(({ clave, icono: Icono, nombre }) => (
            <button
              key={clave}
              type="button"
              className={`icono-boton ${pantalla === clave ? "esta-activo" : ""}`}
              aria-label={nombre}
              aria-pressed={pantalla === clave}
              title={nombre}
              onClick={() => setPantalla(clave)}
            >
              <Icono size={15} />
            </button>
          ))}
        </div>

        <div className="taller__der">
          {cambiado && <Insignia tono="aviso">Sin guardar</Insignia>}
          {origen && (
            <a
              className="icono-boton"
              href={origen}
              target="_blank"
              rel="noreferrer"
              title="Abrir la tienda de referencia"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <Boton
            variante="fantasma"
            tamano="pequeno"
            icono={<Trash2 size={13} />}
            onClick={() => setBorrando(original)}
            disabled={borrador?.es_predeterminada}
            title={
              borrador?.es_predeterminada
                ? "Es la plantilla por defecto: no se puede eliminar"
                : undefined
            }
          >
            Eliminar
          </Boton>
          <Boton
            variante="primario"
            icono={<Save size={14} />}
            cargando={guardando}
            disabled={!cambiado}
            onClick={guardar}
          >
            Guardar
          </Boton>
        </div>
      </header>

      {error && <Aviso>{error}</Aviso>}

      <div className="taller__cuerpo">
        <aside className="taller__panel">
          <nav className="pestanas pestanas--rutas">
            <button
              type="button"
              className={pestana === "secciones" ? "active" : undefined}
              onClick={() => setPestana("secciones")}
            >
              Secciones
            </button>
            <button
              type="button"
              className={pestana === "tema" ? "active" : undefined}
              onClick={() => {
                setPestana("tema");
                setBloqueElegido(null);
              }}
            >
              Aspecto
            </button>
            <button
              type="button"
              className={pestana === "datos" ? "active" : undefined}
              onClick={() => setPestana("datos")}
            >
              Ficha
            </button>
          </nav>

          {borrador && pestana === "secciones" && (
            <Editor
              catalogo={catalogo}
              composicion={composicion}
              elegido={bloqueElegido}
              onElegir={setBloqueElegido}
              onCambio={componer}
            />
          )}

          {borrador && pestana === "tema" && (
            <PanelTema
              tokens={tokens}
              valores={valoresTema}
              onCambio={(valores) =>
                setBorrador({ ...borrador, tema_valores: valores })
              }
            />
          )}

          {borrador && pestana === "datos" && (
            <div className="formulario">
              <label className="campo">
                <span className="campo__etiqueta">Nombre</span>
                <input
                  value={borrador.nombre}
                  onChange={(e) =>
                    setBorrador({ ...borrador, nombre: e.target.value })
                  }
                />
              </label>

              <label className="campo">
                <span className="campo__etiqueta">Identificador</span>
                <input value={borrador.slug} readOnly spellCheck={false} />
                <span className="campo__ayuda">
                  No se cambia: las tiendas ya adoptadas lo tienen anotado en su
                  historial.
                </span>
              </label>

              <label className="campo">
                <span className="campo__etiqueta">Sector</span>
                <input
                  value={borrador.sector}
                  placeholder="Alimentos, Moda, Restaurante…"
                  onChange={(e) =>
                    setBorrador({ ...borrador, sector: e.target.value })
                  }
                />
                <span className="campo__ayuda">
                  Agrupa las plantillas en la galería y guía la elección al dar
                  de alta un cliente.
                </span>
              </label>

              <label className="campo">
                <span className="campo__etiqueta">Descripción</span>
                <textarea
                  rows={3}
                  value={borrador.descripcion}
                  placeholder="Para quién es y qué trae."
                  onChange={(e) =>
                    setBorrador({ ...borrador, descripcion: e.target.value })
                  }
                />
              </label>

              <label className="campo">
                <span className="campo__etiqueta">Imagen de muestra</span>
                <input
                  value={borrador.vista_previa}
                  placeholder="https://…"
                  spellCheck={false}
                  onChange={(e) =>
                    setBorrador({ ...borrador, vista_previa: e.target.value })
                  }
                />
                <span className="campo__ayuda">
                  Una captura de cómo queda. Se enseña al elegir plantilla.
                </span>
              </label>

              <label className="campo">
                <span className="campo__etiqueta">Orden en la galería</span>
                <input
                  type="number"
                  min={0}
                  value={borrador.orden}
                  onChange={(e) =>
                    setBorrador({ ...borrador, orden: Number(e.target.value) })
                  }
                />
              </label>

              <div className="campo">
                <span className="campo__etiqueta">Resumen</span>
                <dl className="datos">
                  <Dato etiqueta="Secciones">
                    {Object.values(borrador.paginas).reduce(
                      (n, c) => n + c.length,
                      0
                    )}{" "}
                    en {Object.keys(borrador.paginas).length} páginas
                  </Dato>
                  <Dato etiqueta="Aspecto">
                    {Object.keys(borrador.tema_valores ?? {}).length} ajustes
                  </Dato>
                </dl>
              </div>

              <hr className="constructor__separador" />

              <div className="ficha__acciones">
                <Boton
                  onClick={() =>
                    setBorrador({ ...borrador, activa: !borrador.activa })
                  }
                >
                  {borrador.activa ? "Retirar del catálogo" : "Reactivar"}
                </Boton>
              </div>
              <span className="campo__ayuda">
                Retirarla impide adoptarla en clientes nuevos. Las tiendas que
                salieron de ella no cambian: al adoptarla se copió, no se enlazó.
              </span>
            </div>
          )}
        </aside>

        <main className="taller__previa">
          {!origen ? (
            <p className="tenue taller__sin-url">
              Falta <code>VITE_TIENDA_URL</code> en el entorno del panel para
              poder previsualizar. En desarrollo,{" "}
              <code>http://localhost:5175</code>.
            </p>
          ) : (
            <div
              className="taller__marco"
              style={{ width: PANTALLAS.find((p) => p.clave === pantalla)!.ancho }}
            >
              <iframe
                ref={marco}
                key={`${elegida}:${ruta}`}
                title="Vista previa de la plantilla"
                src={`${origen}${ruta}?editor=1`}
              />
            </div>
          )}
        </main>
      </div>

      {creando && (
        <DialogoNueva
          onCerrar={() => setCreando(false)}
          onCreada={(nueva) => {
            setPlantillas((previas) => [...previas, nueva]);
            setElegida(nueva.id);
            setCreando(false);
            avisar(`«${nueva.nombre}» creada. Añádele secciones y guarda.`);
          }}
        />
      )}

      {borrando && (
        <Confirmar
          titulo={`Eliminar ${borrando.nombre}`}
          afecta="Ninguna tienda en marcha"
          peligrosa
          etiquetaAccion="Eliminar la plantilla"
          onCerrar={() => setBorrando(null)}
          onConfirmar={() => borrar(borrando)}
          consecuencias={
            <>
              <p>
                Deja de poder adoptarse. Las tiendas que salieron de ella no
                cambian: al adoptarla se copió su composición, no se enlazó.
              </p>
              <p className="tenue">Esto no se puede deshacer.</p>
            </>
          }
        />
      )}
    </div>
  );
}

function DialogoNueva({
  onCerrar,
  onCreada,
}: {
  onCerrar: () => void;
  onCreada: (plantilla: Plantilla) => void;
}) {
  const avisar = usarAviso();
  const [nombre, setNombre] = useState("");
  const [sector, setSector] = useState("");
  const [creando, setCreando] = useState(false);

  // El slug se deriva del nombre: es un identificador técnico y hacérselo
  // escribir a alguien solo produce erratas.
  const slug = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  async function crear() {
    setCreando(true);
    try {
      const nueva = await tienda.crearPlantilla({
        slug,
        nombre,
        sector,
        paginas: { "/": [] },
        activa: true,
      });
      onCreada(nueva);
    } catch (e) {
      avisar((e as Error).message, "malo");
      setCreando(false);
    }
  }

  return (
    <Modal
      titulo="Nueva plantilla"
      descripcion="La tienda de arranque de un sector."
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            onClick={crear}
            disabled={!nombre.trim() || !slug}
            cargando={creando}
          >
            Crear
          </Boton>
        </>
      }
    >
      <div className="formulario">
        <label className="campo">
          <span className="campo__etiqueta">Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Boutique"
            autoFocus
          />
          {slug && <span className="campo__ayuda">Identificador: {slug}</span>}
        </label>
        <label className="campo">
          <span className="campo__etiqueta">Sector</span>
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Moda"
          />
        </label>
      </div>
    </Modal>
  );
}
