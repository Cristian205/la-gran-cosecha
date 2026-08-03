// Genera la escala completa de verdes (--verde-100..900) a partir de un solo
// color elegido por el admin, preservando la misma "forma" de la escala
// original (la diferencia de luminosidad entre pasos), y la aplica como
// variables CSS en :root para reteñir todo el sitio sin tocar el CSS.

const ESCALA_BASE: Record<string, string> = {
  "900": "#062e1a",
  "800": "#0a3d23",
  "700": "#0f5132",
  "600": "#15803d",
  "500": "#16a34a",
  "400": "#22c55e",
  "300": "#4ade80",
  "100": "#dcfce7",
};

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

export function aplicarColorPrimario(hexBase: string | null | undefined) {
  if (!hexBase || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexBase)) return;

  const [, , lBase] = rgbAHsl(...hexARgb(ESCALA_BASE["500"]));
  const [hAdmin, sAdmin, lAdmin] = rgbAHsl(...hexARgb(hexBase));

  const root = document.documentElement.style;
  for (const [paso, hexDefault] of Object.entries(ESCALA_BASE)) {
    const [, , lPaso] = rgbAHsl(...hexARgb(hexDefault));
    const delta = lPaso - lBase;
    const lNueva = Math.min(97, Math.max(3, lAdmin + delta));
    root.setProperty(`--verde-${paso}`, hslAHex(hAdmin, sAdmin, lNueva));
  }
}
