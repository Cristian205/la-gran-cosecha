import monograma from "../assets/logo-kryonx-marca-inverso.png";
import type { Marca } from "./tipos";

/**
 * Kryon X, la marca con la que arranca la plataforma.
 *
 * Sus valores son los mismos que `estilos.css` declara en `:root`: si el motor
 * no llegara a ejecutarse, la interfaz se vería igual.
 */
export const MARCA_KRYON: Marca = {
  id: "kryon-x",
  nombre: "Kryon X",
  lema: "Control Center",
  logo: monograma,
  favicon: "/favicon-32x32.png",
  colores: {
    primario: "#d4a63a",
    secundario: "#f5f5f5",
    acento: "#e11d2a",
  },
  tipografia: "Inter",
  redondez: "media",
  logotipoMetalico: true,
  sistema: true,
};
