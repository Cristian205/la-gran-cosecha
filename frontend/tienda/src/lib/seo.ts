import { cache } from "react";
import { pedirAlBackend } from "./api";
import { desempaquetar } from "./datos";
import type { Categoria, Paginated, Presentacion, Producto } from "./tipos";

/**
 * Lo que la tienda le dice a Google de cada página, construido SOLO con datos
 * reales del catálogo.
 *
 * El motivo de que exista: con las 194 fichas sin descripción propia, todas
 * salían con la misma frase cambiando el nombre («X para tu negocio, con …»),
 * y eso es exactamente lo que Google clasifica como contenido duplicado y deja
 * en «Rastreada: actualmente sin indexar». Lo que de verdad distingue una ficha
 * de otra está en sus presentaciones —variedades, unidades de venta, precios—,
 * así que los títulos y las descripciones salen de ahí. Nada se inventa: si un
 * dato no existe, la frase que lo usaría no se escribe.
 */

// ---------------------------------------------------------------- categorías

/** Las categorías visibles de la tienda, resueltas en el servidor. */
export const categoriasDeLaTienda = cache(async (): Promise<Categoria[]> => {
  const datos = await pedirAlBackend<Paginated<Categoria> | Categoria[]>("/catalog/categories/", {
    params: { page_size: 100 },
  });
  return datos ? desempaquetar(datos) : [];
});

export { hrefDeCategoria, rutaDeCategoria } from "./rutas";

