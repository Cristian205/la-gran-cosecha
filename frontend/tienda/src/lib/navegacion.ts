import { Home, Info, Phone, Store, type LucideIcon } from "lucide-react";

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
