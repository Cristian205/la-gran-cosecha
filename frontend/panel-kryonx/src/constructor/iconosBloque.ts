/**
 * El ícono de un bloque del catálogo, para la tarjeta del selector visual.
 *
 * `Bloque.icono` viaja del servidor como el nombre de un ícono de Lucide en
 * kebab-case («truck», «layout-panel-top», «log-in») — es el mismo campo que
 * usa la tienda pública para dibujar sus propios íconos de contenido.
 *
 * Se listan a mano y no con `import * as Icons from "lucide-react"` con
 * indexación dinámica a propósito: esa forma es más corta, pero le impide a
 * Rollup saber qué íconos se usan de verdad y obliga a empaquetar la
 * librería entera (mil y pico íconos) en vez de solo los que hacen falta.
 *
 * Un código que el catálogo del servidor traiga y que todavía no esté aquí
 * cae al ícono genérico en vez de romper la tarjeta — la lista se amplía
 * agregando una línea, igual que el registro equivalente de la tienda
 * pública (`frontend/tienda/src/bloques/iconos.ts`).
 */
import {
  BadgeCheck,
  Building2,
  Coffee,
  Image,
  Images,
  LayoutGrid,
  LayoutList,
  LayoutPanelTop,
  LayoutTemplate,
  ListFilter,
  Lock,
  Mail,
  Minus,
  PanelBottom,
  PanelTop,
  Rabbit,
  Scissors,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  SprayCan,
  Tag,
  BadgePercent,
  ClipboardList,
  Truck,
  User,
  UsersRound,
  UtensilsCrossed,
  Bath,
  Brush,
  Droplets,
  Gem,
  Headset,
  Heart,
  Leaf,
  type LucideIcon,
} from "lucide-react";

const ICONOS: Record<string, LucideIcon> = {
  // registro original de bloques (0002 / 0007 / 0009)
  search: Search,
  clipboard: ClipboardList,
  truck: Truck,
  "layout-panel-top": LayoutPanelTop,
  "users-round": UsersRound,
  "panel-top": PanelTop,
  "panel-bottom": PanelBottom,
  hoja: Leaf,
  chispa: Sparkles,

  // «Mercado» / «La Gran Cosecha»
  escudo: ShieldCheck,
  camion: Truck,
  soporte: Headset,
  restaurante: UtensilsCrossed,
  canasta: ShoppingBasket,
  cafeteria: Coffee,
  edificio: Building2,
  lista: ClipboardList,
  caja: ShoppingBasket,

  // biblioteca de bloques y catálogo-como-bloques
  "layout-list": LayoutList,
  "log-in": Lock,
  "layout-grid": LayoutGrid,
  image: Image,
  images: Images,
  "badge-check": BadgeCheck,
  mail: Mail,
  minus: Minus,
  "list-filter": ListFilter,
  "sliders-horizontal": SlidersHorizontal,
  "search-x": SearchX,

  // «Boutique» / «Belleza auténtica»
  usuario: User,
  gotas: Droplets,
  pincel: Brush,
  tijeras: Scissors,
  bano: Bath,
  perfume: SprayCan,
  joya: Gem,
  etiqueta: Tag,
  descuento: BadgePercent,
  candado: Lock,
  corazon: Heart,
  conejo: Rabbit,
};

export function iconoDeBloque(nombre: string | undefined): LucideIcon {
  if (!nombre) return LayoutTemplate;
  return ICONOS[nombre] ?? LayoutTemplate;
}
