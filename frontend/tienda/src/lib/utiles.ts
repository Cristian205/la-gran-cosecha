import { ICONOS } from "@/bloques/iconos";
import { icono3D, type ComponenteIcono } from "@/bloques/iconos3d";

const formatterCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatoPrecio(valor: number | string): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return formatterCOP.format(Number.isFinite(n) ? n : 0);
}

export function telHref(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, "")}`;
}

/**
 * El enlace a un chat de WhatsApp. `wa.me` exige el número completo con
 * indicativo de país y sin símbolos; un número guardado como en Colombia se
 * marca a diario («300 212 4562», 10 dígitos) abría un chat con un número que
 * no existe. Los negocios de la plataforma son colombianos (ver `jsonld.ts`):
 * a 10 dígitos se les antepone el 57. Con indicativo ya puesto, se respeta.
 */
export function numeroWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  return digitos.length === 10 ? `57${digitos}` : digitos;
}

export function whatsappHref(numero: string, mensaje = ""): string {
  const base = `https://wa.me/${numeroWhatsapp(numero)}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** Quita tildes y pasa a minúsculas para comparar texto sin importar acentos. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Misma paleta rotativa que el panel admin (frontend/admin-panel/src/pages/products/ProductsPage.tsx)
// para que una categoría se vea del mismo color en la tienda y en el panel. Con más
// tonos que categorías esperadas para que id % N no repita color entre dos categorías.
const PALETA_CATEGORIA = [
  "linear-gradient(135deg, #059669, #047857)",
  "linear-gradient(135deg, #2563eb, #1d4ed8)",
  "linear-gradient(135deg, #d97706, #b45309)",
  "linear-gradient(135deg, #db2777, #be185d)",
  "linear-gradient(135deg, #7c3aed, #6d28d9)",
  "linear-gradient(135deg, #0891b2, #0e7490)",
  "linear-gradient(135deg, #dc2626, #b91c1c)",
  "linear-gradient(135deg, #0d9488, #0f766e)",
  "linear-gradient(135deg, #65a30d, #4d7c0f)",
  "linear-gradient(135deg, #e11d48, #be123c)",
  "linear-gradient(135deg, #0284c7, #0369a1)",
  "linear-gradient(135deg, #a855f7, #9333ea)",
];

export function colorCategoria(id: number): string {
  return PALETA_CATEGORIA[id % PALETA_CATEGORIA.length];
}

// Tripleta "r, g, b" del tono oscuro de cada entrada de PALETA_CATEGORIA de
// arriba (mismo orden, mismo id % N), para usarla en un rgba(var(--x), alpha)
// — el mismo patron que ya usa `--sombra-tinte`. Un degradado no sirve como
// tinte de scrim porque no se le puede graduar la opacidad por parada.
const PALETA_CATEGORIA_TINTE = [
  "4, 120, 87",
  "29, 78, 216",
  "180, 83, 9",
  "190, 24, 93",
  "109, 40, 217",
  "14, 116, 144",
  "185, 28, 28",
  "15, 118, 110",
  "77, 124, 15",
  "190, 18, 60",
  "3, 105, 161",
  "147, 51, 234",
];

export function colorCategoriaTinte(id: number): string {
  return PALETA_CATEGORIA_TINTE[id % PALETA_CATEGORIA_TINTE.length];
}

// Icono por palabra clave en el nombre de la categoría, para que cada tile en
// Inicio se distinga a simple vista en vez de repetir el mismo ícono genérico.
// El orden importa: gana la primera regla que coincida. Tubérculos va antes
// que verduras para que no compartan icono cuando se muestran juntas.
const APPLE = icono3D("categoria-fruta.png");
const CARROT = icono3D("categoria-tuberculo.png");
const SALAD = icono3D("categoria-verdura.png");
const WHEAT = icono3D("categoria-grano.png");
const MILK = icono3D("categoria-lacteo.png");
const BEEF = icono3D("categoria-carne.png");
const EGG = icono3D("categoria-huevo.png");
const CANDY = icono3D("categoria-dulce.png");
const SEEDLING = icono3D("semilla.png");

