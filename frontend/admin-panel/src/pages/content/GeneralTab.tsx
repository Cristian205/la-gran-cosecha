import { useEffect, useState } from "react";
import { actualizarSiteConfig, obtenerSiteConfig } from "../../api/content";
import { MediaField } from "../../components/MediaField";
import type { SiteConfig } from "../../types";
import { extraerMensajeError } from "../../utils";

const FUENTES: { valor: string; etiqueta: string; pila: string }[] = [
  { valor: "poppins", etiqueta: "Poppins", pila: '"Poppins", sans-serif' },
  { valor: "inter", etiqueta: "Inter", pila: '"Inter", sans-serif' },
  { valor: "nunito", etiqueta: "Nunito", pila: '"Nunito", sans-serif' },
  { valor: "work-sans", etiqueta: "Work Sans", pila: '"Work Sans", sans-serif' },
  { valor: "jakarta", etiqueta: "Plus Jakarta Sans", pila: '"Plus Jakarta Sans", sans-serif' },
  { valor: "quicksand", etiqueta: "Quicksand", pila: '"Quicksand", sans-serif' },
];

const RADIOS_BOTON: { valor: string; etiqueta: string; px: number }[] = [
  { valor: "redondeado", etiqueta: "Redondeado", px: 999 },
  { valor: "suave", etiqueta: "Suave", px: 14 },
  { valor: "cuadrado", etiqueta: "Cuadrado", px: 6 },
];

function pilaFuente(valor: string): string {
  return FUENTES.find((f) => f.valor === valor)?.pila ?? FUENTES[0].pila;
}

function radioPx(valor: string): number {
  return RADIOS_BOTON.find((r) => r.valor === valor)?.px ?? 999;
}

interface CampoColorProps {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  ayuda?: string;
}

function CampoColor({ etiqueta, valor, onCambiar, ayuda }: CampoColorProps) {
  return (
    <div className="campo">
      <label>{etiqueta}</label>
      <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
        <input
          type="color"
          value={valor || "#000000"}
          onChange={(e) => onCambiar(e.target.value)}
          style={{ width: 46, height: 38, padding: 2, flexShrink: 0 }}
        />
        <input
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          placeholder="#000000"
          style={{ maxWidth: 140 }}
        />
      </div>
      {ayuda && (
        <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: ".4rem" }}>{ayuda}</p>
      )}
    </div>
  );
}

const VACIO: SiteConfig = {
  logo_url: null,
  nombre_empresa: "",
  color_primario: "#16a34a",
  color_primario_texto: "#ffffff",
  color_secundario: "#f59e0b",
  color_secundario_texto: "#0b1f17",
  color_fondo: "#f6faf7",
  color_superficie: "#ffffff",
  color_texto: "#0f172a",
  fuente: "poppins",
  radio_boton: "redondeado",
  ancho_buscador: 420,
  espaciado_navbar: 0,
  whatsapp_numero: "",
  whatsapp_mensaje_pedido: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  telefono: "",
  email: "",
  direccion: "",
  ciudad: "",
  horario: "",
  historia: "",
  mision: "",
  paso1_titulo: "",
  paso1_texto: "",
  paso2_titulo: "",
  paso2_texto: "",
  paso3_titulo: "",
  paso3_texto: "",
  cotizacion_titulo: "",
  cotizacion_texto: "",
  cta_final_titulo: "",
  cta_final_texto: "",
  factura_eslogan: "",
  factura_nit: "",
  factura_proveedor: "",
  factura_telefono: "",
  factura_direccion: "",
};

