/**
 * El tema de cada negocio, resuelto en el SERVIDOR.
 *
 * En la tienda anterior esto corría en el navegador: la página se pintaba con
 * el verde por defecto y se reteñía al llegar la configuración. Con una tienda
 * por negocio ese parpadeo sería inaceptable —una perfumería mostraría el
 * verde de una frutería durante medio segundo—, así que aquí se genera la
 * declaración CSS y se inserta en el `<head>` del HTML.
 *
 * La lógica de la escala es la misma que ya funcionaba: el negocio elige UN
 * color y se deriva la escala completa conservando la diferencia de luminosidad
 * entre pasos. Así el sitio entero se retiñe de forma coherente sin pedirle a
 * nadie que elija nueve tonos.
 */
import type { SiteConfig } from "./tipos";

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

export const FUENTES: Record<string, string> = {
  poppins: '"Poppins", "Segoe UI", system-ui, sans-serif',
  inter: '"Inter", "Segoe UI", system-ui, sans-serif',
  nunito: '"Nunito", "Segoe UI", system-ui, sans-serif',
  "work-sans": '"Work Sans", "Segoe UI", system-ui, sans-serif',
  jakarta: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
  quicksand: '"Quicksand", "Segoe UI", system-ui, sans-serif',
};

/**
 * Las familias que pueden llevar los TITULOS, aparte de la del cuerpo.
 *
 * Existe porque el cuerpo y los titulares no siempre quieren lo mismo: una
 * boutique pide un titular con serif y un texto en sans, y hasta ahora la
 * tienda solo sabia elegir una tipografia para todo.
 *
 * `heredada` es el valor por defecto y no carga nada: las tiendas que ya
 * existen siguen con una sola familia, que es exactamente lo que tenian.
 */
export const FUENTES_TITULO: Record<string, string> = {
  heredada: "var(--fuente-sitio)",
  playfair: '"Playfair Display", Georgia, "Times New Roman", serif',
  cormorant: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
  "dm-serif": '"DM Serif Display", Georgia, "Times New Roman", serif',
  fraunces: '"Fraunces", Georgia, "Times New Roman", serif',
};

