import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, LayoutTemplate, Paintbrush } from "lucide-react";
import { FUENTES, RADIOS_BOTON, pilaFuente, radioPx } from "../../api/apariencia";
import { tienda, type PlantillaTienda } from "../../api/tienda";
import { Modal } from "../../components/Modal";
import { extraerMensajeError } from "../../utils";
import { alertaExito } from "../../utils/alertas";
import { BarraGuardado, CabeceraVista, Cargando, ErrorCarga, Estado, Fila, Grupo, Interruptor } from "./ui";
import { useSiteConfig } from "./usarSiteConfig";

/** La dirección pública de la tienda, si el panel la conoce. */
export function urlTienda(): string | null {
  const bruta = import.meta.env.VITE_TIENDA_URL;
  return bruta ? String(bruta).replace(/\/+$/, "") : null;
}

// ======================================================================= plantillas
export function PlantillasVista() {
  const [plantillas, setPlantillas] = useState<PlantillaTienda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState<PlantillaTienda | null>(null);

  function cargar() {
    setError(null);
    setPlantillas(null);
    tienda
      .plantillas()
      .then(setPlantillas)
      .catch((e) => setError(extraerMensajeError(e, "No se pudieron cargar las plantillas.")));
  }
  useEffect(cargar, []);

  const tiendaUrl = urlTienda();

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo="Plantillas"
        descripcion="Elige un punto de partida para tu tienda. Las páginas llegan como borrador: revísalas en el editor visual y publica cuando estés listo."
        acciones={
          <>
            {tiendaUrl && (
              <a className="btn secundario sm cfg-btn-icono" href={tiendaUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden /> Ver tienda
              </a>
            )}
            <Link className="btn primario sm cfg-btn-icono" to="/tienda">
              <Paintbrush size={14} aria-hidden /> Abrir editor visual
            </Link>
          </>
        }
      />
      {error ? (
        <ErrorCarga mensaje={error} onReintentar={cargar} />
      ) : !plantillas ? (
        <Cargando texto="Cargando plantillas…" />
      ) : plantillas.length === 0 ? (
        <Grupo>
          <p className="cfg-vacio">Todavía no hay plantillas disponibles para tu tienda.</p>
        </Grupo>
      ) : (
        <div className="cfg-plantillas">
          {plantillas.map((p) => (
            <article key={p.slug} className="cfg-plantilla">
              <div className="cfg-plantilla-imagen">
                {p.vista_previa ? (
                  <img src={p.vista_previa} alt={`Vista previa de la plantilla ${p.nombre}`} loading="lazy" />
                ) : (
                  <LayoutTemplate size={28} aria-hidden />
                )}
              </div>
              <div className="cfg-plantilla-cuerpo">
                <div className="cfg-plantilla-titulo">
                  <strong>{p.nombre}</strong>
                  {p.es_predeterminada && <Estado tipo="neutro">Recomendada</Estado>}
                </div>
                {p.descripcion && <p>{p.descripcion}</p>}
                <div className="cfg-plantilla-meta">
                  {p.sector && <span>{p.sector}</span>}
                  <span>
                    {Object.keys(p.paginas ?? {}).length} {Object.keys(p.paginas ?? {}).length === 1 ? "página" : "páginas"}
                  </span>
                </div>
              </div>
              <button type="button" className="btn secundario sm" onClick={() => setElegida(p)}>
                Usar plantilla
              </button>
            </article>
          ))}
        </div>
      )}
      {elegida && <ModalAdoptar plantilla={elegida} onCerrar={() => setElegida(null)} />}
    </div>
  );
}

