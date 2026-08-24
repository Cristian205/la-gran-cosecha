// Aplica la configuración de apariencia elegida en el admin-panel (colores,
// fuente, forma de los botones, ancho del buscador, espaciado del navbar)
// como variables CSS en :root, para reteñir/reajustar todo el sitio sin
// tocar el CSS estático. Cada pieza es independiente: si un campo viene
// vacío o inválido, simplemente se conserva el valor por defecto del CSS.
import type { SiteConfig } from "./types";

const ESCALA_VERDE: Record<string, string> = {
  "900": "#062e1a",
  "800": "#0a3d23",
  "700": "#0f5132",
  "600": "#15803d",
  "500": "#16a34a",
  "400": "#22c55e",
  "300": "#4ade80",
  "100": "#dcfce7",
};

const ESCALA_AMBAR: Record<string, string> = {
  "600": "#d97706",
  "500": "#f59e0b",
  "400": "#fbbf24",
};

const FUENTES: Record<string, string> = {
  poppins: '"Poppins", "Segoe UI", system-ui, sans-serif',
  inter: '"Inter", "Segoe UI", system-ui, sans-serif',
  nunito: '"Nunito", "Segoe UI", system-ui, sans-serif',
  "work-sans": '"Work Sans", "Segoe UI", system-ui, sans-serif',
  jakarta: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
  quicksand: '"Quicksand", "Segoe UI", system-ui, sans-serif',
};

const RADIOS_BOTON: Record<string, string> = {
  redondeado: "999px",
  suave: "14px",
  cuadrado: "6px",
};

function esHexValido(hex: string | null | undefined): hex is string {
  return !!hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex);
}

function hexARgb(hex: string): [number, number, number] {
  const limpio = hex.replace("#", "");
  const normal = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const bigint = parseInt(normal, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbAHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslAHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Genera la escala completa `--{prefijo}-{paso}` a partir de un solo color
 * elegido por el admin, preservando la diferencia de luminosidad entre pasos
 * de la escala original (misma "forma", distinto tono/tinte).
 */
function aplicarEscala(
  prefijo: string,
  escalaBase: Record<string, string>,
  hexAdmin: string | null | undefined,
  pasoReferencia: string
) {
  if (!esHexValido(hexAdmin)) return;

  const [, , lBase] = rgbAHsl(...hexARgb(escalaBase[pasoReferencia]));
  const [hAdmin, sAdmin, lAdmin] = rgbAHsl(...hexARgb(hexAdmin));

  const root = document.documentElement.style;
  for (const [paso, hexDefault] of Object.entries(escalaBase)) {
    const [, , lPaso] = rgbAHsl(...hexARgb(hexDefault));
    const delta = lPaso - lBase;
    const lNueva = Math.min(97, Math.max(3, lAdmin + delta));
    root.setProperty(`--${prefijo}-${paso}`, hslAHex(hAdmin, sAdmin, lNueva));
  }
}

export function aplicarTema(config: SiteConfig) {
  const root = document.documentElement.style;

  aplicarEscala("verde", ESCALA_VERDE, config.color_primario, "500");
  aplicarEscala("ambar", ESCALA_AMBAR, config.color_secundario, "500");

  if (esHexValido(config.color_fondo)) root.setProperty("--fondo", config.color_fondo);
  if (esHexValido(config.color_texto)) root.setProperty("--gris-900", config.color_texto);
  if (esHexValido(config.color_primario_texto)) {
    root.setProperty("--btn-primario-texto", config.color_primario_texto);
  }
  if (esHexValido(config.color_secundario_texto)) {
    root.setProperty("--btn-secundario-texto", config.color_secundario_texto);
  }
  if (esHexValido(config.color_superficie)) {
    root.setProperty("--superficie", config.color_superficie);
    root.setProperty("--superficie-rgb", hexARgb(config.color_superficie).join(", "));
  }

  root.setProperty("--fuente-sitio", FUENTES[config.fuente] ?? FUENTES.poppins);
  root.setProperty("--btn-radio", RADIOS_BOTON[config.radio_boton] ?? RADIOS_BOTON.redondeado);
  root.setProperty("--buscador-ancho", `${config.ancho_buscador || 420}px`);
  root.setProperty("--navbar-espaciado-logo", `${config.espaciado_navbar || 0}px`);
}
