import monograma from "../assets/crafteech-isotipo.webp";
import type { Marca } from "./tipos";

/**
 * Crafteech (antes Kryon X), la marca con la que arranca la plataforma. El `id`
 * sigue siendo `kryon-x`: es la clave con la que se guarda la selección.
 *
 * Sus valores son los mismos que `estilos.css` declara en `:root`: si el motor
 * no llegara a ejecutarse, la interfaz se vería igual.
 */
export const MARCA_KRYON: Marca = {
  id: "kryon-x",
  nombre: "Crafteech",
  lema: "Centro de mando",
  logo: monograma,
  favicon: "/favicon-32x32.png",
  colores: {
    primario: "#b7f34a",
    secundario: "#f5f6f2",
    acento: "#d4ff7a",
  },
  tipografia: "Inter",
  redondez: "media",
  logotipoMetalico: false,
  sistema: true,
};