export function GeneralTab() {
  const [config, setConfig] = useState<SiteConfig>(VACIO);
  const [logo, setLogo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    obtenerSiteConfig()
      .then(setConfig)
      .catch(() => setError("No se pudo cargar la configuración del sitio."))
      .finally(() => setCargando(false));
  }, []);

  function campo(nombre: keyof SiteConfig, valor: string) {
    setConfig((prev) => ({ ...prev, [nombre]: valor }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      const { logo_url, ...cambios } = config;
      void logo_url;
      const actualizado = await actualizarSiteConfig(cambios, logo);
      setConfig(actualizado);
      setLogo(null);
      setOk(true);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar la configuración."));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <div className="vacio">Cargando…</div>;

  return (
    <form onSubmit={guardar}>
      {error && <div className="error-box">{error}</div>}
      {ok && <div className="ok-box">Configuración guardada correctamente.</div>}

      <div className="config-grid">
      <div className="panel">
        <div className="cabecera">
          <h2>Logo del sitio</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <MediaField
            valor={logo}
            urlActual={config.logo_url}
            onCambiar={setLogo}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            ayuda="Se usa en el navbar y el pie de página de la tienda."
          />
        </div>
      </div>

      <div className="panel">
        <div className="cabecera">
          <h2>Redes sociales</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <div className="campo">
            <label>Instagram</label>
            <input
              value={config.instagram_url}
              onChange={(e) => campo("instagram_url", e.target.value)}
              placeholder="https://instagram.com/tu_negocio"
            />
          </div>
          <div className="campo">
            <label>Facebook</label>
            <input
              value={config.facebook_url}
              onChange={(e) => campo("facebook_url", e.target.value)}
              placeholder="https://facebook.com/tu_negocio"
            />
          </div>
          <div className="campo">
            <label>TikTok</label>
            <input
              value={config.tiktok_url}
              onChange={(e) => campo("tiktok_url", e.target.value)}
              placeholder="https://tiktok.com/@tu_negocio"
            />
          </div>
        </div>
      </div>

      <div className="panel panel-ancho">
        <div className="cabecera">
          <h2>Apariencia de la tienda pública</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <p style={{ color: "var(--gris)", fontSize: ".85rem", marginTop: 0 }}>
            Estos cambios se aplican en vivo en la tienda (storefront) que ven tus
            clientes. La vista previa de abajo se actualiza mientras editas.
          </p>

          <div className="modal-seccion">
            <span>Colores</span>
          </div>
          <div className="fila">
            <CampoColor
              etiqueta="Botón primario — fondo"
              valor={config.color_primario}
              onCambiar={(v) => campo("color_primario", v)}
              ayuda="Botones principales, acentos y degradados de marca."
            />
            <CampoColor
              etiqueta="Botón primario — texto"
              valor={config.color_primario_texto}
              onCambiar={(v) => campo("color_primario_texto", v)}
            />
          </div>
          <div className="fila">
            <CampoColor
              etiqueta="Botón secundario — fondo"
              valor={config.color_secundario}
              onCambiar={(v) => campo("color_secundario", v)}
              ayuda="Botones de énfasis (ej: promociones) e insignias."
            />
            <CampoColor
              etiqueta="Botón secundario — texto"
              valor={config.color_secundario_texto}
              onCambiar={(v) => campo("color_secundario_texto", v)}
            />
          </div>
          <div className="fila">
            <CampoColor
              etiqueta="Fondo general"
              valor={config.color_fondo}
              onCambiar={(v) => campo("color_fondo", v)}
            />
            <CampoColor
              etiqueta="Fondo de tarjetas/paneles"
              valor={config.color_superficie}
              onCambiar={(v) => campo("color_superficie", v)}
            />
          </div>
          <CampoColor
            etiqueta="Texto general"
            valor={config.color_texto}
            onCambiar={(v) => campo("color_texto", v)}
            ayuda="Color de títulos y texto principal en toda la tienda."
          />

          <div className="modal-seccion">
            <span>Tipografía y botones</span>
          </div>
          <div className="campo">
            <label>Fuente del sitio</label>
            <select value={config.fuente} onChange={(e) => campo("fuente", e.target.value)}>
              {FUENTES.map((f) => (
                <option key={f.valor} value={f.valor} style={{ fontFamily: f.pila }}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Forma de los botones</label>
            <div className="segmentado" style={{ maxWidth: 360 }}>
              {RADIOS_BOTON.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  className={config.radio_boton === r.valor ? "activo" : ""}
                  onClick={() => campo("radio_boton", r.valor)}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-seccion">
            <span>Layout del navbar</span>
          </div>
          <div className="campo">
            <label>Ancho del buscador ({config.ancho_buscador}px)</label>
            <input
              type="range"
              min={240}
              max={640}
              step={10}
              value={config.ancho_buscador}
              onChange={(e) => setConfig((prev) => ({ ...prev, ancho_buscador: Number(e.target.value) }))}
            />
          </div>
          <div className="campo">
            <label>Espacio entre el logo y las opciones ({config.espaciado_navbar}px)</label>
            <input
              type="range"
              min={0}
              max={64}
              step={4}
              value={config.espaciado_navbar}
              onChange={(e) => setConfig((prev) => ({ ...prev, espaciado_navbar: Number(e.target.value) }))}
            />
          </div>

          <div className="modal-seccion">
            <span>Vista previa</span>
          </div>
          <div
            className="tema-preview"
            style={{
              fontFamily: pilaFuente(config.fuente),
              background: config.color_fondo || "#f6faf7",
              color: config.color_texto || "#0f172a",
            }}
          >
            <div className="tema-preview-navbar">
              <span
                className="tema-preview-logo"
                style={{ marginRight: `${Math.min(config.espaciado_navbar, 32)}px` }}
              >
                🌾 Tu tienda
              </span>
              <span
                className="tema-preview-buscador"
                style={{ width: `${Math.min(config.ancho_buscador, 260)}px` }}
              >
                Buscar productos…
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
            <div
              className="tema-preview-card"
              style={{ background: config.color_superficie || "#ffffff" }}
            >
              Así se ve una tarjeta de producto sobre el fondo elegido.
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="cabecera">
          <h2>Contacto</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <div className="fila">
            <div className="campo">
              <label>WhatsApp (con indicativo, sin '+')</label>
              <input
                value={config.whatsapp_numero}
                onChange={(e) => campo("whatsapp_numero", e.target.value)}
                placeholder="573001234567"
              />
            </div>
            <div className="campo">
              <label>Teléfono</label>
              <input value={config.telefono} onChange={(e) => campo("telefono", e.target.value)} />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Correo</label>
              <input value={config.email} onChange={(e) => campo("email", e.target.value)} />
            </div>
            <div className="campo">
              <label>Ciudad</label>
              <input value={config.ciudad} onChange={(e) => campo("ciudad", e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label>Dirección</label>
            <input value={config.direccion} onChange={(e) => campo("direccion", e.target.value)} />
          </div>
          <div className="campo">
            <label>Horario de atención</label>
            <input value={config.horario} onChange={(e) => campo("horario", e.target.value)} />
          </div>
          <div className="campo">
            <label>Mensaje de WhatsApp al confirmar un pedido</label>
            <textarea
              rows={2}
              value={config.whatsapp_mensaje_pedido}
              onChange={(e) => campo("whatsapp_mensaje_pedido", e.target.value)}
            />
            <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: ".4rem" }}>
              Placeholders disponibles: {"{nombre}"}, {"{pedido_id}"}, {"{total}"}.
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="cabecera">
          <h2>Sobre nosotros</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <div className="campo">
            <label>Historia</label>
            <textarea
              rows={4}
              value={config.historia}
              onChange={(e) => campo("historia", e.target.value)}
            />
          </div>
          <div className="campo">
            <label>Misión</label>
            <textarea
              rows={3}
              value={config.mision}
              onChange={(e) => campo("mision", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel panel-ancho">
        <div className="cabecera">
          <h2>Textos del Home</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <div className="modal-seccion">
            <span>Cómo funciona (3 pasos)</span>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Paso 1 — Título</label>
              <input value={config.paso1_titulo} onChange={(e) => campo("paso1_titulo", e.target.value)} />
            </div>
            <div className="campo">
              <label>Paso 1 — Texto</label>
              <input value={config.paso1_texto} onChange={(e) => campo("paso1_texto", e.target.value)} />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Paso 2 — Título</label>
              <input value={config.paso2_titulo} onChange={(e) => campo("paso2_titulo", e.target.value)} />
            </div>
            <div className="campo">
              <label>Paso 2 — Texto</label>
              <input value={config.paso2_texto} onChange={(e) => campo("paso2_texto", e.target.value)} />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Paso 3 — Título</label>
              <input value={config.paso3_titulo} onChange={(e) => campo("paso3_titulo", e.target.value)} />
            </div>
            <div className="campo">
              <label>Paso 3 — Texto</label>
              <input value={config.paso3_texto} onChange={(e) => campo("paso3_texto", e.target.value)} />
            </div>
          </div>

          <div className="modal-seccion">
            <span>Cotización rápida</span>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Título</label>
              <input
                value={config.cotizacion_titulo}
                onChange={(e) => campo("cotizacion_titulo", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Texto</label>
              <input
                value={config.cotizacion_texto}
                onChange={(e) => campo("cotizacion_texto", e.target.value)}
              />
            </div>
          </div>
          <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: "-.4rem" }}>
            Los botones usan el WhatsApp configurado arriba en "Contacto" y el formulario de
            "Contáctanos" — no hace falta repetirlos aquí.
          </p>

          <div className="modal-seccion">
            <span>CTA final</span>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Título</label>
              <input
                value={config.cta_final_titulo}
                onChange={(e) => campo("cta_final_titulo", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Texto</label>
              <input
                value={config.cta_final_texto}
                onChange={(e) => campo("cta_final_texto", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="panel panel-ancho">
        <div className="cabecera">
          <h2>Datos de factura (PDF de pedidos)</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: 0 }}>
            El logo se toma del panel "Logo del sitio" de más arriba.
          </p>
          <div className="fila">
            <div className="campo">
              <label>Nombre de la empresa (encabezado de la factura)</label>
              <input
                value={config.nombre_empresa}
                onChange={(e) => campo("nombre_empresa", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Eslogan / subtítulo</label>
              <input
                value={config.factura_eslogan}
                onChange={(e) => campo("factura_eslogan", e.target.value)}
                placeholder="Distribuidora Mayorista"
              />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label>NIT</label>
              <input
                value={config.factura_nit}
                onChange={(e) => campo("factura_nit", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Proveedor / Razón social</label>
              <input
                value={config.factura_proveedor}
                onChange={(e) => campo("factura_proveedor", e.target.value)}
              />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label>Teléfono de factura</label>
              <input
                value={config.factura_telefono}
                onChange={(e) => campo("factura_telefono", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Dirección de factura</label>
              <input
                value={config.factura_direccion}
                onChange={(e) => campo("factura_direccion", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      </div>

      <button className="btn primario" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
