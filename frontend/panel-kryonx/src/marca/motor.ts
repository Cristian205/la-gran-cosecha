/**
 * De una marca a tokens CSS.
 *
 * Es la única pieza que traduce colores de marca a variables. Lo que deriva
 * —el tono de hover, el color del texto encima del primario— se calcula aquí
 * para que una marca nueva solo tenga que elegir tres colores y nunca pueda
 * quedar con texto ilegible sobre su propio botón.
 */
import type { Marca, Redondez, Tipografia } from "./tipos";

type Rgb = [number, number, number];

function aRgb(hex: string): Rgb {
  const limpio = hex.replace("#", "").trim();
  const largo = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = Number.parseInt(largo.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [212, 166, 58];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Mezcla dos colores; `peso` es cuánto del segundo entra. */
export function mezclar(a: string, b: string, peso: number): string {
  const x = aRgb(a);
  const y = aRgb(b);
  return aHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * peso) as Rgb);
}

/** Luminancia relativa WCAG. */
export function luminancia(hex: string): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = aRgb(hex).map(canal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** El texto que se lee encima de un color: casi negro o blanco, el que contraste más. */
export function textoSobre(fondo: string): string {
  const oscuro = "#15110a";
  return contraste(fondo, oscuro) >= contraste(fondo, "#ffffff") ? oscuro : "#ffffff";
}

const RADIOS: Record<Redondez, [number, number, number]> = {
  recta: [4, 6, 8],
  media: [8, 12, 16],
  suave: [10, 16, 22],
};

export function tokensDe(marca: Marca): Record<string, string> {
  const { primario, secundario, acento } = marca.colores;
  const [s, m, l] = RADIOS[marca.redondez];
  return {
    "--brand-primary": primario,
    "--brand-primary-strong": mezclar(primario, "#ffffff", 0.16),
    "--brand-on-primary": textoSobre(primario),
    "--brand-secondary": secundario,
    "--brand-accent": acento,
    "--font-sans": `"${marca.tipografia}", "Segoe UI", system-ui, sans-serif`,
    "--radius-sm": `${s}px`,
    "--radius-md": `${m}px`,
    "--radius-lg": `${l}px`,
  };
}

const CARGADAS = new Set<Tipografia>(["Inter"]);

/** Inter ya viene en `index.html`; las demás se piden la primera vez que se usan. */
export function cargarTipografia(nombre: Tipografia): void {
  if (CARGADAS.has(nombre) || typeof document === "undefined") return;
  CARGADAS.add(nombre);
  const enlace = document.createElement("link");
  enlace.rel = "stylesheet";
  enlace.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    nombre
  )}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(enlace);
}

/** Escribe los tokens de una marca en un elemento: `:root` o una previsualización. */
export function aplicarTokens(marca: Marca, elemento: HTMLElement): void {
  cargarTipografia(marca.tipografia);
  for (const [clave, valor] of Object.entries(tokensDe(marca))) {
    elemento.style.setProperty(clave, valor);
  }
}

/** Publica una marca en toda la interfaz: tokens, favicon y título. */
export function aplicarMarca(marca: Marca): void {
  aplicarTokens(marca, document.documentElement);
  document.title = `${marca.nombre} · ${marca.lema}`;
  if (marca.favicon) {
    let icono = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-marca]");
    if (!icono) {
      icono = document.createElement("link");
      icono.rel = "icon";
      icono.dataset.marca = "";
      document.head.appendChild(icono);
    }
    icono.href = marca.favicon;
  }
}

/** Iniciales para una marca sin logo. */
export function inicialesMarca(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : nombre.slice(0, 2)).toUpperCase();
}
