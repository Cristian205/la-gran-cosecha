/**
 * El constructor de la tienda.
 *
 * La vista previa es la pantalla, no un extra: ocupa lo que queda tras una
 * columna de ajustes, y se actualiza al instante — sin guardar y sin recargar.
 * Guardar vuelve a ser lo que debe ser, decidir que esto quede, en vez del paso
 * obligatorio para poder mirar lo que estás haciendo.
 *
 * Lo que se edita es un BORRADOR y publicar es aparte. Esa separación permite
 * dejar la página a medias, cerrar sesión y volver mañana sin que ningún
 * visitante haya visto el desorden.
 *
 * # Cambios seguros
 *
 * Todo lo que se toca se puede deshacer (Ctrl+Z) y rehacer (Ctrl+Shift+Z),
 * guardar como borrador (Ctrl+S) o publicar —lo único que se confirma, porque
 * es lo único que ve un cliente—. Con cambios sin guardar, salir del editor
 * (cerrar la pestaña, recargar, otra página del panel u otra página de la
 * tienda) pide confirmación.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import {
  tienda,
  type Bloque,
  type Composicion,
  type PaginaTienda,
  type VersionPagina,
  type TokenTema,
} from "../../api/tienda";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarAccion, confirmarDescartar } from "../../utils/alertas";
import { DISPOSITIVOS, dispositivo, type ClaveDispositivo } from "./dispositivos";
import { PanelSecciones } from "./PanelSecciones";
import { PanelTema } from "./PanelTema";
import { usarHistorial } from "./usarHistorial";
import { usarPrevia } from "./usarPrevia";
import "./TiendaPage.css";

/** «Ajustar» encaja la pantalla en el hueco; el resto es un zoom fijo. */
const ZOOMS = [
  { valor: "ajustar", nombre: "Ajustar" },
  { valor: "0.5", nombre: "50 %" },
  { valor: "0.75", nombre: "75 %" },
  { valor: "1", nombre: "100 %" },
  { valor: "1.25", nombre: "125 %" },
  { valor: "1.5", nombre: "150 %" },
] as const;

/** El aire alrededor del marco de la previa, en px. */
const MARGEN_PREVIA = 32;

/**
 * La dirección de la tienda de este negocio.
 *
 * Devuelve null si no está configurada, y la pantalla lo dice. Caer al mismo
 * origen «por si comparten proxy» enmarcaba el propio panel dentro de la vista
 * previa: una pantalla que se contiene a sí misma desconcierta más que un aviso.
 */
