import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileSpreadsheet, FileText, ImageOff, Palette, SlidersHorizontal } from "lucide-react";
import { Modal } from "../../components/Modal";
import { PasosModal } from "../../components/PasosModal";
import { obtenerEstadisticas, obtenerReporteVentas } from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";
import { alertaExito } from "../../utils/alertas";
import { INFORMES, type Informe } from "../../reportes/informes";
import { VERDE_PANEL, cargarLogo, paleta } from "../../reportes/estilo";
import type { EstiloInforme, FormatoInforme } from "../../reportes/tipos";
import { aFecha, type Rango } from "./periodo";
import { rutaDe } from "../configuracion/rutas";
import "./exportar.css";

/** Lo que se recuerda entre exportaciones (en este navegador). */
interface Preferencias {
  formato: FormatoInforme;
  incluirLogo: boolean;
  modoColor: "marca" | "panel" | "personal";
  colorPersonal: string;
  incluirTotales: boolean;
  incluirPie: boolean;
  orientacion: "vertical" | "horizontal";
}

const CLAVE = "kryonx-estilo-informes";
const POR_DEFECTO: Preferencias = {
  formato: "excel",
  incluirLogo: true,
  modoColor: "marca",
  colorPersonal: "#1e3a8a",
  incluirTotales: true,
  incluirPie: true,
  orientacion: "vertical",
};

function leerPreferencias(): Preferencias {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
    return { ...POR_DEFECTO, ...guardado };
  } catch {
    return POR_DEFECTO;
  }
}

function guardarPreferencias(p: Preferencias) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // Navegación privada o almacenamiento lleno: solo se pierde el recuerdo.
  }
}

const LARGA: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

function periodoLegible(r: Rango): string {
  const desde = aFecha(r.desde);
  const hasta = aFecha(r.hasta);
  if (r.desde === r.hasta) return hasta.toLocaleDateString("es-CO", LARGA);
  const mismoAnio = desde.getFullYear() === hasta.getFullYear();
  const inicio = desde.toLocaleDateString("es-CO", mismoAnio ? { day: "numeric", month: "long" } : LARGA);
  return `Del ${inicio} al ${hasta.toLocaleDateString("es-CO", LARGA)}`;
}

