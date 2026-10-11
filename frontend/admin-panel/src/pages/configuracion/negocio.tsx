import { useCallback, useEffect, useState } from "react";
import { cambiarModulo, guardarPerfil, obtenerModulos, obtenerPerfil, type Modulo, type PerfilNegocio } from "../../api/negocio";
import { useAuth } from "../../auth/AuthContext";
import { MediaField } from "../../components/MediaField";
import type { SiteConfig } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito } from "../../utils/alertas";
import { AltaGuiada } from "../business/AltaGuiada";
import {
  BarraGuardado,
  CabeceraVista,
  Cargando,
  ErrorCarga,
  Estado,
  Fila,
  Grupo,
  Interruptor,
  SoloLectura,
} from "./ui";
import { useSiteConfig, type EditorSiteConfig } from "./usarSiteConfig";

/** Envoltorio común de las vistas que editan la configuración del sitio. */
function VistaSiteConfig({
  clave,
  titulo,
  descripcion,
  children,
}: {
  clave: string;
  titulo: string;
  descripcion: string;
  children: (editor: EditorSiteConfig & { config: SiteConfig }) => React.ReactNode;
}) {
  const editor = useSiteConfig(clave);
  return (
    <div className="cfg-vista">
      <CabeceraVista titulo={titulo} descripcion={descripcion} />
      {editor.cargando ? (
        <Cargando />
      ) : editor.errorCarga || !editor.config ? (
        <ErrorCarga mensaje={editor.errorCarga ?? "Sin datos."} onReintentar={editor.recargar} />
      ) : (
        <form
          className="cfg-form"
          onSubmit={(e) => {
            e.preventDefault();
            void editor.guardar();
          }}
        >
          {children(editor as EditorSiteConfig & { config: SiteConfig })}
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

function Texto({
  id,
  etiqueta,
  valor,
  onCambiar,
  ayuda,
  placeholder,
  tipo = "text",
  maximo,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  ayuda?: string;
  placeholder?: string;
  tipo?: string;
  maximo?: number;
}) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type={tipo}
        value={valor ?? ""}
        maxLength={maximo}
        placeholder={placeholder}
        onChange={(e) => onCambiar(e.target.value)}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
      />
      {ayuda && (
        <p className="campo-ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

// ======================================================================= identidad
export function IdentidadVista() {
  return (
    <VistaSiteConfig
      clave="negocio/identidad"
      titulo="Identidad"
      descripcion="El nombre y el logo con los que tus clientes reconocen tu negocio, en la tienda y en este panel."
    >
      {({ config, campo, logo, setLogo }) => (
        <>
          <Grupo titulo="Marca">
            <div className="cfg-identidad">
              <MediaField
                valor={logo}
                urlActual={config.logo_url}
                onCambiar={setLogo}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                ayuda="Aparece en la tienda, en el menú del panel y en tus informes."
              />
              <div>
                <Texto
                  id="cfg-nombre"
                  etiqueta="Nombre del negocio"
                  valor={config.nombre_empresa}
                  onCambiar={(v) => campo("nombre_empresa", v)}
                  placeholder="Ej: La Gran Cosecha"
                  maximo={150}
                />
                <div className="campo">
                  <label htmlFor="cfg-historia">Historia</label>
                  <textarea
                    id="cfg-historia"
                    rows={3}
                    value={config.historia}
                    onChange={(e) => campo("historia", e.target.value)}
                    aria-describedby="cfg-historia-ayuda"
                  />
                  <p className="campo-ayuda" id="cfg-historia-ayuda">
                    Se usa en Google y en el buscador de la tienda.
                  </p>
                </div>
                <div className="campo">
                  <label htmlFor="cfg-mision">Misión</label>
                  <textarea id="cfg-mision" rows={2} value={config.mision} onChange={(e) => campo("mision", e.target.value)} />
                </div>
              </div>
            </div>
          </Grupo>
          <Grupo titulo="Redes sociales" descripcion="Se enlazan desde el pie de página de la tienda.">
            <div className="cfg-rejilla-3">
              <Texto id="cfg-ig" etiqueta="Instagram" tipo="url" valor={config.instagram_url} onCambiar={(v) => campo("instagram_url", v)} placeholder="https://instagram.com/tu_negocio" />
              <Texto id="cfg-fb" etiqueta="Facebook" tipo="url" valor={config.facebook_url} onCambiar={(v) => campo("facebook_url", v)} placeholder="https://facebook.com/tu_negocio" />
              <Texto id="cfg-tk" etiqueta="TikTok" tipo="url" valor={config.tiktok_url} onCambiar={(v) => campo("tiktok_url", v)} placeholder="https://tiktok.com/@tu_negocio" />
            </div>
          </Grupo>
        </>
      )}
    </VistaSiteConfig>
  );
}

// ======================================================================= contacto
export function ContactoVista() {
  return (
    <VistaSiteConfig
      clave="negocio/contacto"
      titulo="Contacto y atención"
      descripcion="Cómo te encuentran y te escriben tus clientes desde la tienda."
    >
      {({ config, campo }) => (
        <>
          <Grupo titulo="Canales">
            <div className="cfg-rejilla-2">
              <Texto id="cfg-wa" etiqueta="WhatsApp (con indicativo, sin «+»)" valor={config.whatsapp_numero} onCambiar={(v) => campo("whatsapp_numero", v)} placeholder="573001234567" />
              <Texto id="cfg-tel" etiqueta="Teléfono" tipo="tel" valor={config.telefono} onCambiar={(v) => campo("telefono", v)} />
              <Texto id="cfg-mail" etiqueta="Correo" tipo="email" valor={config.email} onCambiar={(v) => campo("email", v)} />
              <Texto id="cfg-horario" etiqueta="Horario de atención" valor={config.horario} onCambiar={(v) => campo("horario", v)} placeholder="Lun a sáb, 7:00 a. m. – 6:00 p. m." />
            </div>
          </Grupo>
          <Grupo titulo="Ubicación">
            <div className="cfg-rejilla-2">
              <Texto id="cfg-dir" etiqueta="Dirección" valor={config.direccion} onCambiar={(v) => campo("direccion", v)} />
              <Texto id="cfg-ciudad" etiqueta="Ciudad" valor={config.ciudad} onCambiar={(v) => campo("ciudad", v)} />
            </div>
          </Grupo>
          <Grupo titulo="Mensaje al confirmar un pedido" descripcion="Lo envía la tienda por WhatsApp cuando el cliente termina su pedido.">
            <div className="campo">
              <label htmlFor="cfg-wa-msg" className="cfg-sr">
                Mensaje de WhatsApp
              </label>
              <textarea
                id="cfg-wa-msg"
                rows={2}
                value={config.whatsapp_mensaje_pedido}
                onChange={(e) => campo("whatsapp_mensaje_pedido", e.target.value)}
                aria-describedby="cfg-wa-msg-ayuda"
              />
              <p className="campo-ayuda" id="cfg-wa-msg-ayuda">
                Puedes usar {"{nombre}"}, {"{pedido_id}"} y {"{total}"}.
              </p>
            </div>
          </Grupo>
        </>
      )}
    </VistaSiteConfig>
  );
}

// ======================================================================= clientes
const OPCIONES_IDENTIFICACION: {
  valor: NonNullable<SiteConfig["identificacion_clientes"]>;
  titulo: string;
  texto: string;
  proximamente?: boolean;
}[] = [
  { valor: "nombre", titulo: "Solo nombre", texto: "El cliente escribe su nombre, teléfono y dirección en cada pedido." },
  {
    valor: "cedula",
    titulo: "Cédula",
    texto: "Se identifica con su cédula: da sus datos en el primer pedido y después puede consultar y repetir sus pedidos.",
  },
  {
    valor: "cuenta",
    titulo: "Usuario y contraseña",
    texto: "Cada cliente con su cuenta e inicio de sesión.",
    proximamente: true,
  },
];

export function ClientesVista() {
  return (
    <VistaSiteConfig
      clave="negocio/clientes"
      titulo="Clientes de la tienda"
      descripcion="Qué pide la tienda para reconocer a un cliente que vuelve a comprar."
    >
      {({ config, campo }) => (
        <Grupo sinRelleno>
          <div role="radiogroup" aria-label="Cómo se identifican tus clientes">
            {OPCIONES_IDENTIFICACION.map((op) => {
              const elegida = (config.identificacion_clientes ?? "nombre") === op.valor;
              return (
                <label key={op.valor} className={`cfg-fila cfg-opcion ${elegida ? "elegida" : ""} ${op.proximamente ? "deshabilitada" : ""}`}>
                  <input
                    type="radio"
                    name="identificacion_clientes"
                    value={op.valor}
                    checked={elegida}
                    disabled={op.proximamente}
                    onChange={() => campo("identificacion_clientes", op.valor)}
                  />
                  <span className="cfg-fila-texto">
                    <span className="cfg-fila-titulo">
                      {op.titulo}
                      {op.proximamente && <Estado tipo="neutro">Próximamente</Estado>}
                      {elegida && <Estado tipo="activo">En uso</Estado>}
                    </span>
                    <span className="cfg-fila-desc">{op.texto}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Grupo>
      )}
    </VistaSiteConfig>
  );
}

// ======================================================================= facturación
export function FacturacionVista() {
  return (
    <VistaSiteConfig
      clave="negocio/facturacion"
      titulo="Facturación"
      descripcion="Los datos y el aspecto de la factura en PDF de cada pedido."
    >
      {({ config, campo, facturaLogo, setFacturaLogo }) => (
        <>
          <Grupo titulo="Datos fiscales">
            <div className="cfg-rejilla-2">
              <Texto id="cfg-f-empresa" etiqueta="Nombre en el encabezado" valor={config.nombre_empresa} onCambiar={(v) => campo("nombre_empresa", v)} ayuda="Es el mismo nombre del negocio." />
              <Texto id="cfg-f-eslogan" etiqueta="Eslogan o subtítulo" valor={config.factura_eslogan} onCambiar={(v) => campo("factura_eslogan", v)} placeholder="Distribuidora mayorista" />
              <Texto id="cfg-f-nit" etiqueta="NIT" valor={config.factura_nit} onCambiar={(v) => campo("factura_nit", v)} />
              <Texto id="cfg-f-prov" etiqueta="Razón social" valor={config.factura_proveedor} onCambiar={(v) => campo("factura_proveedor", v)} />
              <Texto id="cfg-f-tel" etiqueta="Teléfono" valor={config.factura_telefono} onCambiar={(v) => campo("factura_telefono", v)} />
              <Texto id="cfg-f-dir" etiqueta="Dirección" valor={config.factura_direccion} onCambiar={(v) => campo("factura_direccion", v)} />
              <Texto id="cfg-f-chip" etiqueta="Insignia junto a la razón social" valor={config.factura_chip_secundario} onCambiar={(v) => campo("factura_chip_secundario", v)} placeholder="Vacío no muestra ninguna" />
              <Texto
                id="cfg-f-pie"
                etiqueta="Nota al pie"
                valor={config.factura_nota_pie}
                onCambiar={(v) => campo("factura_nota_pie", v)}
                placeholder={`Vacío: «¡Gracias por preferir la calidad de ${config.nombre_empresa || "tu empresa"}!»`}
              />
            </div>
          </Grupo>
          <Grupo titulo="Logo y marca de agua" sinRelleno>
            <div className="cfg-grupo-relleno">
              <MediaField
                valor={facturaLogo}
                urlActual={config.factura_logo_url}
                onCambiar={setFacturaLogo}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                ayuda="Opcional: sin uno propio, la factura usa el logo del negocio."
              />
            </div>
            <Fila titulo="Tinte verde institucional" descripcion="Tiñe el logo para que combine con la factura. Apágalo si tu logo ya tiene sus colores.">
              <Interruptor etiqueta="Tinte verde institucional" activo={config.factura_aplicar_tinte_logo} onCambiar={(v) => campo("factura_aplicar_tinte_logo", v)} />
            </Fila>
            <Fila titulo="Marca de agua" descripcion="Texto en diagonal sobre toda la factura.">
              <Interruptor etiqueta="Marca de agua" activo={config.factura_marca_agua_activa} onCambiar={(v) => campo("factura_marca_agua_activa", v)} />
            </Fila>
            {config.factura_marca_agua_activa && (
              <div className="cfg-grupo-relleno cfg-rejilla-2">
                <Texto
                  id="cfg-f-agua"
                  etiqueta="Texto de la marca de agua"
                  valor={config.factura_marca_agua_texto}
                  onCambiar={(v) => campo("factura_marca_agua_texto", v)}
                  placeholder={config.nombre_empresa || "Nombre de la empresa"}
                />
                <div className="campo">
                  <label htmlFor="cfg-f-opacidad">Opacidad ({config.factura_marca_agua_opacidad}%)</label>
                  <input
                    id="cfg-f-opacidad"
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    value={config.factura_marca_agua_opacidad}
                    onChange={(e) => campo("factura_marca_agua_opacidad", Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </Grupo>
        </>
      )}
    </VistaSiteConfig>
  );
}

// ======================================================================= operación y módulos
function usePerfilYModulos() {
  const [perfil, setPerfil] = useState<PerfilNegocio | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [p, m] = await Promise.all([obtenerPerfil(), obtenerModulos()]);
      setPerfil(p);
      setModulos(m);
    } catch (e) {
      setError(extraerMensajeError(e, "No se pudo cargar la configuración del negocio."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { perfil, setPerfil, modulos, setModulos, cargando, error, cargar };
}

export function OperacionVista() {
  const { usuario } = useAuth();
  // Las capacidades deciden cómo se comporta el negocio entero: las ve todo
  // el equipo y las cambia el dueño o un administrador.
  const puedeEditar = Boolean(usuario?.es_administrador);
  const { perfil, setPerfil, cargando, error, cargar } = usePerfilYModulos();
  const [guardando, setGuardando] = useState<string | null>(null);

  async function alternar(codigo: string, valor: boolean) {
    if (!perfil) return;
    const antes = perfil.capacidades;
    // Optimista: el interruptor responde al instante y se revierte si falla.
    setPerfil({ ...perfil, capacidades: { ...antes, [codigo]: valor } });
    setGuardando(codigo);
    try {
      const actualizado = await guardarPerfil({ capacidades: { ...antes, [codigo]: valor } });
      setPerfil((p) => (p ? { ...p, ...actualizado } : p));
      alertaExito("Cambio guardado");
    } catch (e) {
      setPerfil((p) => (p ? { ...p, capacidades: antes } : p));
      alertaError(extraerMensajeError(e, "No se pudo guardar el cambio."));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo="Cómo trabajas"
        descripcion={
          perfil?.preset_nombre
            ? `Partiste de «${perfil.preset_nombre}». Ajusta lo que no encaje: cada cambio se guarda al instante.`
            : "Lo que describe a tu negocio. Cada cambio se guarda al instante."
        }
      />
      {cargando ? (
        <Cargando />
      ) : error || !perfil ? (
        <ErrorCarga mensaje={error ?? "Sin datos."} onReintentar={cargar} />
      ) : !perfil.esta_configurado ? (
        puedeEditar ? (
          <AltaGuiada
            onConfigurado={() => {
              void cargar();
              alertaExito("Listo. Tu negocio ya está configurado.");
            }}
          />
        ) : (
          <SoloLectura>Este negocio todavía no está configurado. Pídeselo al dueño de la cuenta.</SoloLectura>
        )
      ) : (
        <>
          {!puedeEditar && <SoloLectura>Solo el dueño o un administrador puede cambiar esta configuración.</SoloLectura>}
          <Grupo sinRelleno>
            {perfil.catalogo_capacidades.map((cap) => {
              const activo = perfil.capacidades[cap.codigo] ?? cap.defecto;
              return (
                <Fila key={cap.codigo} titulo={cap.nombre} descripcion={cap.descripcion}>
                  <Interruptor
                    etiqueta={cap.nombre}
                    activo={activo}
                    deshabilitado={!puedeEditar || guardando !== null}
                    onCambiar={(v) => alternar(cap.codigo, v)}
                  />
                </Fila>
              );
            })}
          </Grupo>
        </>
      )}
    </div>
  );
}

export function ModulosVista() {
  const { usuario } = useAuth();
  const puedeEditar = Boolean(usuario?.es_administrador);
  const { modulos, setModulos, cargando, error, cargar } = usePerfilYModulos();
  const [guardando, setGuardando] = useState<string | null>(null);

  async function alternar(m: Modulo, valor: boolean) {
    setGuardando(m.slug);
    try {
      setModulos(await cambiarModulo(m.slug, valor));
      alertaExito(valor ? `${m.nombre} activado` : `${m.nombre} desactivado`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo cambiar el módulo."));
    } finally {
      setGuardando(null);
    }
  }

  const activos = modulos.filter((m) => m.disponible && m.activo).length;
  const noIncluidos = modulos.filter((m) => !m.disponible).length;

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo="Módulos"
        descripcion="Enciende solo lo que usas. Ves también lo que tu plan aún no incluye, para que sepas que existe."
        acciones={
          !cargando && !error ? (
            <span className="cfg-resumen">
              <Estado tipo="activo">{activos} activos</Estado>
              {noIncluidos > 0 && <Estado tipo="bloqueado">{noIncluidos} fuera del plan</Estado>}
            </span>
          ) : undefined
        }
      />
      {cargando ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga mensaje={error} onReintentar={cargar} />
      ) : (
        <>
          {!puedeEditar && <SoloLectura>Solo el dueño o un administrador puede activar o desactivar módulos.</SoloLectura>}
          <Grupo sinRelleno>
            {modulos.map((m) => {
              const estado = !m.disponible ? (
                <Estado tipo="bloqueado">No incluido en tu plan</Estado>
              ) : m.activo ? (
                <Estado tipo="activo">Activo</Estado>
              ) : (
                <Estado tipo="inactivo">Desactivado</Estado>
              );
              return (
                <Fila key={m.slug} titulo={m.nombre} descripcion={m.descripcion} estado={estado} deshabilitada={!m.disponible}>
                  <Interruptor
                    etiqueta={m.nombre}
                    activo={m.activo && m.disponible}
                    deshabilitado={!puedeEditar || !m.disponible || guardando !== null}
                    onCambiar={(v) => alternar(m, v)}
                  />
                </Fila>
              );
            })}
          </Grupo>
        </>
      )}
    </div>
  );
}
