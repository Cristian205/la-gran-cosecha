import { useEffect, useState } from "react";
import { actualizarSiteConfig, obtenerSiteConfig } from "../../api/content";
import { MediaField } from "../../components/MediaField";
import type { SiteConfig } from "../../types";
import { extraerMensajeError } from "../../utils";

const VACIO: SiteConfig = {
  logo_url: null,
  nombre_empresa: "",
  color_primario: "#16a34a",
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
          <h2>Apariencia</h2>
        </div>
        <div style={{ padding: "1.2rem" }}>
          <div className="campo">
            <label>Color primario del sitio</label>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
              <input
                type="color"
                value={config.color_primario || "#16a34a"}
                onChange={(e) => campo("color_primario", e.target.value)}
                style={{ width: 46, height: 38, padding: 2, flexShrink: 0 }}
              />
              <input
                value={config.color_primario}
                onChange={(e) => campo("color_primario", e.target.value)}
                placeholder="#16a34a"
                style={{ maxWidth: 140 }}
              />
            </div>
            <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: ".4rem" }}>
              Se usa para botones, acentos y degradados en toda la tienda pública.
            </p>
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

      <div className="panel">
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

      <button className="btn primario" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
