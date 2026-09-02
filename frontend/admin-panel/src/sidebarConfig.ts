import {
  Boxes,
  Building2,
  CalendarClock,
  ScanLine,
  Image as ImageIcon,
  LayoutTemplate,
  LayoutDashboard,
  Package,
  PackagePlus,
  Receipt,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NodoSidebar, Usuario } from "./types";
import { tienePermiso } from "./utils";

export interface SeccionDisponible {
  clave: string;
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Codename requerido para ver esta sección; sin permiso, no se muestra. */
  permiso?: string;
}

export const SECCIONES_DISPONIBLES: SeccionDisponible[] = [
  { clave: "dashboard", to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { clave: "catalogo", to: "/productos", label: "Catálogo", icon: Package, permiso: "catalog.view_producto" },
  {
    clave: "caja",
    to: "/caja",
    label: "Caja",
    icon: ScanLine,
    permiso: "pos.add_venta",
  },
  {
    clave: "reservas",
    to: "/reservas",
    label: "Reservas",
    icon: CalendarClock,
    permiso: "reservations.view_reserva",
  },
  {
    clave: "inventario",
    to: "/inventario",
    label: "Inventario",
    icon: Boxes,
    permiso: "inventory.view_existencia",
  },
  { clave: "pedidos", to: "/pedidos", label: "Pedidos", icon: Receipt, permiso: "orders.view_pedido" },
  {
    clave: "productos_pendientes",
    to: "/productos-pendientes",
    label: "Productos pendientes",
    icon: PackagePlus,
    permiso: "orders.view_pedido",
  },
  { clave: "clientes", to: "/clientes", label: "Clientes", icon: Users, permiso: "orders.view_cliente" },
  { clave: "usuarios", to: "/usuarios", label: "Usuarios", icon: ShieldCheck, permiso: "accounts.view_usuario" },
  { clave: "contenido", to: "/contenido", label: "Contenido", icon: ImageIcon, permiso: "content.view_promobanner" },
  { clave: "negocio", to: "/negocio", label: "Tu negocio", icon: Building2 },
  // El constructor cambia lo que ven los visitantes, asi que pide el mismo
  // permiso que administrar el contenido de la tienda: quien puede cambiar los
  // banners puede cambiar donde van.
  { clave: "tienda", to: "/tienda", label: "Tu tienda", icon: LayoutTemplate, permiso: "content.view_promobanner" },
];

function puedeVerSeccion(usuario: Usuario | null | undefined, seccion: SeccionDisponible): boolean {
  return !seccion.permiso || tienePermiso(usuario ?? null, seccion.permiso);
}

const SECCIONES_POR_CLAVE = new Map(SECCIONES_DISPONIBLES.map((s) => [s.clave, s]));

/** Misma agrupación visual que existía antes de que el sidebar fuera personalizable. */
export const LAYOUT_POR_DEFECTO: NodoSidebar[] = [
  {
    tipo: "grupo",
    id: "operacion",
    titulo: "Operación",
    items: [
      "dashboard",
      "caja",
      "reservas",
      "catalogo",
      "inventario",
      "pedidos",
      "productos_pendientes",
      "clientes",
    ],
  },
  {
    tipo: "grupo",
    id: "administracion",
    titulo: "Administración",
    items: ["usuarios", "contenido", "negocio"],
  },
];

export type NodoSidebarResuelto =
  | { tipo: "item"; seccion: SeccionDisponible }
  | { tipo: "grupo"; id: string; titulo: string; secciones: SeccionDisponible[] };

/**
 * Convierte el `sidebar_layout` guardado (claves) en nodos listos para
 * renderizar (con el ícono/label/ruta ya resueltos), usando la estructura
 * por defecto si el usuario no ha personalizado nada, y descartando
 * silenciosamente claves que ya no existan en el catálogo.
 */
export function resolverEstructura(
  layout: NodoSidebar[] | null | undefined,
  usuario: Usuario | null | undefined
): NodoSidebarResuelto[] {
  const fuente = layout && layout.length > 0 ? layout : LAYOUT_POR_DEFECTO;
  const resultado: NodoSidebarResuelto[] = [];

  for (const nodo of fuente) {
    if (nodo.tipo === "item") {
      const seccion = SECCIONES_POR_CLAVE.get(nodo.clave);
      if (seccion && puedeVerSeccion(usuario, seccion)) resultado.push({ tipo: "item", seccion });
    } else {
      const secciones = nodo.items
        .map((clave) => SECCIONES_POR_CLAVE.get(clave))
        .filter((s): s is SeccionDisponible => !!s && puedeVerSeccion(usuario, s));
      if (secciones.length > 0) {
        resultado.push({ tipo: "grupo", id: nodo.id, titulo: nodo.titulo, secciones });
      }
    }
  }

  return resultado;
}