// -------------------------------------------------------------- presentaciones

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function precioCOP(valor: number): string {
  return pesos.format(valor);
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** «a», «a y b», «a, b y c». */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/** Sin repetir, en el orden en que llegan (que es el que decidió el negocio). */
function unicos(valores: string[]): string[] {
  const vistos = new Set<string>();
  return valores.filter((v) => {
    const clave = normalizar(v);
    if (!clave || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/**
 * Nombres de presentación que no dicen nada al buscador: repetir el nombre del
 * producto, o un «Común» que solo significa «la de siempre».
 */
const VARIEDADES_VACIAS = new Set(["comun", "normal", "estandar", "general", "unica", "unico"]);

export interface ResumenPresentaciones {
  /** Las variedades con nombre propio (Tommy, Pastusa, Desgranada…). */
  variedades: string[];
  /** Las unidades de venta, en minúscula para leerse dentro de una frase. */
  unidades: string[];
  minimo: number | null;
  maximo: number | null;
  presentaciones: Presentacion[];
}

export function resumirPresentaciones(producto: Producto): ResumenPresentaciones {
  const presentaciones = producto.presentaciones ?? [];
  const nombreProducto = normalizar(producto.nombre_producto);
  const variedades = unicos(presentaciones.map((p) => p.nombre_presentacion)).filter((v) => {
    const clave = normalizar(v);
    // «Oliva» en «Aceite de oliva» no añade nada: ya está en el nombre.
    return !nombreProducto.includes(clave) && !VARIEDADES_VACIAS.has(clave);
  });
  const unidades = unicos(presentaciones.map((p) => p.unidad_venta_nombre ?? "")).map((u) =>
    u.toLowerCase()
  );
  const precios = presentaciones
    .map((p) => Number(p.precio_unitario))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    variedades,
    unidades,
    minimo: precios.length ? Math.min(...precios) : null,
    maximo: precios.length ? Math.max(...precios) : null,
    presentaciones,
  };
}

/** Corta en el último espacio antes del límite, sin dejar una palabra a medias. */
function recortar(texto: string, maximo: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo - 1);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), 0)).replace(/[,;:.\s]+$/, "")}…`;
}

// ------------------------------------------------------------------- fichas

export function agotadoProducto(producto: Producto): boolean {
  return producto.controla_stock === true && Number(producto.disponible ?? 0) <= 0;
}

/**
 * El título de la ficha, sin el nombre del negocio (lo añade la plantilla del
 * layout, « · <negocio>»). Ej.: «Papa R12 y Pastusa: precio por bulto y kilogramo».
 *
 * Las variedades entran cuando las hay porque es lo que separa dos productos
 * que se llaman igual («Arveja» en Tubérculos y en Granos) y lo que de verdad
 * se busca («papa pastusa»); las unidades, porque «precio por bulto» es la
 * pregunta de quien compra al por mayor. Se quitan piezas (no se corta una
 * frase a medias) hasta que el título completo quepa en lo que Google muestra.
 */
const LARGO_TITULO = 50;

export function tituloDeProducto(producto: Producto): string {
  const { variedades, unidades } = resumirPresentaciones(producto);
  const nombre = producto.nombre_producto.trim();
  for (let v = Math.min(variedades.length, 2); v >= 0; v--) {
    for (let u = Math.min(unidades.length, 3); u >= 1; u--) {
      const conVariedad = v > 0 ? `${nombre} ${enumerar(variedades.slice(0, v))}` : nombre;
      const titulo = `${conVariedad}: precio por ${enumerar(unidades.slice(0, u))}`;
      if (titulo.length <= LARGO_TITULO) return titulo;
    }
  }
  return unidades.length ? `${nombre}: precios` : nombre;
}

/**
 * La meta descripción: la que escribió el negocio si existe; si no, una frase
 * armada con las presentaciones reales del producto.
 */
export function descripcionDeProducto(producto: Producto, negocio?: string): string {
  const propia = producto.descripcion?.trim();
  if (propia) return recortar(propia, 158);

  const { variedades, unidades, minimo } = resumirPresentaciones(producto);
  const donde = negocio ? ` en ${negocio}` : "";
  const piezas = [
    variedades.length
      ? `${variedades.length === 1 ? "variedad" : "variedades"} ${enumerar(variedades.slice(0, 3))}`
      : "",
    unidades.length ? `por ${enumerar(unidades.slice(0, 4))}` : "",
    minimo !== null ? `desde ${precioCOP(minimo)}` : "",
  ].filter(Boolean);
  const cierres = [
    ` ${producto.categoria_nombre} para hogares y negocios, con pedido en línea.`,
    " Pide en línea para tu hogar o negocio.",
    "",
  ];
  // De la versión más completa a la más corta: la primera que quepa entera.
  for (let n = piezas.length; n >= 0; n--) {
    const detalle = n ? `: ${piezas.slice(0, n).join(", ")}` : "";
    for (const cierre of cierres) {
      const frase = `${producto.nombre_producto}${donde}${detalle}.${cierre}`;
      if (frase.length <= 158) return frase;
    }
  }
  return recortar(`${producto.nombre_producto}${donde}.`, 158);
}

/**
 * Una frase factual sobre cómo se vende el producto, para la ficha cuando el
 * negocio no escribió descripción. Solo cuenta lo que hay; no promete calidad,
 * origen ni nada que el catálogo no diga.
 */
export function resumenDeVentaProducto(producto: Producto): string {
  const { variedades, unidades, minimo, maximo, presentaciones } = resumirPresentaciones(producto);
  const frases: string[] = [];
  const n = presentaciones.length;
  if (n > 0) {
    frases.push(
      `${producto.nombre_producto} se vende en ${n} ${n === 1 ? "presentación" : "presentaciones"}` +
        (unidades.length ? ` por ${enumerar(unidades)}` : "") +
        "."
    );
  }
  if (variedades.length > 1) frases.push(`Variedades disponibles: ${enumerar(variedades)}.`);
  if (minimo !== null && maximo !== null) {
    frases.push(
      minimo === maximo
        ? `Precio de referencia: ${precioCOP(minimo)}.`
        : `Precios de referencia entre ${precioCOP(minimo)} y ${precioCOP(maximo)}, según la presentación.`
    );
  }
  return frases.join(" ");
}

export function nombreDePresentacion(p: Presentacion, producto: Producto): string {
  const variedad = p.nombre_presentacion?.trim();
  const repite = variedad && normalizar(variedad) === normalizar(producto.nombre_producto);
  return variedad && !repite ? variedad : producto.nombre_producto;
}

/** Schema.org Product + Offer(s), solo con lo que el catálogo trae. */
export function datosEstructuradosDeProducto(
  producto: Producto,
  { base, negocio, imagenes }: { base: string; negocio?: string; imagenes: string[] }
): Record<string, unknown> {
  const url = `${base}/productos/${producto.slug}`;
  const disponibilidad = agotadoProducto(producto)
    ? "https://schema.org/OutOfStock"
    : "https://schema.org/InStock";
  const vendedor = negocio ? { "@id": `${base}/#negocio` } : undefined;

  const ofertas = (producto.presentaciones ?? [])
    .filter((p) => Number(p.precio_unitario) > 0)
    .map((p) => ({
      "@type": "Offer",
      name: `${nombreDePresentacion(p, producto)} · ${p.unidad_venta_nombre}`,
      price: Number(p.precio_unitario),
      priceCurrency: "COP",
      availability: disponibilidad,
      url,
      ...(vendedor ? { seller: vendedor } : {}),
    }));

  let offers: Record<string, unknown> | undefined;
  if (ofertas.length === 1) {
    offers = ofertas[0];
  } else if (ofertas.length > 1) {
    const precios = ofertas.map((o) => o.price);
    offers = {
      "@type": "AggregateOffer",
      priceCurrency: "COP",
      lowPrice: Math.min(...precios),
      highPrice: Math.max(...precios),
      offerCount: ofertas.length,
      availability: disponibilidad,
      offers: ofertas,
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#producto`,
    name: producto.nombre_producto,
    url,
    category: producto.categoria_nombre,
    description: descripcionDeProducto(producto, negocio),
    ...(producto.codigo_producto ? { sku: producto.codigo_producto } : {}),
    // Solo fotos del producto. El logo del negocio NO es la imagen de un
    // producto: Google lo considera información engañosa en un Product.
    ...(imagenes.length > 0 ? { image: imagenes } : {}),
    ...(offers ? { offers } : {}),
  };
}

