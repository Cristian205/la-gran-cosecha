/**
 * Las cookies y el almacenamiento del navegador que usa la tienda.
 *
 * Es un INVENTARIO, no un texto: la política de cookies lo pinta en tabla y,
 * cuando exista, el banner de consentimiento leerá de aquí qué categorías
 * ofrecer. Si se añade una analítica o un píxel, se declara aquí primero —con
 * su categoría— y la política y el banner lo recogen solos.
 *
 * Lo que figura es lo que el código usa hoy, verificado contra `estado/*.ts`
 * y `proxy.ts`. Una política de cookies que lista lo que no se usa o calla lo
 * que sí, es la forma más fácil de incumplir la que se tiene.
 */

export type CategoriaCookie = "necesarias" | "funcionales" | "analiticas" | "publicitarias";

export interface DefinicionCategoria {
  id: CategoriaCookie;
  nombre: string;
  descripcion: string;
  /** Las necesarias no se pueden rechazar: sin ellas no hay carrito. */
  obligatoria: boolean;
  /** Si hoy la tienda usa alguna de esta categoría. */
  enUso: boolean;
}

export interface ElementoAlmacenado {
  nombre: string;
  tipo: "Cookie" | "Almacenamiento local";
  categoria: CategoriaCookie;
  proveedor: "Propia" | string;
  finalidad: string;
  duracion: string;
}

export const CATEGORIAS: DefinicionCategoria[] = [
  {
    id: "necesarias",
    nombre: "Necesarias",
    descripcion:
      "Hacen funcionar la tienda: guardan tu carrito mientras compras y permiten completar el pedido. No se pueden desactivar desde la tienda.",
    obligatoria: true,
    enUso: true,
  },
  {
    id: "funcionales",
    nombre: "Funcionales",
    descripcion:
      "Recuerdan elecciones que te ahorran trabajo, como tu identificación para repetir un pedido. La tienda funciona sin ellas.",
    obligatoria: false,
    enUso: true,
  },
  {
    id: "analiticas",
    nombre: "Analíticas",
    descripcion:
      "Medirían cómo se usa la tienda para mejorarla (páginas visitadas, productos buscados). Hoy no se usan.",
    obligatoria: false,
    enUso: false,
  },
  {
    id: "publicitarias",
    nombre: "Publicitarias",
    descripcion:
      "Permitirían mostrarte anuncios relacionados con tus intereses en otros sitios. Hoy no se usan; si se implementan, se te pedirá autorización antes.",
    obligatoria: false,
    enUso: false,
  },
];

export const ELEMENTOS: ElementoAlmacenado[] = [
  {
    nombre: "kryonx-carrito",
    tipo: "Almacenamiento local",
    categoria: "necesarias",
    proveedor: "Propia",
    finalidad: "Guarda los productos de tu carrito para que no se pierdan al cambiar de página.",
    duracion: "Hasta que vacíes el carrito o borres los datos del navegador",
  },
  {
    nombre: "kryonx_vista",
    tipo: "Cookie",
    categoria: "necesarias",
    proveedor: "Propia",
    finalidad:
      "Solo para el equipo de la tienda: mantiene activa la vista previa de un diseño mientras se revisa. No se crea en una visita normal.",
    duracion: "Sesión (se borra al cerrar el navegador)",
  },
  {
    nombre: "kryonx-cliente",
    tipo: "Almacenamiento local",
    categoria: "funcionales",
    proveedor: "Propia",
    finalidad:
      "Si la tienda te identifica por cédula, recuerda tu número y tu nombre abreviado para no pedírtelos en cada compra. Nunca guarda teléfono ni dirección. Se borra con «¿No eres tú?».",
    duracion: "Hasta que lo borres",
  },
  {
    nombre: "kryonx-ultimo-pedido",
    tipo: "Almacenamiento local",
    categoria: "funcionales",
    proveedor: "Propia",
    finalidad: "Recuerda los productos de tu último pedido para que puedas repetirlo con un clic.",
    duracion: "Hasta tu siguiente pedido o hasta que borres los datos del navegador",
  },
];

/** Servicios externos que la tienda carga y lo que reciben. */
export const TERCEROS: { nombre: string; finalidad: string }[] = [
  {
    nombre: "Google Fonts",
    finalidad:
      "Sirve las tipografías de la tienda. Tu navegador se conecta a los servidores de Google para descargarlas, lo que le permite conocer tu dirección IP. No instala cookies.",
  },
  {
    nombre: "WhatsApp (Meta)",
    finalidad:
      "Solo si pulsas un botón de WhatsApp: se abre la aplicación o el sitio de WhatsApp, que se rige por su propia política de privacidad.",
  },
];

/* ------------------------------------------------------------------ */
/* Consentimiento                                                      */
/* ------------------------------------------------------------------ */

/**
 * Lo que guardará el banner de consentimiento cuando exista. Se deja definido
 * para que la política, el banner y cualquier script que dependa de una
 * categoría lean lo mismo.
 *
 * `version` sube cuando cambia el inventario de forma relevante (p. ej. se
 * añade una analítica): un consentimiento dado a una versión anterior ya no
 * vale y hay que volver a preguntar.
 */
export const VERSION_CONSENTIMIENTO = 1;
export const CLAVE_CONSENTIMIENTO = "kryonx-consentimiento";
export const EVENTO_CONSENTIMIENTO = "kryonx:consentimiento";

export interface Consentimiento {
  version: number;
  fecha: string;
  categorias: Record<Exclude<CategoriaCookie, "necesarias">, boolean>;
}

export function leerConsentimiento(): Consentimiento | null {
  if (typeof window === "undefined") return null;
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CONSENTIMIENTO) ?? "null") as Consentimiento | null;
    return guardado?.version === VERSION_CONSENTIMIENTO ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarConsentimiento(categorias: Consentimiento["categorias"]): Consentimiento {
  const consentimiento: Consentimiento = {
    version: VERSION_CONSENTIMIENTO,
    fecha: new Date().toISOString(),
    categorias,
  };
  try {
    localStorage.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(consentimiento));
  } catch {
    // Navegación privada o almacenamiento bloqueado: se respeta la elección
    // durante esta visita aunque no se pueda recordar.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: consentimiento }));
  return consentimiento;
}

/** ¿Puede cargarse algo de esta categoría? Las necesarias, siempre. */
export function categoriaPermitida(categoria: CategoriaCookie): boolean {
  if (categoria === "necesarias") return true;
  return Boolean(leerConsentimiento()?.categorias[categoria]);
}