const FAMILIAS_TITULO: Record<string, string> = {
  playfair: "Playfair+Display:ital,wght@0,400..700;1,400..700",
  cormorant: "Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600",
  "dm-serif": "DM+Serif+Display:ital@0;1",
  fraunces: "Fraunces:ital,wght@0,400..700;1,400..700",
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
  const normal =
    limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const entero = parseInt(normal, 16);
  return [(entero >> 16) & 255, (entero >> 8) & 255, entero & 255];
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
  const aHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${aHex(r)}${aHex(g)}${aHex(b)}`;
}

/**
 * Deriva la escala completa a partir del único color que eligió el negocio,
 * conservando la diferencia de luminosidad entre pasos de la escala original:
 * misma "forma", distinto tono.
 */
function escala(
  prefijo: string,
  base: Record<string, string>,
  elegido: string | null | undefined,
  pasoReferencia: string
): string[] {
  if (!esHexValido(elegido)) return [];

  const [, , lBase] = rgbAHsl(...hexARgb(base[pasoReferencia]));
  const [h, s, l] = rgbAHsl(...hexARgb(elegido));

  return Object.entries(base).map(([paso, hexDefecto]) => {
    const [, , lPaso] = rgbAHsl(...hexARgb(hexDefecto));
    const nueva = Math.min(97, Math.max(3, l + (lPaso - lBase)));
    return `--${prefijo}-${paso}:${hslAHex(h, s, nueva)}`;
  });
}

/**
 * Las variables CSS del negocio, listas para un `<style>` del `<head>`.
 *
 * Cada pieza es independiente: si un campo viene vacío o inválido, se omite y
 * queda el valor por defecto de la hoja de estilos. Nunca se rompe el tema
 * entero por un color mal escrito en el panel.
 */
export function variablesDelTema(config: SiteConfig | null): string {
  if (!config) return "";

  const reglas: string[] = [
    ...escala("verde", ESCALA_VERDE, config.color_primario, "500"),
    ...escala("ambar", ESCALA_AMBAR, config.color_secundario, "500"),
  ];

  const directas: [string, string | null | undefined][] = [
    ["--fondo", config.color_fondo],
    ["--gris-900", config.color_texto],
    ["--btn-primario-texto", config.color_primario_texto],
    ["--btn-secundario-texto", config.color_secundario_texto],
    ["--superficie", config.color_superficie],
  ];
  for (const [variable, valor] of directas) {
    if (esHexValido(valor)) reglas.push(`${variable}:${valor}`);
  }

  if (esHexValido(config.color_superficie)) {
    reglas.push(`--superficie-rgb:${hexARgb(config.color_superficie).join(", ")}`);
  }

  // Las del catálogo de tokens van ANTES que las derivadas del color de marca:
  // si un negocio fija `--fondo` a mano, esa gana sobre la que sale de su
  // color primario. Lo específico manda sobre lo calculado.
  for (const [variable, valor] of Object.entries(config.variables_tema ?? {})) {
    reglas.push(`${variable}:${valor}`);
  }

  reglas.push(`--fuente-sitio:${FUENTES[config.fuente] ?? FUENTES.poppins}`);

  // El token guarda una CLAVE («playfair»), no una pila de familias: guardar la
  // pila obligaria al negocio a escribir CSS en un campo de texto y a que
  // nadie pudiera cargar la fuente que nombra. La traduccion la hace el codigo,
  // igual que con `estilo-tarjeta`.
  const titulos = FUENTES_TITULO[fuenteDeTitulos(config)];
  if (titulos) reglas.push(`--fuente-titulos:${titulos}`);
  reglas.push(
    `--btn-radio:${RADIOS_BOTON[config.radio_boton] ?? RADIOS_BOTON.redondeado}`
  );
  reglas.push(`--buscador-ancho:${config.ancho_buscador || 420}px`);
  reglas.push(`--navbar-espaciado-logo:${config.espaciado_navbar || 0}px`);

  return `:root{${reglas.join(";")}}`;
}

/**
 * Lo que una PLANTILLA propone, resuelto a variables CSS.
 *
 * Existe por un fallo que solo se ve mirando: el editor de plantillas de Crynex
 * mandaba a la vista previa las variables de los tokens y nada mas, asi que la
 * boutique se previsualizaba con la maqueta nueva y el verde de la empresa de
 * referencia. Y no era un descuido del panel: el color de marca NO es un token
 * —de `color_primario` cuelga una escala de nueve pasos— asi que el panel no
 * tenia forma de resolverlo sin copiarse esta derivacion entera.
 *
 * Por eso vive aqui. La regla es la de siempre: el codigo que sabe convertir un
 * color en una escala hay UNO, y esta donde se pinta. El panel manda lo que la
 * plantilla declara y la tienda lo traduce.
 *
 * A diferencia de `variablesDelTema`, solo devuelve lo DECLARADO: una plantilla
 * que no menciona la tipografia no puede devolver la previa a Poppins, porque
 * adoptarla tampoco lo haria — `aspecto.limpiar_marca` descarta los vacios.
 */
export interface MarcaPropuesta {
  color_primario?: string;
  color_primario_texto?: string;
  color_secundario?: string;
  color_secundario_texto?: string;
  color_fondo?: string;
  color_superficie?: string;
  color_texto?: string;
  fuente?: string;
  radio_boton?: string;
}

export function variablesDeAspecto(
  marca: MarcaPropuesta | null | undefined,
  tokens: Record<string, string> | null | undefined
): Record<string, string> {
  const salida: Record<string, string> = {};
  const m = marca ?? {};

  for (const regla of [
    ...escala("verde", ESCALA_VERDE, m.color_primario, "500"),
    ...escala("ambar", ESCALA_AMBAR, m.color_secundario, "500"),
  ]) {
    const corte = regla.indexOf(":");
    salida[regla.slice(0, corte)] = regla.slice(corte + 1);
  }

  const directas: [string, string | undefined][] = [
    ["--fondo", m.color_fondo],
    ["--gris-900", m.color_texto],
    ["--btn-primario-texto", m.color_primario_texto],
    ["--btn-secundario-texto", m.color_secundario_texto],
    ["--superficie", m.color_superficie],
  ];
  for (const [variable, valor] of directas) {
    if (esHexValido(valor)) salida[variable] = valor;
  }
  if (esHexValido(m.color_superficie)) {
    salida["--superficie-rgb"] = hexARgb(m.color_superficie).join(", ");
  }

  if (m.fuente && FUENTES[m.fuente]) salida["--fuente-sitio"] = FUENTES[m.fuente];
  if (m.radio_boton && RADIOS_BOTON[m.radio_boton]) {
    salida["--btn-radio"] = RADIOS_BOTON[m.radio_boton];
  }

  // Los tokens van DESPUES: lo que la plantilla fija a mano manda sobre lo que
  // se derivo del color de marca. Mismo orden que `variablesDelTema`.
  Object.assign(salida, tokens ?? {});

  // Y la traduccion de la clave a la pila de familias, que es lo ultimo porque
  // el token guarda «playfair» y eso no es un `font-family` valido.
  const clave = (tokens?.["--fuente-titulos"] ?? "").trim();
  if (FUENTES_TITULO[clave]) salida["--fuente-titulos"] = FUENTES_TITULO[clave];

  return salida;
}

/** La hoja de Google para una familia de titulos nombrada por su clave. */
export function hojaDeTitulos(clave: string): string | null {
  const familia = FAMILIAS_TITULO[clave];
  return familia
    ? `https://fonts.googleapis.com/css2?family=${familia}&display=swap`
    : null;
}

