/**
 * El mapa del Control Center.
 *
 * Una sola lista para el menú lateral, las migas de la cabecera y el Command
 * Center: si una sección cambia de nombre, cambia en los tres sitios a la vez.
 * Está agrupada por lo que el administrador viene a hacer, y cada grupo es un
 * dominio que cualquier plantilla futura (CRM, inventario, soporte…) puede
 * repetir con sus propias entradas.
 */
import {
  Activity,
  BookOpen,
  Building2,
  Cable,
  Fingerprint,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wand2,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface Destino {
  to: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Solo coincide con la ruta exacta (el dashboard). */
  exacto?: boolean;
  /** Para el Command Center: otras palabras con que se busca. */
  sinonimos?: string;
  /** Existe en el mapa pero el backend aún no lo respalda del todo. */
  pronto?: boolean;
}

export interface Grupo {
  titulo: string;
  destinos: Destino[];
}

export const GRUPOS: Grupo[] = [
  {
    titulo: "Visión general",
    destinos: [
      { to: "/", etiqueta: "Dashboard", icono: LayoutDashboard, exacto: true, sinonimos: "resumen inicio" },
      { to: "/actividad", etiqueta: "Actividad", icono: Activity, sinonimos: "eventos historial" },
    ],
  },
  {
    titulo: "Negocio",
    destinos: [
      { to: "/empresas", etiqueta: "Empresas", icono: Building2, sinonimos: "clientes negocios tenants" },
      { to: "/usuarios", etiqueta: "Usuarios", icono: Users, sinonimos: "equipo personas" },
      { to: "/suscripciones", etiqueta: "Suscripciones", icono: Receipt, sinonimos: "facturación cobros" },
    ],
  },
  {
    titulo: "Producto",
    destinos: [
      { to: "/productos", etiqueta: "Productos", icono: Package, sinonimos: "soluciones módulos" },
      { to: "/planes", etiqueta: "Planes", icono: Layers, sinonimos: "precios" },
      { to: "/plantillas", etiqueta: "Plantillas", icono: LayoutTemplate, sinonimos: "templates tiendas" },
      { to: "/presets", etiqueta: "Presets", icono: Wand2, sinonimos: "sectores perfiles" },
    ],
  },
  {
    titulo: "Sistema",
    destinos: [
      { to: "/permisos", etiqueta: "Permisos", icono: ShieldCheck, sinonimos: "matriz accesos" },
      { to: "/integraciones", etiqueta: "Integraciones", icono: Cable, sinonimos: "servicios conexiones" },
      { to: "/automatizaciones", etiqueta: "Automatizaciones", icono: Workflow, sinonimos: "whatsapp avisos" },
    ],
  },
  {
    titulo: "Marca",
    destinos: [
      { to: "/marca/identidad", etiqueta: "Identidad", icono: Fingerprint, sinonimos: "logo colores" },
      { to: "/marca/design-system", etiqueta: "Design System", icono: BookOpen, sinonimos: "componentes tokens" },
      { to: "/marca/white-label", etiqueta: "White Label", icono: Palette, sinonimos: "marcas tema" },
    ],
  },
  {
    titulo: "Administración",
    destinos: [
      { to: "/ajustes", etiqueta: "Ajustes", icono: Settings, sinonimos: "configuración cuenta" },
      { to: "/auditoria", etiqueta: "Auditoría", icono: ScrollText, sinonimos: "audit log registro", pronto: true },
    ],
  },
];

export const DESTINOS: Destino[] = GRUPOS.flatMap((g) => g.destinos);

/** El destino al que pertenece una ruta, para las migas. */
export function destinoDe(pathname: string): { grupo: Grupo; destino: Destino } | null {
  let mejor: { grupo: Grupo; destino: Destino } | null = null;
  for (const grupo of GRUPOS) {
    for (const destino of grupo.destinos) {
      const coincide = destino.exacto
        ? pathname === destino.to
        : pathname === destino.to || pathname.startsWith(`${destino.to}/`);
      if (coincide && (!mejor || destino.to.length > mejor.destino.to.length)) {
        mejor = { grupo, destino };
      }
    }
  }
  return mejor;
}