function ModalAdoptar({ plantilla, onCerrar }: { plantilla: PlantillaTienda; onCerrar: () => void }) {
  const [aspecto, setAspecto] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  async function adoptar() {
    if (aplicando) return;
    setAplicando(true);
    setError(null);
    try {
      await tienda.adoptarPlantilla(plantilla.slug, { aplicar_aspecto: aspecto });
      setHecho(true);
      alertaExito(`Plantilla «${plantilla.nombre}» lista como borrador`);
    } catch (e) {
      setError(extraerMensajeError(e, "No se pudo aplicar la plantilla. Inténtalo de nuevo."));
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Modal
      amplio
      medio
      cerrarConEscape
      titulo={hecho ? "Plantilla aplicada" : `Usar «${plantilla.nombre}»`}
      onCerrar={() => !aplicando && onCerrar()}
      footer={
        hecho ? (
          <>
            <button type="button" className="btn secundario" onClick={onCerrar}>
              Cerrar
            </button>
            <Link className="btn primario" to="/tienda">
              Revisar en el editor
            </Link>
          </>
        ) : (
          <>
            <button type="button" className="btn secundario" onClick={onCerrar} disabled={aplicando}>
              Cancelar
            </button>
            <button type="button" className="btn primario" onClick={adoptar} disabled={aplicando} aria-busy={aplicando}>
              {aplicando ? "Aplicando…" : "Aplicar como borrador"}
            </button>
          </>
        )
      }
    >
      {hecho ? (
        <p className="cfg-texto">
          Las páginas de «{plantilla.nombre}» quedaron como <strong>borrador</strong>. Tus clientes siguen viendo la tienda
          publicada hasta que la revises y publiques desde el editor visual.
        </p>
      ) : (
        <>
          {error && (
            <div className="cfg-aviso error" role="alert">
              {error}
            </div>
          )}
          <ul className="cfg-lista-pasos">
            <li>
              <Check size={15} aria-hidden /> Se crea un <strong>borrador</strong> de cada página de la plantilla.
            </li>
            <li>
              <Check size={15} aria-hidden /> Lo publicado no cambia hasta que publiques desde el editor visual.
            </li>
            <li>
              <Check size={15} aria-hidden /> Si ya editabas un borrador de esas páginas, se reemplaza.
            </li>
          </ul>
          <Grupo sinRelleno>
            <Fila
              titulo="Aplicar también sus colores y tipografía"
              descripcion="Cambia el aspecto de la tienda publicada en cuanto apliques. Apágalo para conservar tu identidad actual."
            >
              <Interruptor etiqueta="Aplicar colores y tipografía" activo={aspecto} onCambiar={setAspecto} />
            </Fila>
          </Grupo>
        </>
      )}
    </Modal>
  );
}

// ======================================================================= apariencia
function CampoColor({ id, etiqueta, valor, onCambiar }: { id: string; etiqueta: string; valor: string; onCambiar: (v: string) => void }) {
  return (
    <div className="cfg-color">
      <input
        type="color"
        aria-label={`${etiqueta}: selector`}
        value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : "#000000"}
        onChange={(e) => onCambiar(e.target.value)}
      />
      <div className="cfg-color-texto">
        <label htmlFor={id}>{etiqueta}</label>
        <input id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} placeholder="#000000" maxLength={7} spellCheck={false} />
      </div>
    </div>
  );
}

