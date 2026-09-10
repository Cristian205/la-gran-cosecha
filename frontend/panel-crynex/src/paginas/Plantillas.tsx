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
 *
 * # Las tres zonas
 *
 * Izquierda: la estructura de la página (o, temporalmente, el catálogo para
 * agregar una sección, o el editor de apariencia global — los tres se turnan
 * el mismo hueco, nunca compiten por espacio). Centro: el lienzo, la tienda de
 * referencia real. Derecha: los ajustes de lo que esté elegido, o un estado
 * vacío si no hay nada. Elegir una sección ya no navega a otra pantalla — solo
 * la resalta a la izquierda y abre sus ajustes a la derecha, así que el árbol
 * entero sigue a la vista mientras se edita.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Layers,
  Monitor,
  Plus,
  Save,
  Settings,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import {
  actualizar as actualizarBloque,
  bloqueNuevo,
  duplicar as duplicarBloque,
  mover,
  quitar as quitarBloque,
  tienda,
  type Bloque,
  type BloqueColocado,
  type Composicion,
  type EnlaceDePrueba,
  type NegocioBreve,
  type Plantilla,
  type TokenTema,
} from "../api/tienda";
import { Aviso, Boton, EstadoVacio, Insignia } from "../ui/basicos";
import { Confirmar, Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";
import { BarraFlotante } from "../constructor/BarraFlotante";
import { ListaEstructura } from "../constructor/ListaEstructura";
import { PanelAjustesBloque } from "../constructor/PanelAjustesBloque";
import { PanelTema, variablesDe } from "../constructor/PanelTema";
import { SelectorDeBloques } from "../constructor/SelectorDeBloques";
import { usarPrevia } from "../constructor/usarPrevia";
import { PlantillaConfiguracion } from "./PlantillaConfiguracion";

/**
 * Las rutas que una plantilla puede componer hoy.
 *
 * `/_layout` no es una pagina que se visite: es el armazon —la cabecera y el
 * pie— que envuelve a todas las demas. Se edita aqui como una composicion mas
 * porque lo es: mismos bloques, mismas variantes, misma visibilidad por
 * dispositivo. Va primero porque es lo que el visitante ve en todas las rutas.
 */
const RUTAS = [
  { ruta: "/_layout", nombre: "Cabecera y pie" },
  { ruta: "/", nombre: "Inicio" },
  { ruta: "/nosotros", nombre: "Nosotros" },
  { ruta: "/contacto", nombre: "Contacto" },
  // La trajo la plantilla «Belleza». Una plantilla que no la use la ensena
  // vacia, que es lo mismo que le pasa hoy a «Nosotros» en «Mercado»: la lista
  // es de rutas que Crynex sabe componer, no de rutas obligatorias.
  { ruta: "/entrar", nombre: "Acceso" },
];

const PANTALLAS = [
  { clave: "escritorio", icono: Monitor, nombre: "Escritorio", ancho: "100%" },
  { clave: "tablet", icono: Tablet, nombre: "Tablet", ancho: "834px" },
  { clave: "movil", icono: Smartphone, nombre: "Móvil", ancho: "390px" },
] as const;

/** Dónde vive esta plantilla: solo se muestra un hueco a la vez. */
type VistaIzquierda = "estructura" | "catalogo" | "apariencia";

function urlTienda(): string | null {
  const bruta = import.meta.env.VITE_TIENDA_URL;
  return bruta ? String(bruta).replace(/\/+$/, "") : null;
}

export function Plantillas() {
  const avisar = usarAviso();
  const navegar = useNavigate();
  const [catalogo, setCatalogo] = useState<Bloque[]>([]);
  const [tokens, setTokens] = useState<TokenTema[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [elegida, setElegida] = useState<number | null>(null);
  const [ruta, setRuta] = useState("/");
  const [vistaIzquierda, setVistaIzquierda] = useState<VistaIzquierda>("estructura");
  const [configAbierta, setConfigAbierta] = useState(false);
  const [bloqueElegido, setBloqueElegido] = useState<string | null>(null);
  const [pantalla, setPantalla] = useState<(typeof PANTALLAS)[number]["clave"]>(
    "escritorio"
  );

  /** El borrador local. Nada se envía hasta pulsar Guardar. */
  const [borrador, setBorrador] = useState<Plantilla | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState<Plantilla | null>(null);

  /** Las empresas contra las que se puede probar la plantilla. */
  const [negocios, setNegocios] = useState<NegocioBreve[]>([]);
  const [negocioPrueba, setNegocioPrueba] = useState<number | "">("");
  const [enlace, setEnlace] = useState<EnlaceDePrueba | null>(null);
  const [probando, setProbando] = useState(false);
  const [asignando, setAsignando] = useState(false);

  const origen = urlTienda();
  const composicion = borrador?.paginas[ruta] ?? [];
  const porCodigo = useMemo(
    () => new Map(catalogo.map((b) => [b.codigo, b])),
    [catalogo]
  );
  const bloqueActual = composicion.find((b) => b.id === bloqueElegido) ?? null;
  const definicionActual = bloqueActual ? porCodigo.get(bloqueActual.tipo) : undefined;

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
    setVistaIzquierda("estructura");
  }, []);

  const { marco, reiniciar } = usarPrevia({
    origen,
    composicion,
    armazon: borrador?.paginas["/_layout"] ?? [],
    tokens,
    variables,
    // Lo que la plantilla PROPONE como identidad. Sin esto la previa pintaba la
    // maqueta nueva con el color de la empresa de referencia, que es como
    // juzgar una plantilla de boutique en verde.
    marca: borrador?.marca ?? {},
    elegido: bloqueElegido,
    onSeleccion: alSeleccionar,
  });

  useEffect(() => {
    Promise.all([
      tienda.bloques(),
      tienda.plantillas(),
      tienda.tokens(),
      // Si falla, se sigue: el editor funciona sin poder probar en una empresa,
      // y quedarse sin editor por eso seria peor que quedarse sin la prueba.
      tienda.negocios().catch(() => [] as NegocioBreve[]),
    ])
      .then(([b, p, t, n]) => {
        setCatalogo(b);
        setPlantillas(p);
        setTokens(t);
        setNegocios(n);
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
    setVistaIzquierda("estructura");
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

  // Las mismas cuatro operaciones que antes vivian dentro de `Editor.tsx`,
  // ahora aqui porque las necesitan dos superficies distintas: la lista de la
  // izquierda y la barra flotante sobre el lienzo.
  function actualizarSeleccion(id: string, cambios: Partial<BloqueColocado>) {
    componer(actualizarBloque(composicion, id, cambios));
  }

  function agregarBloque(bloque: Bloque) {
    const nuevo = bloqueNuevo(bloque, composicion);
    componer([...composicion, nuevo]);
    setBloqueElegido(nuevo.id);
    setVistaIzquierda("estructura");
  }

  function duplicarSeleccion(id: string) {
    const siguiente = duplicarBloque(composicion, id);
    componer(siguiente);
    const i = siguiente.findIndex((b) => b.id === id);
    if (i >= 0 && siguiente[i + 1]) setBloqueElegido(siguiente[i + 1].id);
  }

  function quitarSeleccion(id: string) {
    componer(quitarBloque(composicion, id));
    if (bloqueElegido === id) setBloqueElegido(null);
  }

  function alternarVisibleSeleccion(id: string) {
    const bloque = composicion.find((b) => b.id === id);
    if (!bloque) return;
    const todosVisibles = bloque.visible.movil && bloque.visible.tablet && bloque.visible.escritorio;
    const valor = !todosVisibles;
    actualizarSeleccion(id, { visible: { movil: valor, tablet: valor, escritorio: valor } });
  }

  async function generarEnlace() {
    if (!borrador || negocioPrueba === "") return;
    setProbando(true);
    try {
      setEnlace(await tienda.enlaceDePrueba(borrador.id, negocioPrueba));
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setProbando(false);
    }
  }

  /**
   * Asignar es lo contrario de probar: esto SI escribe.
   *
   * Deja un borrador en cada ruta y le copia la identidad. No publica, asi que
   * los visitantes siguen viendo lo de antes hasta que alguien lo revise — que
   * es la unica forma de que rediseñar una tienda en marcha no sea un salto al
   * vacio.
   */
  async function asignar() {
    if (!borrador || negocioPrueba === "") return;
    const empresa = negocios.find((n) => n.id === negocioPrueba);
    setAsignando(true);
    try {
      const { paginas } = await tienda.aplicarPlantilla(
        negocioPrueba,
        borrador.slug,
        { aplicar_tema: true, publicar: false }
      );
      avisar(
        `«${borrador.nombre}» asignada a ${empresa?.nombre ?? "la empresa"}: ` +
          `${paginas.length} pagina(s) en borrador, sin publicar.`
      );
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setAsignando(false);
    }
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
          <button
            type="button"
            className="taller__volver"
            onClick={() => navegar("/")}
            title="Volver al panel"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="taller__migas">
            <select
              className="taller__miga"
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
            <span className="taller__miga-separador">/</span>
            <select
              className="taller__miga"
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
            >
              {RUTAS.map((r) => (
                <option key={r.ruta} value={r.ruta}>
                  {r.nombre} ({borrador?.paginas[r.ruta]?.length ?? 0})
                </option>
              ))}
            </select>
          </div>

          <Boton
            tamano="pequeno"
            variante="fantasma"
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
            <a className="btn btn--fantasma btn--pequeno" href={origen} target="_blank" rel="noreferrer">
              Vista previa
            </a>
          )}
          <button
            type="button"
            className="icono-boton"
            aria-label="Configuración de la plantilla"
            title="Ficha, probar y asignar"
            onClick={() => setConfigAbierta(true)}
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="icono-boton"
            aria-label="Eliminar plantilla"
            title={
              borrador?.es_predeterminada
                ? "Es la plantilla por defecto: no se puede eliminar"
                : "Eliminar plantilla"
            }
            disabled={borrador?.es_predeterminada}
            onClick={() => setBorrando(original)}
          >
            <Trash2 size={15} />
          </button>
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
        <aside className="taller__estructura">
          {vistaIzquierda === "estructura" && (
            <ListaEstructura
              catalogo={catalogo}
              composicion={composicion}
              elegido={bloqueElegido}
              onElegir={setBloqueElegido}
              onCambio={componer}
              onAgregarSeccion={() => setVistaIzquierda("catalogo")}
              onAbrirApariencia={() => {
                setVistaIzquierda("apariencia");
                setBloqueElegido(null);
              }}
            />
          )}

          {vistaIzquierda === "catalogo" && (
            <SelectorDeBloques
              catalogo={catalogo}
              composicion={composicion}
              onAgregar={agregarBloque}
              onVolver={() => setVistaIzquierda("estructura")}
            />
          )}

          {vistaIzquierda === "apariencia" && borrador && (
            <div className="apariencia-global">
              <button type="button" className="volver-link" onClick={() => setVistaIzquierda("estructura")}>
                <ArrowLeft size={14} />
                Estructura
              </button>
              <p className="constructor__titulo" style={{ marginTop: 10 }}>
                Apariencia global
              </p>
              <p className="tenue" style={{ marginBottom: 14 }}>
                Colores, tipografía, botones y más — afecta a toda la plantilla, sin editar
                sección por sección.
              </p>
              <PanelTema
                tokens={tokens}
                valores={valoresTema}
                onCambio={(valores) => setBorrador({ ...borrador, tema_valores: valores })}
              />
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
            <>
              {bloqueActual && (
                <BarraFlotante
                  nombre={definicionActual?.nombre ?? bloqueActual.tipo}
                  oculto={
                    !(
                      bloqueActual.visible.movil &&
                      bloqueActual.visible.tablet &&
                      bloqueActual.visible.escritorio
                    )
                  }
                  indice={composicion.findIndex((b) => b.id === bloqueActual.id)}
                  total={composicion.length}
                  duplicarDeshabilitado={definicionActual?.unico_por_pagina}
                  onSubir={() =>
                    componer(
                      mover(
                        composicion,
                        composicion.findIndex((b) => b.id === bloqueActual.id),
                        composicion.findIndex((b) => b.id === bloqueActual.id) - 1
                      )
                    )
                  }
                  onBajar={() =>
                    componer(
                      mover(
                        composicion,
                        composicion.findIndex((b) => b.id === bloqueActual.id),
                        composicion.findIndex((b) => b.id === bloqueActual.id) + 1
                      )
                    )
                  }
                  onDuplicar={() => duplicarSeleccion(bloqueActual.id)}
                  onAlternarVisible={() => alternarVisibleSeleccion(bloqueActual.id)}
                  onQuitar={() => quitarSeleccion(bloqueActual.id)}
                  onCerrar={() => setBloqueElegido(null)}
                />
              )}
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
            </>
          )}
        </main>

        <PanelAjustesBloque
          bloque={bloqueActual}
          definicion={definicionActual}
          tokens={tokens}
          onActualizar={actualizarSeleccion}
          onQuitar={quitarSeleccion}
        />
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

      {configAbierta && borrador && (
        <PlantillaConfiguracion
          borrador={borrador}
          onCambiar={setBorrador}
          negocios={negocios}
          negocioPrueba={negocioPrueba}
          onCambiarNegocioPrueba={(v) => {
            setNegocioPrueba(v);
            setEnlace(null);
          }}
          enlace={enlace}
          probando={probando}
          asignando={asignando}
          cambiado={cambiado}
          onGenerarEnlace={() => void generarEnlace()}
          onAsignar={() => void asignar()}
          onCopiarEnlace={() => {
            if (!enlace) return;
            void navigator.clipboard?.writeText(enlace.url);
            avisar("Enlace copiado.");
          }}
          onCerrar={() => setConfigAbierta(false)}
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
