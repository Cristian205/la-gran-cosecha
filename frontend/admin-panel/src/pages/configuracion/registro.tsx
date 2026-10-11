import type { ComponentType } from "react";
import {
  Blocks,
  Building2,
  FileText,
  FolderOpen,
  Gift,
  ImageIcon,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  Paintbrush,
  Phone,
  Plug,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UserRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { ArchivosTab } from "../content/ArchivosTab";
import { PaginasTab } from "../content/PaginasTab";
import { TrustBadgesTab } from "../content/TrustBadgesTab";
import { AutomatizacionesVista } from "./automatizaciones";
import { AnunciosVista, BannersVista, BeneficiosVista, OfertasVista, TestimoniosVista, VistaEnvuelta } from "./contenido";
import { AparienciaVista, PlantillasVista } from "./diseno";
import { PreferenciasVista, WhatsAppVista } from "./integraciones";
import { ClientesVista, ContactoVista, FacturacionVista, IdentidadVista, ModulosVista, OperacionVista } from "./negocio";

/** Lo que administra el contenido de la tienda: el mismo permiso de siempre. */
export const PERMISO_CONTENIDO = "content.view_promobanner";

export interface ItemConfig {
  /** `categoria/vista`: es la dirección (`?seccion=`). */
  clave: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  /** Sin permiso, la vista no aparece (ni en el menú ni en el buscador). */
  permiso: string | null;
  /** Lo que alguien escribiría para encontrarla. */
  palabras: string;
  Vista: ComponentType;
}

export interface CategoriaConfig {
  clave: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  items: ItemConfig[];
}

const envolver = (titulo: string, descripcion: string, Tab: ComponentType): ComponentType =>
  function VistaHeredada() {
    return (
      <VistaEnvuelta titulo={titulo} descripcion={descripcion}>
        <Tab />
      </VistaEnvuelta>
    );
  };

export const CATEGORIAS: CategoriaConfig[] = [
  {
    clave: "negocio",
    titulo: "Negocio",
    descripcion: "Identidad, datos generales, reglas de operación y módulos.",
    icono: Building2,
    items: [
      { clave: "negocio/identidad", titulo: "Identidad", descripcion: "Nombre, logo, historia y redes sociales.", icono: Tag, permiso: PERMISO_CONTENIDO, palabras: "logo nombre marca empresa historia mision redes instagram facebook tiktok", Vista: IdentidadVista },
      { clave: "negocio/contacto", titulo: "Contacto y atención", descripcion: "WhatsApp, teléfono, correo, dirección y horario.", icono: Phone, permiso: PERMISO_CONTENIDO, palabras: "telefono whatsapp correo email direccion ciudad horario ubicacion mensaje pedido", Vista: ContactoVista },
      { clave: "negocio/operacion", titulo: "Cómo trabajas", descripcion: "Las reglas que describen y gobiernan tu negocio.", icono: SlidersHorizontal, permiso: null, palabras: "capacidades comportamiento stock fraccion peso domicilios pedidos online reglas operacion", Vista: OperacionVista },
      { clave: "negocio/clientes", titulo: "Clientes de la tienda", descripcion: "Cómo se identifica un cliente al comprar.", icono: UserRound, permiso: PERMISO_CONTENIDO, palabras: "cedula identificacion clientes cuenta registro checkout", Vista: ClientesVista },
      { clave: "negocio/modulos", titulo: "Módulos", descripcion: "Activa lo que usas; ve lo que incluye tu plan.", icono: Blocks, permiso: null, palabras: "modulos plan caja pos inventario reservas domicilios activar", Vista: ModulosVista },
      { clave: "negocio/facturacion", titulo: "Facturación", descripcion: "Datos fiscales, logo y marca de agua de la factura.", icono: Receipt, permiso: PERMISO_CONTENIDO, palabras: "factura nit razon social pdf marca de agua eslogan", Vista: FacturacionVista },
    ],
  },
  {
    clave: "diseno",
    titulo: "Diseño",
    descripcion: "Plantillas, colores, tipografía y aspecto de la tienda.",
    icono: Paintbrush,
    items: [
      { clave: "diseno/plantillas", titulo: "Plantillas", descripcion: "Elige el punto de partida de tu tienda.", icono: LayoutTemplate, permiso: PERMISO_CONTENIDO, palabras: "plantilla tema diseño editor visual tienda constructor", Vista: PlantillasVista },
      { clave: "diseno/apariencia", titulo: "Apariencia", descripcion: "Colores, fuente, botones y barra de navegación.", icono: Paintbrush, permiso: PERMISO_CONTENIDO, palabras: "colores fuente tipografia botones navbar buscador vista previa", Vista: AparienciaVista },
    ],
  },
  {
    clave: "contenido",
    titulo: "Contenido",
    descripcion: "Páginas, banners, ofertas y todo lo que se publica.",
    icono: FileText,
    items: [
      { clave: "contenido/paginas", titulo: "Páginas", descripcion: "Los textos de Inicio, Nosotros, Contacto y Tienda.", icono: FileText, permiso: PERMISO_CONTENIDO, palabras: "paginas nosotros inicio textos secciones", Vista: envolver("Páginas", "Los textos de cada página de la tienda. Con vista previa, en el editor visual.", PaginasTab) },
      { clave: "contenido/banners", titulo: "Banners", descripcion: "El carrusel principal del inicio.", icono: ImageIcon, permiso: PERMISO_CONTENIDO, palabras: "banner carrusel portada slider", Vista: BannersVista },
      { clave: "contenido/anuncios", titulo: "Anuncios", descripcion: "Piezas promocionales del inicio.", icono: Megaphone, permiso: PERMISO_CONTENIDO, palabras: "anuncio promocion publicidad", Vista: AnunciosVista },
      { clave: "contenido/ofertas", titulo: "Ofertas", descripcion: "Precios especiales con fecha de fin.", icono: Gift, permiso: PERMISO_CONTENIDO, palabras: "oferta descuento promocion precio especial", Vista: OfertasVista },
      { clave: "contenido/beneficios", titulo: "Beneficios", descripcion: "Envíos, horarios y garantías.", icono: Sparkles, permiso: PERMISO_CONTENIDO, palabras: "beneficio envio garantia ventajas", Vista: BeneficiosVista },
      { clave: "contenido/testimonios", titulo: "Testimonios", descripcion: "Opiniones de tus clientes.", icono: MessageSquareQuote, permiso: PERMISO_CONTENIDO, palabras: "testimonio opinion reseña estrellas", Vista: TestimoniosVista },
      { clave: "contenido/confianza", titulo: "Confianza", descripcion: "Insignias y cifras que dan seguridad.", icono: ShieldCheck, permiso: PERMISO_CONTENIDO, palabras: "confianza insignias sellos estadisticas cifras", Vista: envolver("Confianza", "Insignias y cifras que dan seguridad al comprar.", TrustBadgesTab) },
      { clave: "contenido/archivos", titulo: "Archivos", descripcion: "La biblioteca de imágenes y documentos.", icono: FolderOpen, permiso: PERMISO_CONTENIDO, palabras: "archivos imagenes biblioteca fotos medios", Vista: envolver("Archivos", "Imágenes y documentos para reutilizar en toda la tienda.", ArchivosTab) },
    ],
  },
  {
    clave: "automatizaciones",
    titulo: "Automatizaciones",
    descripcion: "Reglas que envían avisos solas y su registro.",
    icono: Workflow,
    items: [
      { clave: "automatizaciones/reglas", titulo: "Reglas y ejecuciones", descripcion: "Evento, condición, acción y registro de envíos.", icono: Workflow, permiso: null, palabras: "automatizacion reglas eventos avisos notificaciones plantillas historial ejecuciones mensajes", Vista: AutomatizacionesVista },
    ],
  },
  {
    clave: "integraciones",
    titulo: "Integraciones",
    descripcion: "WhatsApp, conexiones y preferencias.",
    icono: Plug,
    items: [
      { clave: "integraciones/whatsapp", titulo: "WhatsApp", descripcion: "Conexión, proveedor, números y bajas.", icono: MessageCircle, permiso: null, palabras: "whatsapp meta twilio conexion proveedor numeros alertas baja exclusiones", Vista: WhatsAppVista },
      { clave: "integraciones/preferencias", titulo: "Preferencias", descripcion: "Tu menú, notificaciones y contraseña.", icono: SlidersHorizontal, permiso: null, palabras: "preferencias menu notificaciones contraseña perfil", Vista: PreferenciasVista },
    ],
  },
];

/** Las pestañas de antes (`?pestana=`) → su vista nueva, para no romper enlaces guardados. */
export const PESTANAS_ANTIGUAS: Record<string, string> = {
  negocio: "negocio/operacion",
  general: "negocio/identidad",
  paginas: "contenido/paginas",
  banners: "contenido/banners",
  anuncios: "contenido/anuncios",
  ofertas: "contenido/ofertas",
  beneficios: "contenido/beneficios",
  testimonios: "contenido/testimonios",
  confianza: "contenido/confianza",
  archivos: "contenido/archivos",
  whatsapp: "integraciones/whatsapp",
};

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