export function AparienciaVista() {
  const editor = useSiteConfig("diseno/apariencia");
  const { config, campo } = editor;

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo="Apariencia"
        descripcion="Colores, tipografía y forma de los botones de tu tienda. La vista previa cambia mientras editas; la tienda, al guardar."
        acciones={
          <Link className="btn secundario sm cfg-btn-icono" to="/tienda">
            <Paintbrush size={14} aria-hidden /> Ajustes avanzados del tema
          </Link>
        }
      />
      {editor.cargando ? (
        <Cargando />
      ) : editor.errorCarga || !config ? (
        <ErrorCarga mensaje={editor.errorCarga ?? "Sin datos."} onReintentar={editor.recargar} />
      ) : (
        <form
          className="cfg-form"
          onSubmit={(e) => {
            e.preventDefault();
            void editor.guardar();
          }}
        >
          <div className="cfg-apariencia">
            <div className="cfg-apariencia-ajustes">
              <Grupo titulo="Colores">
                <div className="cfg-colores">
                  <CampoColor id="cfg-c1" etiqueta="Primario" valor={config.color_primario} onCambiar={(v) => campo("color_primario", v)} />
                  <CampoColor id="cfg-c2" etiqueta="Texto sobre primario" valor={config.color_primario_texto} onCambiar={(v) => campo("color_primario_texto", v)} />
                  <CampoColor id="cfg-c3" etiqueta="Secundario" valor={config.color_secundario} onCambiar={(v) => campo("color_secundario", v)} />
                  <CampoColor id="cfg-c4" etiqueta="Texto sobre secundario" valor={config.color_secundario_texto} onCambiar={(v) => campo("color_secundario_texto", v)} />
                  <CampoColor id="cfg-c5" etiqueta="Fondo general" valor={config.color_fondo} onCambiar={(v) => campo("color_fondo", v)} />
                  <CampoColor id="cfg-c6" etiqueta="Tarjetas y paneles" valor={config.color_superficie} onCambiar={(v) => campo("color_superficie", v)} />
                  <CampoColor id="cfg-c7" etiqueta="Texto general" valor={config.color_texto} onCambiar={(v) => campo("color_texto", v)} />
                </div>
              </Grupo>
              <Grupo titulo="Tipografía y botones">
                <div className="cfg-rejilla-2">
                  <div className="campo">
                    <label htmlFor="cfg-fuente">Fuente</label>
                    <select id="cfg-fuente" value={config.fuente} onChange={(e) => campo("fuente", e.target.value)}>
                      {FUENTES.map((f) => (
                        <option key={f.valor} value={f.valor}>
                          {f.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <span className="cfg-etiqueta" id="cfg-radio">Forma de los botones</span>
                    <div className="segmentado" role="radiogroup" aria-labelledby="cfg-radio">
                      {RADIOS_BOTON.map((r) => (
                        <button
                          key={r.valor}
                          type="button"
                          role="radio"
                          aria-checked={config.radio_boton === r.valor}
                          className={config.radio_boton === r.valor ? "activo" : ""}
                          onClick={() => campo("radio_boton", r.valor)}
                        >
                          {r.etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Grupo>
              <Grupo titulo="Barra de navegación">
                <div className="cfg-rejilla-2">
                  <div className="campo">
                    <label htmlFor="cfg-buscador">Ancho del buscador · {config.ancho_buscador}px</label>
                    <input
                      id="cfg-buscador"
                      type="range"
                      min={240}
                      max={640}
                      step={10}
                      value={config.ancho_buscador}
                      onChange={(e) => campo("ancho_buscador", Number(e.target.value))}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="cfg-espacio">Espacio tras el logo · {config.espaciado_navbar}px</label>
                    <input
                      id="cfg-espacio"
                      type="range"
                      min={0}
                      max={64}
                      step={4}
                      value={config.espaciado_navbar}
                      onChange={(e) => campo("espaciado_navbar", Number(e.target.value))}
                    />
                  </div>
                </div>
              </Grupo>
            </div>

            <aside className="cfg-apariencia-previa" aria-label="Vista previa">
              <span className="cfg-etiqueta">Vista previa</span>
              <div
                className="tema-preview"
                style={{
                  fontFamily: pilaFuente(config.fuente),
                  background: config.color_fondo || "#f6faf7",
                  color: config.color_texto || "#0f172a",
                }}
              >
                <div className="tema-preview-navbar">
                  <span className="tema-preview-logo" style={{ marginRight: `${Math.min(config.espaciado_navbar, 32)}px` }}>
                    {config.nombre_empresa || "Tu tienda"}
                  </span>
                  <span className="tema-preview-buscador" style={{ width: `${Math.min(config.ancho_buscador, 220) * 0.6}px` }}>
                    Buscar…
                  </span>
                </div>
                <div className="tema-preview-botones">
                  <span
                    className="tema-preview-btn"
                    style={{
                      background: config.color_primario || "#16a34a",
                      color: config.color_primario_texto || "#fff",
                      borderRadius: radioPx(config.radio_boton),
                    }}
                  >
                    Agregar al pedido
                  </span>
                  <span
                    className="tema-preview-btn"
                    style={{
                      background: config.color_secundario || "#f59e0b",
                      color: config.color_secundario_texto || "#0b1f17",
                      borderRadius: radioPx(config.radio_boton),
                    }}
                  >
                    Ver promoción
                  </span>
                </div>
                <div className="tema-preview-card" style={{ background: config.color_superficie || "#ffffff" }}>
                  Así se ve una tarjeta de producto sobre el fondo elegido.
                </div>
              </div>
            </aside>
          </div>
          <BarraGuardado
            pendiente={editor.pendiente}
            guardando={editor.guardando}
            guardado={editor.guardado}
            error={editor.errorGuardar}
            onGuardar={editor.guardar}
            onDescartar={editor.descartar}
          />
        </form>
      )}
    </div>
  );
}
