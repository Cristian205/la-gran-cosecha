import {
  Bike,
  Boxes,
  CalendarClock,
  ClipboardList,
  ScanLine,
  LayoutTemplate,
  LayoutDashboard,
  Package,
  PackagePlus,
  Settings2,
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
  /**
   * El contador que acompaña a la sección, si lo tiene: una clave del resumen
   * que el panel ya consulta (`/admin/stats/`). Solo se pinta cuando es mayor
   * que cero — un "0" al lado de cada opción es ruido, no información.
   */
  badge?: ContadorDeSeccion;
  /** Cómo se lee el contador ("4 por atender"), para el lector de pantalla y el tooltip. */
  badgeTexto?: (n: number) => string;
}

/** Los contadores reales que alimentan los badges del menú. */
export type ContadorDeSeccion = "pedidos_pendientes" | "productos_por_revisar";

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
    clave: "domicilios",
    to: "/domicilios",
    label: "Domicilios",
    icon: Bike,
    permiso: "delivery.view_envio",
  },
  {
    clave: "inventario",
    to: "/inventario",
    label: "Inventario",
    icon: Boxes,
    permiso: "inventory.view_existencia",
  },
  {
    clave: "pedidos",
    to: "/pedidos",
    label: "Pedidos",
    // El mismo ícono que el indicador de Pedidos del dashboard.
    icon: ClipboardList,
    permiso: "orders.view_pedido",
    badge: "pedidos_pendientes",
    badgeTexto: (n) => `${n} ${n === 1 ? "pendiente" : "pendientes"}`,
  },
  {
    // Productos que los clientes escribieron a mano en un pedido y que esperan
    // que alguien los apruebe (entran al catálogo) o los rechace.
    clave: "productos_pendientes",
    to: "/productos-pendientes",
    label: "Productos pendientes",
    icon: PackagePlus,
    permiso: "orders.view_pedido",
    badge: "productos_por_revisar",
    badgeTexto: (n) => `${n} por revisar`,
  },
  { clave: "clientes", to: "/clientes", label: "Clientes", icon: Users, permiso: "orders.view_cliente" },
  { clave: "usuarios", to: "/usuarios", label: "Usuarios", icon: ShieldCheck, permiso: "accounts.view_usuario" },
  // Tu negocio, datos generales, páginas y todo el contenido de la tienda.
  // Sin permiso propio: «Tu negocio» lo ve todo el equipo y cada pestaña de
  // contenido pide el suyo dentro de la página. (Antes eran «Contenido» y «Tu
  // negocio» por separado; la clave "negocio" ya no existe y un layout
  // guardado que la tenga simplemente la descarta.)
  { clave: "contenido", to: "/contenido", label: "Configuración", icon: Settings2 },
  // El constructor cambia lo que ven los visitantes, asi que pide el mismo
  // permiso que administrar el contenido de la tienda: quien puede cambiar los
  // banners puede cambiar donde van.
  // Las páginas de la tienda y sus secciones: qué se ve, en qué orden, con
  // qué textos e imágenes (el constructor, con borrador y publicar).
  { clave: "tienda", to: "/tienda", label: "Páginas y secciones", icon: LayoutTemplate, permiso: "content.view_promobanner" },
];

function puedeVerSeccion(usuario: Usuario | null | undefined, seccion: SeccionDisponible): boolean {
  return !seccion.permiso || tienePermiso(usuario ?? null, seccion.permiso);
}

const SECCIONES_POR_CLAVE = new Map(SECCIONES_DISPONIBLES.map((s) => [s.clave, s]));

/**
 * El menú de quien no lo ha personalizado, agrupado por para qué se entra:
 * atender la operación del día, cuidar el catálogo, configurar el negocio.
 * Son las mismas secciones de siempre —solo cambia el orden y el grupo—, y
 * quien ya guardó su propio `sidebar_layout` lo conserva tal cual.
 */
export const LAYOUT_POR_DEFECTO: NodoSidebar[] = [
  {
    tipo: "grupo",
    id: "operacion",
    titulo: "Operación",
    items: ["dashboard", "pedidos", "clientes", "domicilios", "caja", "reservas"],
  },
  {
    // "Productos pendientes" vive aquí: aprobarlos es decidir qué entra al
    // catálogo, no atender un pedido.
    tipo: "grupo",
    id: "catalogo",
    titulo: "Catálogo",
    items: ["catalogo", "productos_pendientes", "inventario"],
  },
  {
    // Todo lo que el cliente ve en la tienda pública, sin tocar código.
    tipo: "grupo",
    id: "tienda",
    titulo: "Tienda",
    items: ["tienda"],
  },
  {
    tipo: "grupo",
    id: "administracion",
    titulo: "Configuración",
    items: ["contenido", "usuarios"],
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
