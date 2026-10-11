/**
 * Lo que comparten el Excel y el PDF: colores derivados del acento y el logo.
 *
 * El acento lo elige el negocio (el color de su marca). Como puede ser
 * cualquier color —también un amarillo claro—, el texto que va encima se
 * elige por contraste en vez de suponerlo blanco.
 */
export const VERDE_PANEL = "#15803d";

function aRgb(hex: string): [number, number, number] {
  const limpio = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : VERDE_PANEL.slice(1);
  return [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16)) as [number, number, number];
}

function aHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Mezcla hacia negro (`p` > 0) o hacia blanco (`p` < 0). */
function mezclar(hex: string, p: number): string {
  const rgb = aRgb(hex);
  return aHex(rgb.map((v) => (p > 0 ? v * (1 - p) : v + (255 - v) * -p)));
}

function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface Paleta {
  acento: string;
  /** Títulos sobre fondo blanco: el acento oscurecido hasta leerse bien. */
  titulo: string;
  /** Fondo de la cabecera de la tabla: el acento, oscurecido si hace falta
   *  para que el texto blanco se lea (≥ 4,5:1). */
  cabecera: string;
  /** Texto sobre `cabecera`: blanco, o casi negro si el acento es claro. */
  sobreAcento: string;
  /** Fondo muy suave del acento (filas alternas, bandas). */
  suave: string;
}

export function paleta(color: string): Paleta {
  const acento = aHex(aRgb(color));
  let titulo = acento;
  // Oscurece hasta un contraste ≥ 4,5:1 sobre blanco (WCAG AA).
  for (let p = 0.1; luminancia(titulo) > 0.18 && p < 0.9; p += 0.1) titulo = mezclar(acento, p);
  // Un acento claro (amarillo, celeste) se queda tal cual con texto oscuro;
  // uno medio o oscuro lleva texto blanco y, si no alcanza el contraste, se
  // oscurece lo justo — igual que el título.
  const claro = luminancia(acento) > 0.45;
  return {
    acento,
    titulo,
    cabecera: claro ? acento : titulo,
    sobreAcento: claro ? "#0f172a" : "#ffffff",
    suave: mezclar(acento, -0.92),
  };
}

/** "#15803d" → "FF15803D", el formato de color de Excel. */
export function argb(hex: string): string {
  return "FF" + hex.replace("#", "").toUpperCase();
}

export interface LogoListo {
  /** PNG en base64 (sin el prefijo `data:`). */
  base64: string;
  ancho: number;
  alto: number;
}

/**
 * Descarga el logo y lo convierte a PNG (Excel no admite WebP).
 *
 * Puede fallar: el logo vive en el almacenamiento de archivos y, si ese
 * dominio no permite leerlo desde el panel (CORS), el navegador lo bloquea.
 * Entonces devuelve null y el informe sale sin logo, avisando, en vez de no
 * salir. El PDF no necesita esto: imprime la imagen directamente.
 */
export async function cargarLogo(url: string, altoMax = 120): Promise<LogoListo | null> {
  try {
    const respuesta = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!respuesta.ok) return null;
    const imagen = await createImageBitmap(await respuesta.blob());
    const escala = Math.min(1, altoMax / imagen.height);
    const ancho = Math.max(1, Math.round(imagen.width * escala));
    const alto = Math.max(1, Math.round(imagen.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, ancho, alto);
    const base64 = lienzo.toDataURL("image/png").split(",")[1];
    return base64 ? { base64, ancho, alto } : null;
  } catch {
    return null;
  }
}

export function fechaGeneracion(): string {
  return new Date().toLocaleString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function sumaColumna(filas: Record<string, unknown>[], clave: string): number {
  return filas.reduce((acc, f) => acc + (Number(f[clave]) || 0), 0);
}