const REGLAS_ICONO_CATEGORIA: [RegExp, ComponenteIcono][] = [
  [/frut/, APPLE],
  [/tuberculo|papa|yuca|raiz/, CARROT],
  [/verdur|hortaliz|vegetal|ensalada/, SALAD],
  [/grano|cereal|legumbre|arroz/, WHEAT],
  [/lacte|leche|queso|salsamentaria/, MILK],
  [/carne|res|pollo|cerdo|embutido/, BEEF],
  [/huevo/, EGG],
  [/hierba|aromatic|condiment|especia/, ICONOS.hoja],
  [/dulc|confite|golosina/, CANDY],
  [/desechable|empaque|aseo/, ICONOS.caja],
];

export function iconoCategoria(nombre: string): ComponenteIcono {
  const texto = normalizarTexto(nombre);
  for (const [patron, Icono] of REGLAS_ICONO_CATEGORIA) {
    if (patron.test(texto)) return Icono;
  }
  return SEEDLING;
}

// Color por palabra clave (mismas familias que REGLAS_ICONO_CATEGORIA de
// arriba, para que el icono y el fondo de la vidriera de Inicio se sientan
// del mismo producto) en vez del color rotativo por id: "Frutas" se ve
// naranja en cualquier negocio que la llame asi, no del color que le toque
// por su posicion en la lista. Una categoria que no calza ninguna regla cae
// al color rotativo de siempre en vez de un gris generico.
const REGLAS_COLOR_CATEGORIA: [RegExp, string, string][] = [
  // [patron, fondo (degradado), tinte "r, g, b" del tono oscuro]
  [/frut/, "linear-gradient(150deg, #e8632f, #c9481f)", "201, 72, 31"],
  [/tuberculo|papa|yuca|raiz/, "linear-gradient(150deg, #cf8256, #b56a3e)", "181, 106, 62"],
  [/verdur|hortaliz|vegetal|ensalada/, "linear-gradient(150deg, #4c7a52, #3c6242)", "60, 98, 66"],
  [/grano|cereal|legumbre|arroz/, "linear-gradient(150deg, #8a6a48, #6f5535)", "111, 85, 53"],
  [
    /lacte|leche|queso|salsamentaria|carne|res|pollo|cerdo|embutido/,
    "linear-gradient(150deg, #7c2c34, #5e2129)",
    "94, 33, 41",
  ],
  [/huevo/, "linear-gradient(150deg, #d9a441, #b9822a)", "185, 130, 42"],
  [/hierba|aromatic|condiment|especia/, "linear-gradient(150deg, #6f9a4f, #577b3c)", "87, 123, 60"],
  [/dulc|confite|golosina/, "linear-gradient(150deg, #2f7a6e, #235f56)", "35, 95, 86"],
  [/desechable|empaque|aseo/, "linear-gradient(150deg, #6fa3ac, #588a94)", "88, 138, 148"],
];

export function colorCategoriaTematico(nombre: string, id: number): string {
  const texto = normalizarTexto(nombre);
  for (const [patron, fondo] of REGLAS_COLOR_CATEGORIA) {
    if (patron.test(texto)) return fondo;
  }
  return colorCategoria(id);
}

export function colorCategoriaTematicoTinte(nombre: string, id: number): string {
  const texto = normalizarTexto(nombre);
  for (const [patron, , tinte] of REGLAS_COLOR_CATEGORIA) {
    if (patron.test(texto)) return tinte;
  }
  return colorCategoriaTinte(id);
}

/** Incremento mínimo permitido para la cantidad de un producto. */
export function pasoCantidad(permiteFraccion: boolean, tipoCantidad: string): number {
  if (!permiteFraccion) return 1;
  if (tipoCantidad === "cuarto") return 0.25;
  if (tipoCantidad === "medio") return 0.5;
  return 1;
}

/**
 * Desde cuánto y de cuánto en cuánto se pide una presentación: mínima,
 * mínima + paso, mínima + 2·paso… Es la misma regla que valida el servidor
 * (`catalog/cantidades.py`): lo que este archivo deja pedir, el pedido lo
 * acepta.
 */
export interface ReglaCantidad {
  minimo: number;
  paso: number;
  decimales: number;
}

/** La regla de la presentación; sin ella (servidor anterior), la del producto. */
export function reglaCantidad(
  presentacion: { cantidad_minima?: string; incremento_cantidad?: string; decimales_cantidad?: number } | null | undefined,
  permiteFraccion: boolean,
  tipoCantidad: string
): ReglaCantidad {
  const minimo = Number(presentacion?.cantidad_minima);
  const paso = Number(presentacion?.incremento_cantidad);
  if (minimo > 0 && paso > 0) {
    return { minimo, paso, decimales: presentacion?.decimales_cantidad ?? 2 };
  }
  const legado = pasoCantidad(permiteFraccion, tipoCantidad);
  return { minimo: legado, paso: legado, decimales: legado === 1 ? 0 : 2 };
}

