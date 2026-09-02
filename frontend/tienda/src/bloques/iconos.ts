import {
  Bath,
  Brush,
  Building2,
  ClipboardList,
  Clock,
  Coffee,
  Droplets,
  Flower2,
  Gem,
  Gift,
  Headset,
  Heart,
  Leaf,
  Lock,
  Mail,
  Package,
  BadgePercent,
  Rabbit,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  SprayCan,
  Star,
  Store,
  Tag,
  Truck,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Los iconos que un bloque puede nombrar desde sus propiedades.
 *
 * Es el mismo contrato que el registro de bloques, un nivel más abajo: los
 * datos NOMBRAN («truck») y el código decide qué dibujo es eso. La alternativa
 * —guardar el SVG en la base— ataría el contenido de cada negocio a la librería
 * de iconos que usemos hoy, y cambiarla obligaría a reescribir mil filas.
 *
 * Está aquí, compartido, y no dentro de cada bloque, porque un icono llamado
 * «truck» tiene que ser el mismo camión en la portada, en los pasos y en las
 * insignias. Con un mapa por componente eso dura hasta que alguien añade uno
 * en un sitio y no en el otro.
 *
 * La lista es corta a propósito: son los que el catálogo del backend ofrece
 * hoy. Añadir uno es una línea aquí y una opción más allá.
 */
export const ICONOS: Record<string, LucideIcon> = {
  hoja: Leaf,
  escudo: ShieldCheck,
  camion: Truck,
  soporte: Headset,
  reloj: Clock,
  chispa: Sparkles,
  corazon: Heart,
  caja: Package,
  canasta: ShoppingBasket,
  lista: ClipboardList,
  buscar: Search,
  tienda: Store,
  restaurante: UtensilsCrossed,
  cafeteria: Coffee,
  edificio: Building2,

  // Los que trajo la plantilla de boutique. Un icono se anade aqui y se puede
  // nombrar desde cualquier bloque: la lista es compartida a proposito, para
  // que «corazon» sea el mismo corazon en la portada, en los pasos y en la
  // barra de categorias.
  flor: Flower2,
  pincel: Brush,
  tijeras: Scissors,
  gotas: Droplets,
  bano: Bath,
  perfume: SprayCan,
  joya: Gem,
  etiqueta: Tag,
  descuento: BadgePercent,
  conejo: Rabbit,
  candado: Lock,
  usuario: User,
  sobre: Mail,
  estrella: Star,
  regalo: Gift,
};

/**
 * El icono con ese nombre, o uno de respaldo.
 *
 * Nunca devuelve `undefined`: el catálogo del backend y este mapa se despliegan
 * por separado, así que durante unos minutos pueden no coincidir, y una tienda
 * no puede quedarse sin pintar una sección por un nombre que aún no existe.
 * Es el mismo criterio que el registro de bloques aplica a un tipo desconocido.
 */
export function icono(nombre: string | undefined, respaldo: LucideIcon = Leaf): LucideIcon {
  return ICONOS[nombre ?? ""] ?? respaldo;
}
