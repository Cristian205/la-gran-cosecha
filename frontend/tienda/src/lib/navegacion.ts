import {
  BadgePercent,
  ClipboardList,
  Heart,
  Home,
  Info,
  LayoutGrid,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export interface EnlaceNav {
  to: string;
  label: string;
  /** Etiqueta corta para la barra inferior en móvil, donde el ancho es escaso. */
  labelCorto: string;
  icono: LucideIcon;
  fin: boolean;
}

/**
 * Única fuente de los enlaces del sitio: la navegación de escritorio (Navbar)
 * y la barra inferior de móvil (BottomNav) deben mostrar siempre lo mismo.
 */
export const ENLACES: EnlaceNav[] = [
  { to: "/", label: "Inicio", labelCorto: "Inicio", icono: Home, fin: true },
  { to: "/tienda", label: "Tienda", labelCorto: "Tienda", icono: Store, fin: false },
  { to: "/nosotros", label: "Nosotros", labelCorto: "Nosotros", icono: Info, fin: false },
  { to: "/contacto", label: "Contáctanos", labelCorto: "Contacto", icono: Phone, fin: false },
];


/**
 * ¿Está activo este enlace de la navegación?
 *
 * En la tienda anterior lo resolvía `NavLink` de react-router con su
 * `isActive`. Next no tiene equivalente: se compara la ruta actual a mano.
 * `exacto` distingue "/" —que si no estaría activo en toda la tienda— de las
 * secciones, donde una subruta también cuenta.
 */
export function enlaceActivo(pathname: string, destino: string, exacto = false): boolean {
  return exacto ? pathname === destino : pathname === destino || pathname.startsWith(destino + "/");
}

// ---------------------------------------------------------------------------
// Navegación móvil configurable (bloque «cabecera», propiedad `nav_movil`)
// ---------------------------------------------------------------------------

/**
 * Qué hace cada opción de la barra inferior. Las cuatro primeras son
 * FUNCIONES de la tienda, no enlaces: "buscar" abre el buscador, "pedido" el
 * carrito con su contador y "cuenta" solo existe si el negocio identifica a
 * sus clientes. "enlace" es la puerta para lo demás (Contacto, Ofertas…).
 */
export type TipoNavMovil = "inicio" | "buscar" | "tienda" | "pedido" | "cuenta" | "enlace";

export interface OpcionNavMovil {
  tipo: TipoNavMovil;
  /** Vacío: el texto por defecto del tipo. */
  texto?: string;
  /** Nombre de `ICONOS_NAV`. Vacío: el icono por defecto del tipo. */
  icono?: string;
  /** Solo para "enlace" (y para cambiar el destino de "tienda"/"cuenta"). */
  href?: string;
}

/**
 * Los iconos que la navegación puede nombrar desde el panel. Son de trazo
 * (lucide) y no los 3D de `bloques/iconos.ts`: aquí son FUNCIONALES, siguen el
 * color del tema y tienen que leerse a 22 px.
 */
export const ICONOS_NAV: Record<string, LucideIcon> = {
  inicio: Home,
  buscar: Search,
  tienda: Store,
  pedido: ShoppingBag,
  cuenta: UserRound,
  contacto: Phone,
  nosotros: Info,
  whatsapp: MessageCircle,
  ofertas: BadgePercent,
  favoritos: Heart,
  categorias: LayoutGrid,
  pedidos: ClipboardList,
};

export const POR_DEFECTO_NAV: Record<TipoNavMovil, { texto: string; icono: string; href: string }> = {
  inicio: { texto: "Inicio", icono: "inicio", href: "/" },
  buscar: { texto: "Buscar", icono: "buscar", href: "" },
  tienda: { texto: "Tienda", icono: "tienda", href: "/tienda" },
  pedido: { texto: "Pedido", icono: "pedido", href: "" },
  cuenta: { texto: "Cuenta", icono: "cuenta", href: "/tienda/mis-pedidos" },
  enlace: { texto: "Enlace", icono: "contacto", href: "/contacto" },
};

/**
 * ¿La tienda tiene "cuenta" de cliente? Hoy la hay cuando el negocio
 * identifica por cédula (el cliente consulta y repite sus pedidos) o, cuando
 * exista, por usuario y contraseña. Con "solo nombre" no hay nada que
 * consultar: la opción se esconde sola y el resto se reparte el ancho.
 */
export function tiendaConCuenta(identificacion: string | undefined): boolean {
  return identificacion === "cedula" || identificacion === "cuenta";
}