// --------------------------------------------------------------- migas (JSON-LD)

export function migasEstructuradas(base: string, migas: { nombre: string; ruta: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nombre,
      item: `${base}${m.ruta === "/" ? "" : m.ruta}`,
    })),
  };
}

// ------------------------------------------------------------ página categoría

export function descripcionDeCategoria(
  categoria: Categoria,
  productos: Producto[],
  total: number,
  negocio?: string
): string {
  const nombres = productos.slice(0, 5).map((p) => p.nombre_producto.toLowerCase());
  const donde = negocio ? ` en ${negocio}` : "";
  const ejemplos = nombres.length ? `: ${enumerar(nombres)}${total > nombres.length ? " y más" : ""}` : "";
  return recortar(
    `${categoria.nombre_categoria}${donde}, ${total} ${total === 1 ? "producto" : "productos"}${ejemplos}. Precios por presentación y pedido en línea para hogares y negocios.`,
    158
  );
}

/**
 * La introducción de la categoría: el subtítulo que escribió el negocio, si lo
 * hay, seguido de lo que el catálogo dice de ella — cuántos productos, cuáles,
 * por qué unidades se venden y desde qué precio.
 */
export function introduccionDeCategoria(categoria: Categoria, productos: Producto[], total: number): string {
  const unidades = unicos(
    productos.flatMap((p) => (p.presentaciones ?? []).map((pr) => pr.unidad_venta_nombre ?? ""))
  ).map((u) => u.toLowerCase());
  const precios = productos
    .map((p) => Number(p.precio_desde))
    .filter((n) => Number.isFinite(n) && n > 0);
  const frases = [
    `${total} ${total === 1 ? "producto" : "productos"} de ${categoria.nombre_categoria.toLowerCase()} en el catálogo` +
      (unidades.length ? `, a la venta por ${enumerar(unidades.slice(0, 6))}${unidades.length > 6 ? " y otras presentaciones" : ""}` : "") +
      ".",
  ];
  if (precios.length) frases.push(`Precios desde ${precioCOP(Math.min(...precios))}.`);
  return frases.join(" ");
}
