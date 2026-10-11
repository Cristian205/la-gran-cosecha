/**
 * En qué apartado del panel va cada propiedad de una sección.
 *
 * El formulario sigue saliendo del esquema —un bloque nuevo trae su formulario
 * sin tocar el editor—; esto solo decide DÓNDE va cada campo, por su nombre,
 * que es la convención que ya siguen todos los bloques (`cta_texto`,
 * `imagen_movil`, `oscurecer`…). Lo que no encaja en ningún apartado va a
 * «Contenido»: un campo mal clasificado se ve igual, uno escondido no.
 */
import type { LucideIcon } from "lucide-react";
import { Contrast, Image as ImageIcon, LayoutTemplate, MousePointerClick, Palette, Type } from "lucide-react";
import type { CampoEsquema } from "../../api/tienda";

export type ClaveGrupo = "contenido" | "imagenes" | "diseno" | "botones" | "legibilidad" | "estilo";

export interface Grupo {
  clave: ClaveGrupo;
  titulo: string;
  ayuda: string;
  icono: LucideIcon;
}

export const GRUPOS: readonly Grupo[] = [
  { clave: "contenido", titulo: "Contenido", ayuda: "Antetítulo, título y textos.", icono: Type },
  { clave: "imagenes", titulo: "Imágenes", ayuda: "Fotos y videos para cada pantalla.", icono: ImageIcon },
  { clave: "diseno", titulo: "Diseño", ayuda: "Altura, alineación y dónde se ve.", icono: LayoutTemplate },
  { clave: "botones", titulo: "Botones", ayuda: "Textos, enlaces, colores y visibilidad.", icono: MousePointerClick },
  { clave: "legibilidad", titulo: "Legibilidad", ayuda: "Oscurecer la foto para que el texto se lea.", icono: Contrast },
  { clave: "estilo", titulo: "Colores y estilo", ayuda: "Retoques de color solo para esta sección.", icono: Palette },
];

const BOTON = /^(cta\d*|boton\d*|whatsapp)(_|$)/;

export function grupoDe(clave: string, campo: CampoEsquema): ClaveGrupo {
  if (campo.tipo === "array") return /^(collage|galeria|imagenes)$/.test(clave) ? "imagenes" : "contenido";
  if (/^(oscurecer|degradado|tono_texto|contraste|velo|sombra_texto)/.test(clave)) return "legibilidad";
  if (BOTON.test(clave)) return "botones";
  if (campo.formato === "imagen" || campo.formato === "video") return "imagenes";
  if (/^(imagen|video|poster|foto|fondo|logo)/.test(clave) || /^enfoque/.test(clave)) return "imagenes";
  if (/^(altura|alineacion|posicion|invertido|atenuar|columnas|ancho)/.test(clave)) return "diseno";
  return "contenido";
}

/** El nombre de cada botón, por el prefijo de sus propiedades. */
export function nombreDeBoton(prefijo: string): string {
  if (prefijo === "cta" || prefijo === "boton") return "Botón principal";
  if (prefijo === "whatsapp") return "WhatsApp";
  const n = prefijo.match(/\d+$/)?.[0];
  return n === "2" ? "Botón secundario" : `Botón ${n ?? ""}`.trim();
}

export function prefijoDeBoton(clave: string): string {
  return clave.match(BOTON)?.[1] ?? clave;
}

const RANGO_BOTON = ["visible", "texto", "href", "estilo", "mensaje"];

/**
 * Las propiedades del esquema repartidas por apartado, en el orden del
 * esquema; las de botones, además, juntas por botón y en un orden fijo
 * (mostrar, texto, enlace, color) aunque el esquema las declare dispersas.
 */
export function agrupar(esquema: CampoEsquema | undefined): Record<ClaveGrupo, string[]> {
  const salida: Record<ClaveGrupo, string[]> = {
    contenido: [],
    imagenes: [],
    diseno: [],
    botones: [],
    legibilidad: [],
    estilo: [],
  };
  for (const [clave, campo] of Object.entries(esquema?.properties ?? {})) {
    salida[grupoDe(clave, campo)].push(clave);
  }
  const prefijos = [...new Set(salida.botones.map(prefijoDeBoton))];
  const rango = (clave: string) => {
    const resto = clave.slice(prefijoDeBoton(clave).length + 1);
    const i = RANGO_BOTON.indexOf(resto);
    return i === -1 ? RANGO_BOTON.length : i;
  };
  salida.botones.sort(
    (a, b) =>
      prefijos.indexOf(prefijoDeBoton(a)) - prefijos.indexOf(prefijoDeBoton(b)) || rango(a) - rango(b)
  );
  return salida;
}

/**
 * Las propiedades de un apartado devueltas a su valor de fábrica: el `default`
 * del esquema o, si no declara ninguno, ausentes (que es «vacío» para la tienda).
 */
export function restaurar(
  valores: Record<string, unknown>,
  claves: string[],
  esquema: CampoEsquema | undefined
): Record<string, unknown> {
  const siguiente = { ...valores };
  for (const clave of claves) {
    const defecto = esquema?.properties?.[clave]?.default;
    if (defecto === undefined) delete siguiente[clave];
    else siguiente[clave] = defecto;
  }
  return siguiente;
}

/** Si algún valor del apartado difiere de fábrica. */
export function difiere(
  valores: Record<string, unknown>,
  claves: string[],
  esquema: CampoEsquema | undefined
): boolean {
  return claves.some((clave) => {
    const v = valores[clave];
    const defecto = esquema?.properties?.[clave]?.default;
    if (v === undefined || v === "" || v === null) return defecto !== undefined && defecto !== "" && v !== undefined;
    return JSON.stringify(v) !== JSON.stringify(defecto);
  });
}
