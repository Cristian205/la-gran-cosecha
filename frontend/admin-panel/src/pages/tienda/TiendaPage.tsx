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
 */
import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  History,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
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
import { alertaError, alertaExito, confirmarAccion } from "../../utils/alertas";
import { PanelSecciones } from "./PanelSecciones";
import { PanelTema } from "./PanelTema";
import { usarPrevia } from "./usarPrevia";
import "./TiendaPage.css";

/** Los anchos de la previa. Coinciden con los cortes del CSS de la tienda. */
const PANTALLAS = [
  { clave: "escritorio", icono: Monitor, nombre: "Escritorio", ancho: "100%" },
  { clave: "tablet", icono: Tablet, nombre: "Tablet", ancho: "834px" },
  { clave: "movil", icono: Smartphone, nombre: "Móvil", ancho: "390px" },
] as const;

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

export function TiendaPage() {
  const [catalogo, setCatalogo] = useState<Bloque[]>([]);
  const [paginas, setPaginas] = useState<PaginaTienda[]>([]);
  const [pagina, setPagina] = useState<PaginaTienda | null>(null);
  const [composicion, setComposicion] = useState<Composicion>([]);
  const [guardado, setGuardado] = useState<Composicion>([]);
  const [elegido, setElegido] = useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [pantalla, setPantalla] = useState<(typeof PANTALLAS)[number]["clave"]>(
    "escritorio"
  );
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
  const [tema, setTema] = useState<Record<string, string>>({});
  const [temaGuardado, setTemaGuardado] = useState<Record<string, string>>({});

  const origen = urlTienda();
  // Memorizado porque el hook lo tiene como dependencia: sin esto, cada
  // repintado volvería a suscribir el `message` y se perderían mensajes.
  const alSeleccionar = useCallback((id: string) => setElegido(id), []);
  const { marco, reiniciar } = usarPrevia({
    origen,
    composicion,
    elegido,
    onSeleccion: alSeleccionar,
  });

  const abrir = useCallback(
    async (elegida: PaginaTienda) => {
      setPagina(elegida);
      setHistorial(null);
      setElegido(null);
      reiniciar();
      try {
        const version = await tienda.borrador(elegida.id);
        setComposicion(version.composicion);
        setGuardado(version.composicion);
      } catch (e) {
        alertaError(extraerMensajeError(e, "No se pudo abrir el borrador."));
      }
    },
    [reiniciar]
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
        setTema(valores);
        setTemaGuardado(valores);
        const inicial = lista.find((p) => p.ruta === "/") ?? lista[0] ?? null;
        if (inicial) void abrir(inicial);
      })
      .catch((e) => alertaError(extraerMensajeError(e, "No se pudo cargar tu tienda.")))
      .finally(() => setCargando(false));
    // Solo al montar: `abrir` se encarga del resto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sinGuardar =
    pestana === "apariencia"
      ? JSON.stringify(tema) !== JSON.stringify(temaGuardado)
      : JSON.stringify(composicion) !== JSON.stringify(guardado);

  async function guardar(): Promise<boolean> {
    if (pestana === "apariencia") return guardarTema();
    if (!pagina) return false;
    setTrabajando(true);
    try {
      const version = await tienda.guardarBorrador(pagina.id, composicion);
      setComposicion(version.composicion);
      setGuardado(version.composicion);
      return true;
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar."));
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  /**
   * El tema se aplica en el momento, sin publicar.
   *
   * No es un descuido: la apariencia no tiene borrador porque no hay una
   * version de ella que un visitante pueda estar viendo mientras se edita. Es
   * la configuracion del negocio, como su logo o su telefono.
   */
  async function guardarTema(): Promise<boolean> {
    setTrabajando(true);
    try {
      await tienda.guardarTema(tema);
      setTemaGuardado(tema);
      reiniciar();
      return true;
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo guardar la apariencia."));
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
      "¿Publicar los cambios?",
      "Tus clientes verán esta página tal como está en la vista previa.",
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
      setComposicion(nuevo.composicion);
      setGuardado(nuevo.composicion);
      setElegido(null);
      setHistorial(null);
      alertaExito(`Versión ${version.numero} recuperada en tu borrador.`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo recuperar."));
    }
  }

  if (cargando) {
    return (
      <div className="editor-cargando">
        <p className="campo-ayuda">Cargando tu tienda…</p>
      </div>
    );
  }

  return (
    <div className="editor">
      <header className="editor-barra">
        <div className="editor-barra-izq">
          <strong>Tu tienda</strong>
          <select
            value={pagina?.id ?? ""}
            onChange={(e) => {
              const elegida = paginas.find((p) => p.id === Number(e.target.value));
              if (elegida) void abrir(elegida);
            }}
          >
            {paginas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
                {p.tiene_borrador ? " ·" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="editor-pantallas">
          {PANTALLAS.map(({ clave, icono: Icono, nombre }) => (
            <button
              key={clave}
              type="button"
              className={`btn-icon ${pantalla === clave ? "activo" : ""}`}
              aria-label={nombre}
              aria-pressed={pantalla === clave}
              title={nombre}
              onClick={() => setPantalla(clave)}
            >
              <Icono size={15} />
            </button>
          ))}
        </div>

        <div className="editor-barra-der">
          <span className={`editor-estado ${sinGuardar ? "pendiente" : ""}`}>
            {sinGuardar ? "Sin guardar" : "Todo guardado"}
          </span>
          <button
            type="button"
            className="btn secundario"
            onClick={() => pagina && tienda.versiones(pagina.id).then(setHistorial)}
            disabled={!pagina}
          >
            <History size={15} /> Historial
          </button>
          {origen && pagina && (
            <a
              className="btn-icon"
              href={`${origen}${pagina.ruta}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir la tienda publicada"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <button
            type="button"
            className="btn secundario"
            onClick={guardar}
            disabled={!sinGuardar || trabajando}
          >
            <Save size={15} /> Guardar
          </button>
          <button
            type="button"
            className="btn primario"
            onClick={publicar}
            disabled={trabajando}
          >
            <Upload size={15} /> Publicar
          </button>
        </div>
      </header>

      <div className="editor-cuerpo">
        <aside className="editor-panel">
          <div className="segmentado editor-pestanas">
            <button
              type="button"
              className={pestana === "secciones" ? "activo" : ""}
              onClick={() => setPestana("secciones")}
            >
              Secciones
            </button>
            <button
              type="button"
              className={pestana === "apariencia" ? "activo" : ""}
              onClick={() => setPestana("apariencia")}
            >
              Apariencia
            </button>
          </div>

          {pestana === "secciones" ? (
            <PanelSecciones
              catalogo={catalogo}
              composicion={composicion}
              elegido={elegido}
              onCambio={setComposicion}
              onElegir={setElegido}
            />
          ) : (
            <PanelTema catalogo={tokens} valores={tema} onCambio={setTema} />
          )}
        </aside>

        <main className="editor-previa">
          {!origen ? (
            <p className="campo-ayuda editor-sin-url">
              Falta configurar la dirección de tu tienda. Añade{" "}
              <code>VITE_TIENDA_URL</code> al entorno del panel (en desarrollo,{" "}
              <code>http://localhost:5175</code>) y recarga.
            </p>
          ) : (
            pagina && (
              <div
                className="editor-marco"
                style={{ width: PANTALLAS.find((p) => p.clave === pantalla)!.ancho }}
              >
                <iframe
                  ref={marco}
                  // La clave incluye la página, no la composición: recargar en
                  // cada cambio es justo lo que este editor evita.
                  key={pagina.id}
                  title="Tu tienda"
                  src={`${origen}${pagina.ruta}?editor=1`}
                />
              </div>
            )
          )}
        </main>
      </div>

      {historial && (
        <div className="editor-velo" onClick={() => setHistorial(null)}>
          <div className="editor-historial" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Historial de {pagina?.titulo}</h3>
              <button
                type="button"
                className="btn secundario"
                onClick={() => setHistorial(null)}
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
