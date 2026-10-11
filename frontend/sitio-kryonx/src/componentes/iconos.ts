import {
  Blocks,
  Fingerprint,
  LayoutTemplate,
  Megaphone,
  MonitorSmartphone,
  Paintbrush,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NombreIcono } from "../contenido/tipos";

/** Los iconos se nombran en el contenido y se resuelven aquí: el contenido no lleva JSX. */
export const ICONOS: Record<NombreIcono, LucideIcon> = {
  pincel: Paintbrush,
  rayo: Zap,
  dispositivos: MonitorSmartphone,
  bloques: Blocks,
  contenido: LayoutTemplate,
  megafono: Megaphone,
  escala: TrendingUp,
  huella: Fingerprint,
};