/** La regla con la que se agregó una línea del carrito. */
export function reglaDeItem(item: {
  minimo?: number;
  paso?: number;
  decimales?: number;
  permiteFraccion: boolean;
  tipoCantidad: string;
}): ReglaCantidad {
  if (item.paso && item.paso > 0) {
    return { minimo: item.minimo ?? item.paso, paso: item.paso, decimales: item.decimales ?? 2 };
  }
  return reglaCantidad(null, item.permiteFraccion, item.tipoCantidad);
}

/** Lleva `valor` a la cantidad válida más cercana (nunca por debajo de la mínima). */
export function ajustarARegla(valor: number, regla: ReglaCantidad): number {
  const { minimo, paso } = regla;
  const pasos = Math.max(0, Math.round((valor - minimo) / paso));
  // toFixed(2): la regla nunca tiene más de dos decimales, y así 0,1 + 0,2
  // no llega al servidor como 0,30000000000000004.
  return Number((minimo + pasos * paso).toFixed(2));
}

/** La cantidad con la que arranca el selector: 1 si es válida; si no, la válida más cercana por encima. */
export function cantidadInicial(regla: ReglaCantidad): number {
  if (regla.minimo >= 1) return regla.minimo;
  return Number((regla.minimo + Math.ceil((1 - regla.minimo) / regla.paso - 1e-9) * regla.paso).toFixed(2));
}

/** ¿Se escribe con fracciones? (para `formatoCantidad`). */
export function esFraccionaria(regla: ReglaCantidad): boolean {
  return regla.decimales > 0;
}

/** Suma `delta` a `valor` respetando el paso, sin bajar de la mínima (por defecto, un paso). */
export function ajustarCantidad(valor: number, delta: number, paso: number, minimo: number = paso): number {
  return ajustarARegla(valor + delta, { minimo, paso, decimales: 2 });
}

const FRACCIONES: Record<number, string> = { 25: "1/4", 50: "1/2", 75: "3/4" };

/**
 * Formatea una cantidad en notación de fracción legible para el cliente
 * (1.5 -> "1 1/2", 0.25 -> "1/4") en vez de decimales ("1,5") que confunden
 * en el mostrador. Los productos sin fracción siempre muestran un entero.
 */
export function formatoCantidad(valor: number, permiteFraccion: boolean): string {
  if (!permiteFraccion || !Number.isFinite(valor)) {
    return String(Math.round(valor) || 0);
  }
  const entero = Math.floor(valor + 1e-6);
  const resto = Math.round((valor - entero) * 100);
  if (resto <= 0) return String(entero);
  const frac = FRACCIONES[resto];
  // 0,1 · 0,2 · 1,35…: sin una fracción de mostrador, decimal con coma.
  if (!frac) return String(Number(valor.toFixed(2))).replace(".", ",");
  return entero > 0 ? `${entero} ${frac}` : frac;
}

/**
 * Lo contrario de `formatoCantidad`: lee lo que el cliente escribió en el
 * campo de cantidad ("50", "1,5", "1.5", "1 1/2", "3/4") y lo ajusta al paso
 * del producto. Existe para los pedidos grandes: llegar a 50 bultos con el
 * botón "+" eran 49 clics. Devuelve `null` si no se entiende, para que quien
 * llama conserve el valor anterior en vez de inventar uno.
 */
export function parsearCantidad(texto: string, paso: number, minimo: number = paso): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const partes = limpio.split(/\s+/);
  let total = 0;
  for (const parte of partes) {
    const fraccion = parte.match(/^(\d+)\/(\d+)$/);
    if (fraccion) {
      const divisor = Number(fraccion[2]);
      if (!divisor) return null;
      total += Number(fraccion[1]) / divisor;
    } else if (/^\d+(\.\d+)?$/.test(parte)) {
      total += Number(parte);
    } else {
      return null;
    }
  }
  if (!(total > 0)) return null;
  return ajustarARegla(total, { minimo, paso, decimales: 2 });
}