function urlTienda(): string | null {
  const bruta = import.meta.env.VITE_TIENDA_URL;
  if (!bruta) return null;
  return String(bruta).replace(/\/+$/, "");
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const hora = (fecha: Date) =>
  fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

export function TiendaPage() {
  const navigate = useNavigate();
  const [catalogo, setCatalogo] = useState<Bloque[]>([]);
  const [paginas, setPaginas] = useState<PaginaTienda[]>([]);
  const [pagina, setPagina] = useState<PaginaTienda | null>(null);
  const comp = usarHistorial<Composicion>([]);
  const composicion = comp.valor;
  const [guardado, setGuardado] = useState<Composicion>([]);
  const [elegido, setElegido] = useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);
  const [pantalla, setPantalla] = useState<ClaveDispositivo>("escritorio");
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]["valor"]>("ajustar");
  const [ampliado, setAmpliado] = useState(false);
  const [historial, setHistorial] = useState<VersionPagina[] | null>(null);

  /**
   * La apariencia vive aparte de la composicion, y por eso tiene su propio
   * guardado: los bloques van a una VERSION de la pagina —con borrador,
   * publicada e historial— y el tema va a la configuracion del negocio, que no
   * tiene versiones porque vale para toda la tienda a la vez.
   *
   * Mezclarlos habria obligado a publicar una pagina para cambiar un color.
   */
  const [pestana, setPestana] = useState<"secciones" | "apariencia">("secciones");
  const [tokens, setTokens] = useState<TokenTema[]>([]);
  const temaH = usarHistorial<Record<string, string>>({});
  const tema = temaH.valor;
  const [temaGuardado, setTemaGuardado] = useState<Record<string, string>>({});

  const origen = urlTienda();
  // Memorizado porque el hook lo tiene como dependencia: sin esto, cada
  // repintado volvería a suscribir el `message` y se perderían mensajes.
  const alSeleccionar = useCallback((id: string) => setElegido(id), []);
  const { marco, lista, reiniciar } = usarPrevia({
    origen,
    composicion,
    tokens,
    elegido,
    onSeleccion: alSeleccionar,
  });

  const sinGuardarSecciones = !igual(composicion, guardado);
  const sinGuardarTema = !igual(tema, temaGuardado);
  const sinGuardar = sinGuardarSecciones || sinGuardarTema;
  // Deshacer actúa sobre lo que se está viendo: la página o la apariencia.
  const activo = pestana === "apariencia" ? temaH : comp;

  const abrir = useCallback(
    async (elegida: PaginaTienda) => {
      setPagina(elegida);
      setHistorial(null);
      setElegido(null);
      setErrorGuardado(false);
      reiniciar();
      try {
        const version = await tienda.borrador(elegida.id);
        comp.reiniciar(version.composicion);
        setGuardado(version.composicion);
      } catch (e) {
        alertaError(extraerMensajeError(e, "No se pudo abrir el borrador."));
      }
    },
    [reiniciar, comp.reiniciar] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    Promise.all([
      tienda.catalogo(),
      tienda.paginas(),
      tienda.tokens(),
      tienda.valoresDeTema(),
    ])
      .then(([bloques, lista, catalogoTema, valores]) => {
        setCatalogo(bloques);
        setPaginas(lista);
        setTokens(catalogoTema);
        temaH.reiniciar(valores);
        setTemaGuardado(valores);
        // `?pagina=<id>` llega desde la pestaña «Páginas» de Configuración,
        // para seguir editando la misma página con la vista previa.
        const pedida = Number(new URLSearchParams(window.location.search).get("pagina"));
        const inicial =
          lista.find((p) => p.id === pedida) ??
          lista.find((p) => p.ruta === "/") ??
          lista[0] ??
          null;
        if (inicial) void abrir(inicial);
      })
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudo cargar tu tienda.")))
      .finally(() => setCargando(false));
    // Solo al montar: `abrir` se encarga del resto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Guarda lo que haya cambiado —la página, la apariencia o las dos—. */
  async function guardar(): Promise<boolean> {
    if (!sinGuardar) return true;
    setTrabajando(true);
    setErrorGuardado(false);
    try {
      if (sinGuardarSecciones && pagina) {
        const version = await tienda.guardarBorrador(pagina.id, composicion);
        setGuardado(version.composicion);
        // Lo que devuelve el servidor es la versión normalizada; si difiere de
        // lo que hay en pantalla (un id corregido), se adopta sin perder la
        // posibilidad de deshacer lo anterior.
        if (!igual(version.composicion, composicion)) comp.fijar(version.composicion);
        setPagina((p) => (p ? { ...p, tiene_borrador: true } : p));
      }
      if (sinGuardarTema) {
        // El tema se aplica en el momento, sin publicar: no hay una versión de
        // él que un visitante pueda estar viendo mientras se edita.
        await tienda.guardarTema(tema);
        setTemaGuardado(tema);
        reiniciar();
      }
      setUltimoGuardado(new Date());
      return true;
    } catch (e) {
      setErrorGuardado(true);
      alertaError(extraerMensajeError(e, "No se pudo guardar. Tus cambios siguen aquí: inténtalo de nuevo."));
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  async function publicar() {
    if (!pagina) return;
    // Publicar es lo único de esta pantalla que cambia lo que ve un visitante,
    // así que es lo único que se confirma.
    const ok = await confirmarAccion(
      `¿Publicar «${pagina.titulo}»?`,
      sinGuardar
        ? "Primero se guarda tu borrador. Después, tus clientes verán esta página tal como está en la vista previa."
        : "Tus clientes verán esta página tal como está en la vista previa.",
      "Publicar"
    );
    if (!ok) return;

    if (!(await guardar())) return;

    setTrabajando(true);
    try {
      await tienda.publicar(pagina.id);
      const lista = await tienda.paginas();
      setPaginas(lista);
      setPagina(lista.find((p) => p.id === pagina.id) ?? pagina);
      alertaExito("Publicado. Ya está en tu tienda.");
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo publicar."));
    } finally {
      setTrabajando(false);
    }
  }

  async function restaurar(version: VersionPagina) {
    if (!pagina) return;
    const ok = await confirmarAccion(
      `¿Recuperar la versión ${version.numero}?`,
      "Se copia a tu borrador. Tu tienda publicada no cambia hasta que pulses Publicar.",
      "Recuperar"
    );
    if (!ok) return;

    try {
      const nuevo = await tienda.restaurar(pagina.id, version.numero);
      comp.reiniciar(nuevo.composicion);
      setGuardado(nuevo.composicion);
      setElegido(null);
      setHistorial(null);
      alertaExito(`Versión ${version.numero} recuperada en tu borrador.`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo recuperar."));
    }
  }

  async function cambiarDePagina(elegida: PaginaTienda) {
    if (sinGuardarSecciones && !(await confirmarDescartar("Si cambias de página ahora, se perderán los cambios de esta que no guardaste."))) {
      return;
    }
    void abrir(elegida);
  }

  async function salir() {
    if (sinGuardar && !(await confirmarDescartar("Si sales del editor ahora, se perderán los cambios que no guardaste."))) {
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  // --- Atajos de teclado. Por referencia para no resuscribir en cada letra.
  const atajos = useRef({ guardar, deshacer: activo.deshacer, rehacer: activo.rehacer });
  atajos.current = { guardar, deshacer: activo.deshacer, rehacer: activo.rehacer };
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape" && ampliado) {
        setAmpliado(false);
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey) {
        e.preventDefault();
        atajos.current.deshacer();
      } else if ((tecla === "z" && e.shiftKey) || tecla === "y") {
        e.preventDefault();
        atajos.current.rehacer();
      } else if (tecla === "s") {
        e.preventDefault();
        void atajos.current.guardar();
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ampliado]);

  // --- Salir con cambios pendientes: cerrar, recargar o ir a otra pantalla.
  useEffect(() => {
    if (!sinGuardar) return;
    function antesDeSalir(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    // Los enlaces internos del panel no recargan, así que `beforeunload` no
    // los ve: se interceptan aquí y se confirma antes de navegar.
    function alPulsar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace || enlace.target === "_blank" || enlace.hasAttribute("download")) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin || destino.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmarDescartar("Si sales del editor ahora, se perderán los cambios que no guardaste.").then((ok) => {
        if (ok) navigate(destino.pathname + destino.search + destino.hash);
      });
    }
    window.addEventListener("beforeunload", antesDeSalir);
    document.addEventListener("click", alPulsar, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSalir);
      document.removeEventListener("click", alPulsar, true);
    };
  }, [sinGuardar, navigate]);

  // --- El hueco de la previa, para encajar la pantalla elegida en él.
  const area = useRef<HTMLElement>(null);
  const [hueco, setHueco] = useState({ ancho: 0, alto: 0 });
  useLayoutEffect(() => {
    const nodo = area.current;
    if (!nodo) return;
    const medir = () => setHueco({ ancho: nodo.clientWidth, alto: nodo.clientHeight });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [cargando, origen]);

  const disp = dispositivo(pantalla);
  const libreAncho = Math.max(0, hueco.ancho - MARGEN_PREVIA);
  const libreAlto = Math.max(0, hueco.alto - MARGEN_PREVIA);
  const medido = libreAncho > 0 && libreAlto > 0;
  let ancho: number = disp.ancho;
  let alto: number = disp.alto;
  let escala = zoom === "ajustar" ? 1 : Number(zoom);
  if (pantalla === "escritorio") {
    // El escritorio no tiene alto propio: llena el hueco. En «Ajustar», además,
    // usa el ancho real si cabe más de 1280 px, y si no se reduce a escala
    // —nunca se estrecha, que pintaría la tienda en su versión de tablet.
    if (zoom === "ajustar") {
      ancho = Math.max(1280, libreAncho);
      escala = medido ? Math.min(1, libreAncho / ancho) : 1;
    }
    alto = medido ? Math.max(560, libreAlto / escala) : disp.alto;
  } else if (zoom === "ajustar" && medido) {
    escala = Math.min(1, libreAncho / ancho, libreAlto / alto);
  }

  if (cargando) {
    return (
      <div className="editor-cargando" role="status">
        <Loader2 size={20} className="girando" aria-hidden="true" />
        <p className="campo-ayuda">Cargando tu tienda…</p>
      </div>
    );
  }

  return (
    <div className={`editor ${ampliado ? "editor--ampliado" : ""}`}>
      <header className="editor-barra">
        <div className="editor-barra-izq">
          <button type="button" className="btn-icon" onClick={salir} title="Salir del editor" aria-label="Salir del editor">
            <ArrowLeft size={15} />
          </button>
          <strong className="editor-nombre">Tu tienda</strong>
          <select
            aria-label="Página que editas"
            value={pagina?.id ?? ""}
            onChange={(e) => {
              const elegida = paginas.find((p) => p.id === Number(e.target.value));
              if (elegida) void cambiarDePagina(elegida);
            }}
          >
            {paginas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
                {p.tiene_borrador ? " ·" : ""}
              </option>
            ))}
          </select>
          <div className="editor-deshacer" role="group" aria-label="Deshacer y rehacer">
            <button
              type="button"
              className="btn-icon"
              onClick={activo.deshacer}
              disabled={!activo.puedeDeshacer}
              title="Deshacer (Ctrl+Z)"
              aria-label="Deshacer"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={activo.rehacer}
              disabled={!activo.puedeRehacer}
              title="Rehacer (Ctrl+Shift+Z)"
              aria-label="Rehacer"
            >
              <Redo2 size={15} />
            </button>
          </div>
        </div>

        <div className="editor-vista">
          <div className="editor-pantallas" role="radiogroup" aria-label="Pantalla de la vista previa">
            {DISPOSITIVOS.map(({ clave, icono: Icono, nombre, ancho: a, alto: h }) => (
              <button
                key={clave}
                type="button"
                role="radio"
                className={`btn-icon ${pantalla === clave ? "activo" : ""}`}
                aria-label={nombre}
                aria-checked={pantalla === clave}
                title={clave === "escritorio" ? nombre : `${nombre} · ${a} × ${h}`}
                onClick={() => setPantalla(clave)}
              >
                <Icono size={15} />
              </button>
            ))}
          </div>
          <select
            className="editor-zoom"
            aria-label="Tamaño de la vista previa"
            value={zoom}
            onChange={(e) => setZoom(e.target.value as typeof zoom)}
          >
            {ZOOMS.map((z) => (
              <option key={z.valor} value={z.valor}>
                {z.valor === "ajustar" && medido ? `Ajustar (${Math.round(escala * 100)} %)` : z.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn-icon ${ampliado ? "activo" : ""}`}
            onClick={() => setAmpliado((v) => !v)}
            aria-pressed={ampliado}
            title={ampliado ? "Volver al panel (Esc)" : "Ampliar la vista previa"}
            aria-label={ampliado ? "Volver al panel" : "Ampliar la vista previa"}
          >
            {ampliado ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>

        <div className="editor-barra-der">
          <EstadoGuardado
            trabajando={trabajando}
            error={errorGuardado}
            sinGuardar={sinGuardar}
            ultimo={ultimoGuardado}
            sinPublicar={Boolean(pagina?.tiene_borrador)}
            onReintentar={() => void guardar()}
          />
          <button
            type="button"
            className="btn secundario"
            onClick={() => pagina && tienda.versiones(pagina.id).then(setHistorial)}
            disabled={!pagina}
            title="Versiones anteriores de esta página"
          >
            <History size={15} /> <span className="editor-texto-boton">Historial</span>
          </button>
          {origen && pagina && (
            <a
              className="btn-icon"
              href={`${origen}${pagina.ruta}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir la tienda publicada"
              aria-label="Abrir la tienda publicada en otra pestaña"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <button
            type="button"
            className="btn secundario"
            onClick={() => void guardar()}
            disabled={!sinGuardar || trabajando}
            title="Guardar borrador (Ctrl+S). Tus clientes no lo ven hasta publicar."
          >
            <Save size={15} /> <span className="editor-texto-boton">Guardar borrador</span>
          </button>
          <button
            type="button"
            className="btn primario"
            onClick={publicar}
            disabled={trabajando || !pagina}
          >
            <Upload size={15} /> Publicar
          </button>
        </div>
      </header>

      <div className="editor-cuerpo">
        <aside className="editor-panel" aria-label="Ajustes de la página">
          <div className="segmentado editor-pestanas" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "secciones"}
              className={pestana === "secciones" ? "activo" : ""}
              onClick={() => setPestana("secciones")}
            >
              Secciones
              {sinGuardarSecciones && <span className="editor-punto" aria-label="(sin guardar)" />}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "apariencia"}
              className={pestana === "apariencia" ? "activo" : ""}
              onClick={() => setPestana("apariencia")}
            >
              Apariencia
              {sinGuardarTema && <span className="editor-punto" aria-label="(sin guardar)" />}
            </button>
          </div>

          {pestana === "secciones" ? (
            <PanelSecciones
              catalogo={catalogo}
              tokens={tokens}
              composicion={composicion}
              elegido={elegido}
              onCambio={comp.fijar}
              onElegir={setElegido}
              pantalla={pantalla}
              onPantalla={setPantalla}
            />
          ) : (
            <PanelTema catalogo={tokens} valores={tema} onCambio={temaH.fijar} />
          )}
        </aside>

        <main className="editor-previa" ref={area} aria-label="Vista previa">
          {!origen ? (
            <p className="campo-ayuda editor-sin-url">
              Falta configurar la dirección de tu tienda. Añade{" "}
              <code>VITE_TIENDA_URL</code> al entorno del panel (en desarrollo,{" "}
              <code>http://localhost:5175</code>) y recarga.
            </p>
          ) : (
            pagina && (
              <div
                className={`editor-lienzo editor-lienzo--${pantalla}`}
                style={{ width: ancho * escala, height: alto * escala }}
              >
                <div
                  className="editor-marco"
                  style={{ width: ancho, height: alto, transform: `scale(${escala})` }}
                >
                  <iframe
                    ref={marco}
                    // La clave incluye la página, no la composición: recargar en
                    // cada cambio es justo lo que este editor evita.
                    key={pagina.id}
                    title="Vista previa de tu tienda"
                    src={`${origen}${pagina.ruta}?editor=1`}
                  />
                </div>
                {!lista && (
                  <div className="editor-previa-cargando" role="status">
                    <Loader2 size={18} className="girando" aria-hidden="true" /> Cargando la vista previa…
                  </div>
                )}
              </div>
            )
          )}
          {origen && pagina && pantalla !== "escritorio" && (
            <p className="editor-medida" aria-live="polite">
              {disp.nombre} · {disp.ancho} × {disp.alto}
            </p>
          )}
        </main>
      </div>

      {historial && (
        <div className="editor-velo" onClick={() => setHistorial(null)}>
          <div
            className="editor-historial"
            role="dialog"
            aria-modal="true"
            aria-label={`Historial de ${pagina?.titulo ?? "la página"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h3>Historial de {pagina?.titulo}</h3>
              <button
                type="button"
                className="btn secundario"
                onClick={() => setHistorial(null)}
                autoFocus
              >
                Cerrar
              </button>
            </header>
            <ul>
              {historial.map((v) => (
                <li key={v.id}>
                  <span>
                    <strong>Versión {v.numero}</strong>
                    <span className={`badge ${v.estado}`}>{v.estado.toLowerCase()}</span>
                  </span>
                  <span className="campo-ayuda" style={{ margin: 0 }}>
                    {v.composicion.length} secciones
                    {v.autor_nombre && ` · ${v.autor_nombre}`}
                    {v.nota && ` · ${v.nota}`}
                  </span>
                  <button
                    type="button"
                    className="btn secundario"
                    disabled={v.estado === "BORRADOR"}
                    onClick={() => restaurar(v)}
                  >
                    <RotateCcw size={14} /> Recuperar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dónde está lo que se edita: guardándose, con error, sin guardar o guardado.
 * Se anuncia a los lectores de pantalla (`aria-live`) porque guardar no mueve
 * el foco y, sin esto, no sabrían si funcionó.
 */
function EstadoGuardado({
  trabajando,
  error,
  sinGuardar,
  ultimo,
  sinPublicar,
  onReintentar,
}: {
  trabajando: boolean;
  error: boolean;
  sinGuardar: boolean;
  ultimo: Date | null;
  sinPublicar: boolean;
  onReintentar: () => void;
}) {
  let contenido;
  if (trabajando) {
    contenido = (
      <span className="editor-estado">
        <Loader2 size={14} className="girando" aria-hidden="true" /> Guardando…
      </span>
    );
  } else if (error && sinGuardar) {
    contenido = (
      <button type="button" className="editor-estado error" onClick={onReintentar} title="Reintentar">
        <AlertCircle size={14} aria-hidden="true" /> No se guardó · reintentar
      </button>
    );
  } else if (sinGuardar) {
    contenido = (
      <span className="editor-estado pendiente">
        <span className="editor-punto" aria-hidden="true" /> Cambios sin guardar
      </span>
    );
  } else {
    contenido = (
      <span className="editor-estado ok" title={sinPublicar ? "El borrador tiene cambios que tus clientes aún no ven." : undefined}>
        <CheckCircle2 size={14} aria-hidden="true" />
        {ultimo ? `Guardado ${hora(ultimo)}` : "Todo guardado"}
        {sinPublicar && <span className="editor-sin-publicar">· sin publicar</span>}
      </span>
    );
  }
  return (
    <span className="editor-estado-caja" aria-live="polite">
      {contenido}
    </span>
  );
}
