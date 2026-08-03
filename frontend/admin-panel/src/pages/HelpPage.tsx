import { useEffect, useState } from "react";
import {
  Bell,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { obtenerSiteConfig } from "../api/content";

interface Seccion {
  icono: typeof LayoutDashboard;
  titulo: string;
  texto: string;
}

const SECCIONES: Seccion[] = [
  {
    icono: LayoutDashboard,
    titulo: "Dashboard",
    texto:
      "Resumen general: caja del día, ventas del mes, pedidos pendientes, productos activos y avance de la meta anual. Más abajo encuentras el gráfico de ventas de los últimos 7 días y un reporte por rango de fechas, exportable a Excel.",
  },
  {
    icono: Package,
    titulo: "Catálogo",
    texto:
      "Administra productos, sus presentaciones (unidades y precios) y categorías. Puedes buscar, filtrar por categoría o estado, y consultar el historial de cambios de precio de cada presentación.",
  },
  {
    icono: Receipt,
    titulo: "Pedidos",
    texto:
      "Consulta, edita, imprime y marca como entregados los pedidos. Los estados posibles son Pendiente, Editado, Cerrado, Entregado e Impreso. Puedes seleccionar varios pedidos y procesarlos juntos como un lote de impresión o entrega, y luego revisar ese historial en la pestaña de lotes.",
  },
  {
    icono: Users,
    titulo: "Clientes",
    texto: "Registra y edita clientes, y consulta su historial de pedidos desde el listado.",
  },
  {
    icono: ShieldCheck,
    titulo: "Usuarios",
    texto:
      "Visible solo para quien tenga el permiso correspondiente. Crea usuarios del panel, asígnales un rol y permisos puntuales por módulo (por ejemplo, quién puede editar productos o eliminar clientes).",
  },
  {
    icono: ImageIcon,
    titulo: "Contenido",
    texto:
      "Controla lo que se ve en la tienda pública: banners de inicio, testimonios, sellos de confianza y la información general (logo, contacto, historia y misión).",
  },
  {
    icono: Settings,
    titulo: "Configuración",
    texto:
      "Cambia el logo y el nombre que aparecen en el menú lateral del panel, y actualiza tu contraseña de acceso.",
  },
  {
    icono: Bell,
    titulo: "Notificaciones",
    texto:
      "El centro de notificaciones avisa de eventos como pedidos y clientes nuevos. Haz clic en una notificación para marcarla como leída y saltar directo al módulo relacionado; el número en el ícono de la campana indica cuántas quedan sin leer.",
  },
];

interface Pregunta {
  q: string;
  a: string;
}

const PREGUNTAS: Pregunta[] = [
  {
    q: "Olvidé mi contraseña, ¿cómo la recupero?",
    a: "Si aún tienes sesión activa, cámbiala desde Configuración → Cambiar contraseña. Si no puedes iniciar sesión, pide a otro usuario con permisos (o al administrador) que la restablezca; el panel no cuenta con recuperación automática por correo.",
  },
  {
    q: "No me llega el código de verificación (OTP) al iniciar sesión",
    a: "Revisa la carpeta de spam o promociones de tu correo y espera unos segundos: el envío puede demorar. Si sigue sin llegar después de un par de intentos, contacta soporte con la hora exacta del intento.",
  },
  {
    q: "No veo un módulo que debería tener disponible",
    a: "El acceso a Usuarios y a ciertas acciones (crear, editar, eliminar) depende de los permisos asignados a tu usuario. Pide al administrador que revise tus permisos en Usuarios → Permisos.",
  },
  {
    q: "Guardé un cambio y no se reflejó",
    a: "Verifica tu conexión a internet y que no haya aparecido un mensaje de error en rojo al guardar. Si el problema persiste, escribe a soporte indicando qué pantalla usabas y, si puedes, adjunta una captura de pantalla del error.",
  },
];

interface Contacto {
  telefono: string;
  whatsapp_numero: string;
  email: string;
}

export function HelpPage() {
  const [contacto, setContacto] = useState<Contacto | null>(null);

  useEffect(() => {
    obtenerSiteConfig()
      .then((c) =>
        setContacto({
          telefono: c.telefono,
          whatsapp_numero: c.whatsapp_numero,
          email: c.email,
        })
      )
      .catch(() => {});
  }, []);

  const tieneContacto =
    contacto && (contacto.telefono || contacto.whatsapp_numero || contacto.email);

  return (
    <>
      <div className="topbar">
        <h1>Centro de ayuda</h1>
      </div>

      <div className="contenido">
        <div className="dos-col">
          <div>
            <div className="panel">
              <div className="cabecera">
                <h2>Guía de módulos</h2>
              </div>
              <div style={{ padding: "0 1.2rem" }}>
                {SECCIONES.map((s) => (
                  <div
                    key={s.titulo}
                    className="perfil-dato"
                    style={{ alignItems: "flex-start" }}
                  >
                    <span className="icono">
                      <s.icono size={18} />
                    </span>
                    <div>
                      <div className="valor" style={{ marginBottom: ".2rem" }}>
                        {s.titulo}
                      </div>
                      <div style={{ fontSize: ".88rem", color: "var(--gris)", lineHeight: 1.5 }}>
                        {s.texto}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="cabecera">
                <h2>Preguntas frecuentes</h2>
              </div>
              <div style={{ padding: "1.2rem" }}>
                {PREGUNTAS.map((p) => (
                  <details key={p.q} className="ayuda-faq">
                    <summary>{p.q}</summary>
                    <p>{p.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="cabecera">
                <h2>
                  <LifeBuoy size={18} style={{ verticalAlign: "-3px", marginRight: ".4rem" }} />
                  Soporte
                </h2>
              </div>
              <div style={{ padding: "1.2rem" }}>
                <p style={{ fontSize: ".88rem", color: "var(--gris)", marginTop: 0 }}>
                  ¿No encontraste lo que buscabas? Escríbenos por cualquiera de estos canales
                  contando qué intentabas hacer y qué error viste.
                </p>
                {!tieneContacto ? (
                  <div className="vacio" style={{ padding: "1.5rem 0" }}>
                    Aún no hay datos de contacto configurados.
                  </div>
                ) : (
                  <div className="mini-lista">
                    {contacto?.telefono && (
                      <div className="mini-item">
                        <span
                          style={{ display: "flex", alignItems: "center", gap: ".5rem" }}
                        >
                          <Phone size={16} /> Teléfono
                        </span>
                        <span>{contacto.telefono}</span>
                      </div>
                    )}
                    {contacto?.whatsapp_numero && (
                      <div className="mini-item">
                        <span
                          style={{ display: "flex", alignItems: "center", gap: ".5rem" }}
                        >
                          <MessageCircle size={16} /> WhatsApp
                        </span>
                        <span>{contacto.whatsapp_numero}</span>
                      </div>
                    )}
                    {contacto?.email && (
                      <div className="mini-item">
                        <span
                          style={{ display: "flex", alignItems: "center", gap: ".5rem" }}
                        >
                          <Mail size={16} /> Correo
                        </span>
                        <span>{contacto.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