export function ExportModal({ rango, onCerrar }: { rango: Rango; onCerrar: () => void }) {
  const { usuario, marca } = useAuth();
  const [informe, setInforme] = useState<Informe>(INFORMES[0]);
  const [pref, setPref] = useState<Preferencias>(leerPreferencias);
  const [empresa, setEmpresa] = useState(marca?.nombreEmpresa ?? "");
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "error" | "info"; texto: string } | null>(null);
  /** El modal va en dos pasos: 1 · qué informe, 2 · cómo se ve. */
  const [paso, setPaso] = useState<1 | 2>(1);

  function irA(destino: 1 | 2) {
    setPaso(destino);
    setAviso(null);
  }

  const colorMarca = marca?.color ?? VERDE_PANEL;
  const color =
    pref.modoColor === "marca" ? colorMarca : pref.modoColor === "panel" ? VERDE_PANEL : pref.colorPersonal;
  const colores = paleta(color);
  const logoUrl = marca?.logoUrl ?? null;
  const conLogo = pref.incluirLogo && Boolean(logoUrl);
  const periodo = informe.usaPeriodo ? periodoLegible(rango) : "Corte a la fecha de generación";
  const tituloVisible = titulo.trim() || informe.etiqueta;
  const IconoInforme = informe.icono;

  function cambiar<K extends keyof Preferencias>(campo: K, valor: Preferencias[K]) {
    setPref((p) => {
      const siguiente = { ...p, [campo]: valor };
      guardarPreferencias(siguiente);
      return siguiente;
    });
  }

  // Columnas de muestra para la vista previa (sin pedir datos al servidor).
  const columnasMuestra = useMemo(() => {
    const ejemplo = {
      resumen: ["Métrica", "Valor"],
      ventas_periodo: ["N° pedido", "Fecha", "Cliente", "Total"],
      ventas_por_dia: ["Día", "Total vendido"],
      ventas_por_categoria: ["Categoría", "Total vendido", "% del total"],
      top_productos: ["Producto", "Cantidad", "Total vendido"],
      productos_por_categoria: ["Categoría", "Productos"],
    } as Record<string, string[]>;
    return ejemplo[informe.clave] ?? ["Columna", "Valor"];
  }, [informe.clave]);

  async function generar() {
    if (generando) return;
    setGenerando(true);
    setAviso(null);
    try {
      const [stats, reporte] = await Promise.all([obtenerEstadisticas(), obtenerReporteVentas(rango)]);
      const datos = informe.generar({ stats, reporte }, rango);
      if (!datos) {
        setAviso({ tipo: "info", texto: "No hay datos para este informe en el período elegido. Prueba con otro período u otro informe." });
        return;
      }
      const estilo: EstiloInforme = {
        formato: pref.formato,
        empresa: empresa.trim(),
        titulo: titulo.trim(),
        notas: notas.trim(),
        incluirLogo: conLogo,
        color,
        incluirTotales: pref.incluirTotales,
        incluirPie: pref.incluirPie,
        orientacion: pref.orientacion,
      };
      const contexto = {
        logoUrl: conLogo ? logoUrl : null,
        generadoPor: usuario?.nombre_usuario ?? "",
        periodo: datos.periodo ?? periodoLegible(rango),
      };

      if (pref.formato === "pdf") {
        const { imprimirInforme } = await import("../../reportes/pdf");
        await imprimirInforme(datos, estilo, contexto);
        onCerrar();
        return;
      }

      const { descargarExcel } = await import("../../reportes/excel");
      const logo = conLogo && logoUrl ? await cargarLogo(logoUrl) : null;
      await descargarExcel(datos, estilo, contexto, logo);
      if (conLogo && !logo) {
        // El informe salió; solo falta el logo. Se avisa sin cerrar.
        setAviso({
          tipo: "info",
          texto:
            "El informe se descargó, pero el logo no se pudo incluir en el Excel (el servidor de imágenes no lo permite). En PDF sí aparece.",
        });
        return;
      }
      alertaExito("Informe descargado");
      onCerrar();
    } catch {
      setAviso({ tipo: "error", texto: "No pudimos generar el informe. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setGenerando(false);
    }
  }

  // Los pasos van pegados al encabezado (fuera del área que se desplaza):
  // se puede volver al 1 en cualquier momento.
  const pestañas = (
    <PasosModal
      etiqueta="Pasos para exportar"
      activo={String(paso)}
      onCambiar={(clave) => irA(clave === "2" ? 2 : 1)}
      pasos={[
        { clave: "1", titulo: "Tipo de informe", detalle: informe.etiqueta, hecho: paso > 1 },
        { clave: "2", titulo: "Personalizar", detalle: pref.formato === "pdf" ? "PDF" : "Excel" },
      ]}
    />
  );

  return (
    <Modal
      amplio
      ancho
      expandible
      cerrarConEscape
      subcabecera={pestañas}
      titulo="Exportar informe"
      subtitulo={`Período del dashboard: ${periodoLegible(rango)}`}
      onCerrar={() => !generando && onCerrar()}
      footer={
        paso === 1 ? (
          <>
            <button type="button" className="btn secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="btn primario rx-generar" onClick={() => irA(2)}>
              Siguiente: personalizar <ArrowRight size={16} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn secundario rx-generar" onClick={() => irA(1)} disabled={generando}>
              <ArrowLeft size={16} aria-hidden /> Atrás
            </button>
            <button type="button" className="btn primario rx-generar" onClick={generar} disabled={generando} aria-busy={generando}>
              {pref.formato === "pdf" ? <FileText size={16} aria-hidden /> : <FileSpreadsheet size={16} aria-hidden />}
              {generando ? "Generando…" : pref.formato === "pdf" ? "Generar PDF" : "Descargar Excel"}
            </button>
          </>
        )
      }
    >
      {/* Arriba, donde se ve sin desplazarse en un modal largo. */}
      {aviso && (
        <div className={`rx-aviso ${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
          <AlertTriangle size={15} aria-hidden /> {aviso.texto}
        </div>
      )}
      {/* ---------- Paso 1: qué informe ---------- */}
      {paso === 1 && (
        <section className="rx-panel" role="tabpanel" id="rx-panel-1" aria-labelledby="rx-tab-1">
          <p className="rx-intro">¿Qué quieres exportar? Puedes cambiarlo después sin perder lo que personalices.</p>
          <div className="rx-informes" role="radiogroup" aria-label="Tipo de informe">
            {INFORMES.map((inf) => {
              const Icono = inf.icono;
              const activo = inf.clave === informe.clave;
              return (
                <button
                  key={inf.clave}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  className={`rx-informe ${activo ? "activo" : ""}`}
                  onClick={() => {
                    setInforme(inf);
                    setAviso(null);
                  }}
                  onDoubleClick={() => {
                    setInforme(inf);
                    irA(2);
                  }}
                >
                  <span className="rx-informe-icono">
                    <Icono size={17} aria-hidden />
                  </span>
                  <span className="rx-informe-texto">
                    <strong>{inf.etiqueta}</strong>
                    <small>{inf.descripcion}</small>
                  </span>
                  {activo && <Check size={16} className="rx-informe-check" aria-hidden />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Paso 2: cómo se ve ---------- */}
      {paso === 2 && (
        <section className="rx-panel rx-personaliza" role="tabpanel" id="rx-panel-2" aria-labelledby="rx-tab-2">
          <div className="rx-col">
            <div className="rx-elegido">
              <span className="rx-informe-icono">
                <IconoInforme size={16} aria-hidden />
              </span>
              <span className="rx-informe-texto">
                <small>Informe</small>
                <strong>{informe.etiqueta}</strong>
              </span>
              <button type="button" className="rx-cambiar" onClick={() => irA(1)}>
                Cambiar
              </button>
            </div>

          <div className="rx-campo">
            <span className="rx-etiqueta" id="rx-formato">Formato</span>
            <div className="rx-segmentado" role="radiogroup" aria-labelledby="rx-formato">
              {(
                [
                  ["excel", "Excel", FileSpreadsheet, "Para analizar y filtrar"],
                  ["pdf", "PDF", FileText, "Para compartir o imprimir"],
                ] as const
              ).map(([valor, etiqueta, Icono, ayuda]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={pref.formato === valor}
                  className={pref.formato === valor ? "activo" : ""}
                  onClick={() => cambiar("formato", valor)}
                >
                  <Icono size={16} aria-hidden />
                  <span>
                    <strong>{etiqueta}</strong>
                    <small>{ayuda}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rx-fila">
            <div className="campo">
              <label htmlFor="rx-empresa">Nombre en el encabezado</label>
              <input id="rx-empresa" maxLength={120} value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="rx-titulo">Título del informe</label>
              <input
                id="rx-titulo"
                maxLength={120}
                placeholder={informe.etiqueta}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="rx-notas">
              Nota <span className="rx-opcional">Opcional</span>
            </label>
            <textarea
              id="rx-notas"
              rows={2}
              maxLength={300}
              placeholder="Ej: Preparado para la reunión de socios de octubre."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <span className="rx-etiqueta">Contenido</span>
          <div className="rx-opciones">
            <label className={`rx-opcion ${logoUrl ? "" : "deshabilitada"}`}>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={conLogo}
                  disabled={!logoUrl}
                  onChange={(e) => cambiar("incluirLogo", e.target.checked)}
                />
                <span className="switch-riel" />
              </span>
              <span>
                <strong>Logo corporativo</strong>
                {logoUrl ? (
                  <small>Encabeza el informe.</small>
                ) : (
                  <small>
                    Aún no tienes logo. <Link to={rutaDe("negocio/identidad")} onClick={onCerrar}>Súbelo en Identidad del negocio</Link>.
                  </small>
                )}
              </span>
            </label>
            <label className={`rx-opcion ${hayTotales(informe) ? "" : "deshabilitada"}`}>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={pref.incluirTotales && hayTotales(informe)}
                  disabled={!hayTotales(informe)}
                  onChange={(e) => cambiar("incluirTotales", e.target.checked)}
                />
                <span className="switch-riel" />
              </span>
              <span>
                <strong>Fila de totales</strong>
                <small>{hayTotales(informe) ? "Suma las columnas de valores." : "Este informe no lleva totales."}</small>
              </span>
            </label>
            <label className="rx-opcion">
              <span className="switch">
                <input type="checkbox" checked={pref.incluirPie} onChange={(e) => cambiar("incluirPie", e.target.checked)} />
                <span className="switch-riel" />
              </span>
              <span>
                <strong>Pie de página</strong>
                <small>Fecha, autor y número de página.</small>
              </span>
            </label>
          </div>

          <div className="rx-fila">
            <div className="rx-campo">
              <span className="rx-etiqueta" id="rx-color">
                <Palette size={14} aria-hidden /> Color
              </span>
              <div className="rx-colores" role="radiogroup" aria-labelledby="rx-color">
                {(
                  [
                    ["marca", "De la marca", colorMarca],
                    ["panel", "Verde clásico", VERDE_PANEL],
                  ] as const
                ).map(([valor, etiqueta, muestra]) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={pref.modoColor === valor}
                    className={`rx-color ${pref.modoColor === valor ? "activo" : ""}`}
                    onClick={() => cambiar("modoColor", valor)}
                  >
                    <span className="rx-muestra" style={{ background: muestra }} aria-hidden />
                    {etiqueta}
                  </button>
                ))}
                <label className={`rx-color ${pref.modoColor === "personal" ? "activo" : ""}`}>
                  <input
                    type="color"
                    aria-label="Color personalizado"
                    value={pref.colorPersonal}
                    onChange={(e) => {
                      cambiar("colorPersonal", e.target.value);
                      cambiar("modoColor", "personal");
                    }}
                  />
                  Otro
                </label>
              </div>
            </div>
            {pref.formato === "pdf" && (
              <div className="rx-campo">
                <span className="rx-etiqueta" id="rx-orientacion">
                  <SlidersHorizontal size={14} aria-hidden /> Orientación
                </span>
                <div className="rx-colores" role="radiogroup" aria-labelledby="rx-orientacion">
                  {(
                    [
                      ["vertical", "Vertical"],
                      ["horizontal", "Horizontal"],
                    ] as const
                  ).map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={pref.orientacion === valor}
                      className={`rx-color ${pref.orientacion === valor ? "activo" : ""}`}
                      onClick={() => cambiar("orientacion", valor)}
                    >
                      <span className={`rx-hoja ${valor}`} aria-hidden />
                      {etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          </div>

          {/* ---------- Vista previa (fija mientras se desplaza el formulario) ---------- */}
          <aside className="rx-previa-marco" aria-label="Vista previa del encabezado del informe">
            <span className="rx-etiqueta">Vista previa</span>
            <div className={`rx-previa ${pref.formato === "pdf" && pref.orientacion === "horizontal" ? "horizontal" : ""}`}>
              <div className="rx-previa-cabecera" style={{ borderColor: colores.acento }}>
                {conLogo ? (
                  <img src={logoUrl!} alt="" />
                ) : pref.incluirLogo && !logoUrl ? (
                  <span className="rx-previa-sinlogo" title="Sin logo">
                    <ImageOff size={14} />
                  </span>
                ) : null}
                <div>
                  {empresa.trim() && <div className="rx-previa-empresa">{empresa.trim()}</div>}
                  <div className="rx-previa-titulo" style={{ color: colores.titulo }}>
                    {tituloVisible}
                  </div>
                </div>
              </div>
              <div className="rx-previa-meta">{periodo}</div>
              {notas.trim() && (
                <div className="rx-previa-notas" style={{ borderColor: colores.acento, background: colores.suave }}>
                  {notas.trim()}
                </div>
              )}
              <div className="rx-previa-tabla" style={{ gridTemplateColumns: `repeat(${columnasMuestra.length}, 1fr)` }}>
                {columnasMuestra.map((c) => (
                  <span key={c} className="rx-previa-th" style={{ background: colores.cabecera, color: colores.sobreAcento }}>
                    {c}
                  </span>
                ))}
                {[0, 1, 2].flatMap((fila) =>
                  columnasMuestra.map((c) => (
                    <span
                      key={`${fila}-${c}`}
                      className="rx-previa-td"
                      style={{ background: fila % 2 === 1 ? colores.suave : undefined }}
                    >
                      <i />
                    </span>
                  ))
                )}
                {pref.incluirTotales && hayTotales(informe) &&
                  columnasMuestra.map((c, i) => (
                    <span key={`t-${c}`} className="rx-previa-total" style={{ borderColor: colores.acento, color: colores.titulo }}>
                      {i === 0 ? "Total" : ""}
                    </span>
                  ))}
              </div>
              {pref.incluirPie && (
                <div className="rx-previa-pie">
                  Generado por {usuario?.nombre_usuario ?? "—"} · Página 1 de 1
                </div>
              )}
            </div>
            <p className="rx-previa-nota">
              {pref.formato === "pdf" ? "PDF" : "Excel"} · {periodo}
            </p>
          </aside>
        </section>
      )}
    </Modal>
  );
}

/** Los informes que suman algo (los de dinero o cantidades). */
function hayTotales(inf: Informe): boolean {
  return inf.clave !== "resumen";
}
