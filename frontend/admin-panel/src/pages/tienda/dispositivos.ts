/**
 * Las tres pantallas del editor, en un solo sitio.
 *
 * La barra de la vista previa, el «Se ve en» de cada sección y las fotos por
 * dispositivo hablan de las mismas tres pantallas; tenerlas declaradas una vez
 * es lo que permite que elegir «Tablet» en las fotos mueva también la previa.
 *
 * Los tamaños son los de un dispositivo real de cada clase, y caen dentro de
 * los cortes de la tienda: móvil hasta 780 px (fotos), tablet de 781 a 1024.
 */
import { Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react";

export type ClaveDispositivo = "escritorio" | "tablet" | "movil";

export interface Dispositivo {
  clave: ClaveDispositivo;
  nombre: string;
  icono: LucideIcon;
  /** El lienzo lógico de la previa, en px CSS. */
  ancho: number;
  alto: number;
  /** Lo que se recomienda subir para un banner a pantalla completa. */
  recomendado: string;
  /** Proporción del recorte de muestra en el panel (ancho / alto). */
  proporcion: number;
}

export const DISPOSITIVOS: readonly Dispositivo[] = [
  {
    clave: "escritorio",
    nombre: "Escritorio",
    icono: Monitor,
    ancho: 1440,
    alto: 900,
    recomendado: "1920 × 1080 px (horizontal)",
    proporcion: 16 / 9,
  },
  {
    clave: "tablet",
    nombre: "Tablet",
    icono: Tablet,
    ancho: 834,
    alto: 1112,
    recomendado: "1536 × 2048 px (vertical)",
    proporcion: 3 / 4,
  },
  {
    clave: "movil",
    nombre: "Móvil",
    icono: Smartphone,
    ancho: 390,
    alto: 844,
    recomendado: "1080 × 1920 px (vertical)",
    proporcion: 9 / 16,
  },
];

export function dispositivo(clave: ClaveDispositivo): Dispositivo {
  return DISPOSITIVOS.find((d) => d.clave === clave) ?? DISPOSITIVOS[0];
}
