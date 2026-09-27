/**
 * Las páginas de la tienda y sus secciones, sin la vista previa.
 *
 * Es el MISMO borrador que edita «Páginas y secciones»: las dos pantallas
 * leen y guardan `/content/paginas/<id>/borrador/`, así que un cambio hecho
 * aquí aparece allá y al revés. No hay una segunda copia que sincronizar —
 * duplicar los textos en `SiteConfig` es justo lo que dejó huérfanos a los
 * viejos «Textos del Home».
 *
 * La lista, el catálogo para añadir y el formulario de cada sección son los
 * del constructor (`PanelSecciones`): lo que cambia es que aquí ocupan el
 * ancho de la pestaña en vez de una columna al lado de la previa.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, LayoutTemplate, Save, Upload } from "lucide-react";
import {
  tienda,
  type Bloque,
  type Composicion,
  type PaginaTienda,
  type TokenTema,
} from "../../api/tienda";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito, confirmarAccion } from "../../utils/alertas";
import { PanelSecciones } from "../tienda/PanelSecciones";
import "../tienda/TiendaPage.css";

export function PaginasTab() {
  const [catalogo, setCatalogo] = useState<Bloque[]>([]);
  const [tokens, setTokens] = useState<TokenTema[]>([]);
  const [paginas, setPaginas] = useState<PaginaTienda[]>([]);
  const [pagina, setPagina] = useState<PaginaTienda | null>(null);
  const [composicion, setComposicion] = useState<Composicion>([]);
  const [guardado, setGuardado] = useState<Composicion>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

  const sinGuardar = JSON.stringify(composicion) !== JSON.stringify(guardado);

  const abrir = useCallback(async (elegida: PaginaTienda) => {
    setPagina(elegida);
    setElegido(null);
    try {
      const version = await tienda.borrador(elegida.id);
      setComposicion(version.composicion);
      setGuardado(version.composicion);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo abrir el borrador."));
    }
  }, []);

  useEffect(() => {
    Promise.all([tienda.catalogo(), tienda.tokens(), tienda.paginas()])
      .then(([bloques, catalogoTema, lista]) => {
        setCatalogo(bloques);
        setTokens(catalogoTema);
        setPaginas(lista);
        const inicial = lista.find((p) => p.ruta === "/") ?? lista[0] ?? null;
        if (inicial) void abrir(inicial);
      })
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudieron cargar las páginas.")))
      .finally(() => setCargando(false));
  }, [abrir]);

  // Si alguien guardó desde el constructor en otra pestaña del navegador, al
  // volver aquí se trae ese borrador — salvo que haya cambios sin guardar,
  // que no se pisan sin preguntar.
  useEffect(() => {
    function alVolver() {
      if (document.visibilityState !== "visible" || !pagina || sinGuardar) return;
      tienda
        .borrador(pagina.id)
        .then((version) => {
          setComposicion(version.composicion);
          setGuardado(version.composicion);
        })
        .catch(() => undefined);
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [pagina, sinGuardar]);

  async function cambiarPagina(id: number) {
    const elegida = paginas.find((p) => p.id === id);
    if (!elegida) return;
    if (
      sinGuardar &&
      !(await confirmarAccion(
        "¿Descartar los cambios?",
        `Tienes cambios sin guardar en «${pagina?.titulo}».`,
        "Descartar"
      ))
    ) {
      return;
    }
    void abrir(elegida);
  }

  async function guardar(): Promise<boolean> {
    if (!pagina) return false;
    setTrabajando(true);
    try {
      const version = await tienda.guardarBorrador(pagina.id, composicion);
      setComposicion(version.composicion);
      setGuardado(version.composicion);
      setPaginas(await tienda.paginas());
      return true;
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar."));
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  async function publicar() {
    if (!pagina) return;
    const ok = await confirmarAccion(
      "¿Publicar los cambios?",
      `Tus clientes verán «${pagina.titulo}» con estas secciones.`,
      "Publicar"
    );
    if (!ok) return;
    if (sinGuardar && !(await guardar())) return;

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

  if (cargando) return <div className="vacio">Cargando…</div>;

  if (paginas.length === 0) {
    return <div className="panel vacio">Tu tienda todavía no tiene páginas.</div>;
  }

  const origen = import.meta.env.VITE_TIENDA_URL
    ? String(import.meta.env.VITE_TIENDA_URL).replace(/\/+$/, "")
    : null;

  return (
    <div className="panel paginas-tab">
      <div className="paginas-tab-barra">
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor="paginas-tab-pagina">Página</label>
          <select
            id="paginas-tab-pagina"
            value={pagina?.id ?? ""}
            onChange={(e) => void cambiarPagina(Number(e.target.value))}
          >
            {paginas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.ruta}){p.tiene_borrador ? " · borrador sin publicar" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="paginas-tab-acciones">
          <span className={`editor-estado ${sinGuardar ? "pendiente" : ""}`}>
            {sinGuardar ? "Sin guardar" : "Todo guardado"}
          </span>
          {pagina && (
            <Link className="btn secundario" to={`/tienda?pagina=${pagina.id}`} title="Editar con vista previa">
              <LayoutTemplate size={15} /> Ver en el constructor
            </Link>
          )}
          {origen && pagina && (
            <a
              className="btn-icon"
              href={`${origen}${pagina.ruta}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir la página publicada"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <button
            type="button"
            className="btn secundario"
            onClick={() => void guardar()}
            disabled={!sinGuardar || trabajando}
          >
            <Save size={15} /> Guardar borrador
          </button>
          <button type="button" className="btn primario" onClick={publicar} disabled={trabajando}>
            <Upload size={15} /> Publicar
          </button>
        </div>
      </div>

      <p className="form-nota" style={{ margin: ".2rem 0 1rem" }}>
        Es el mismo borrador de «Páginas y secciones»: lo que cambies aquí se ve allá, y
        nada llega a tus clientes hasta que pulses Publicar. Las secciones que muestran
        banners, anuncios, beneficios o testimonios se llenan con las otras pestañas de
        esta configuración.
      </p>

      <div className="paginas-tab-editor">
        <PanelSecciones
          catalogo={catalogo}
          tokens={tokens}
          composicion={composicion}
          elegido={elegido}
          onCambio={setComposicion}
          onElegir={setElegido}
        />
      </div>
    </div>
  );
}