/** Que familia llevan los titulos. `heredada` si no se eligio o no se conoce. */
export function fuenteDeTitulos(config: SiteConfig | null): string {
  const elegida = config?.variables_tema?.["--fuente-titulos"]?.trim();
  return elegida && FUENTES_TITULO[elegida] ? elegida : "heredada";
}

/**
 * La hoja de Google con las familias que esta tienda usa: la del cuerpo y, si
 * eligio una distinta, la de los titulos. En una sola peticion, que es lo que
 * la API de Google permite y lo que evita dos bloqueos de renderizado.
 */
export function fuenteDeGoogle(config: SiteConfig | null): string {
  const familias: Record<string, string> = {
    poppins: "Poppins:wght@400;500;600;700;800",
    inter: "Inter:wght@400;500;600;700;800",
    nunito: "Nunito:wght@400;500;600;700;800",
    "work-sans": "Work+Sans:wght@400;500;600;700;800",
    jakarta: "Plus+Jakarta+Sans:wght@400;500;600;700;800",
    quicksand: "Quicksand:wght@400;500;600;700",
  };
  // Solo la que se usa, no las seis: la tienda anterior las cargaba todas para
  // que el cambio fuese instantáneo en el panel, pero aquí el tema ya viene
  // resuelto del servidor y las otras cinco serían peso muerto.
  const familia = familias[config?.fuente ?? "poppins"] ?? familias.poppins;
  const titulos = FAMILIAS_TITULO[fuenteDeTitulos(config)];
  const partes = titulos ? [familia, titulos] : [familia];
  return `https://fonts.googleapis.com/css2?family=${partes.join("&family=")}&display=swap`;
}


/** Los aspectos de tarjeta que esta hoja de estilos sabe dibujar. */
const ESTILOS_DE_TARJETA = [
  "estandar",
  "editorial",
  "gastronomico",
  "tecnico",
  "minimo",
] as const;

/**
 * Que aspecto tienen las tarjetas de producto en esta tienda.
 *
 * Sale del token `estilo-tarjeta`, que el backend resuelve como cualquier otro
 * y entrega en `variables_tema`. A diferencia de los demas no es un valor que
 * el CSS pueda usar tal cual —una variable no decide donde va el precio—, asi
 * que viaja como atributo en el `<body>` y la hoja define los cinco aspectos.
 *
 * Un valor que este despliegue no conozca cae al estandar. El catalogo de
 * tokens y esta hoja se despliegan por separado, asi que pueden no coincidir
 * durante unos minutos, y una tienda no puede quedarse con las tarjetas sin
 * maquetar por eso — el mismo criterio que `claseDeVariante` en los bloques.
 */
export function estiloDeTarjeta(config: SiteConfig | null): string {
  const elegido = config?.variables_tema?.["--estilo-tarjeta"]?.trim();
  return elegido && (ESTILOS_DE_TARJETA as readonly string[]).includes(elegido)
    ? elegido
    : "estandar";
}
