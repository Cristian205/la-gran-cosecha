/**
 * Lo que se le hace a una composición: añadir, mover, duplicar, quitar.
 *
 * Sin React. Son transformaciones de una lista a otra lista, y tenerlas aquí
 * —en vez de dentro del componente que dibuja los botones— es lo que permite
 * que los dos paneles hagan lo mismo aunque se vean distintos.
 *
 * Todas devuelven una lista NUEVA y ninguna muta la que recibe. Es lo que React
 * necesita para saber que algo cambió, pero además es lo que hace que deshacer
 * sea guardar la lista anterior y ya.
 */
import type { Bloque, BloqueColocado, CampoEsquema, Composicion, TokenTema } from "./tipos";
import { variablesDeEstilo } from "./diseno";

/**
 * Un identificador libre para un bloque nuevo.
 *
 * Se numera por tipo —`testimonios-1`, `testimonios-2`— y no con un aleatorio
 * porque estos ids salen en el JSON que alguien puede acabar leyendo, y
 * «testimonios-2» dice algo que «a7f3b1» no dice.
 *
 * El servidor rechaza los repetidos: si el id se repite, arrastrar un bloque en
 * el editor movería dos.
 */
export function nuevoId(tipo: string, existentes: Composicion): string {
  const usados = new Set(existentes.map((b) => b.id));
  let n = 1;
  while (usados.has(`${tipo}-${n}`)) n += 1;
  return `${tipo}-${n}`;
}

/** Los valores por defecto que declara el esquema de un bloque. */
export function valoresPorDefecto(
  esquema: CampoEsquema | undefined
): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, campo] of Object.entries(esquema?.properties ?? {})) {
    if (campo.default !== undefined) salida[clave] = campo.default;
  }
  return salida;
}

/**
 * Un bloque recién colocado.
 *
 * Nace con la primera variante y con los valores por defecto de su esquema, y
 * SIN estilo propio. Lo último importa: sembrarlo con los valores del tema
 * congelaría el aspecto de hoy y la sección dejaría de seguir a la tienda
 * cuando el negocio cambiara de color.
 */
export function bloqueNuevo(bloque: Bloque, existentes: Composicion): BloqueColocado {
  return {
    id: nuevoId(bloque.codigo, existentes),
    tipo: bloque.codigo,
    variante: bloque.variantes[0]?.codigo ?? "",
    props: valoresPorDefecto(bloque.esquema_props),
    visible: { movil: true, tablet: true, escritorio: true },
    estilo: {},
  };
}

/** Mueve un bloque de posición. Fuera de rango, no hace nada. */
export function mover(composicion: Composicion, desde: number, hasta: number): Composicion {
  if (desde === hasta || hasta < 0 || hasta >= composicion.length) return composicion;
  const copia = [...composicion];
  const [pieza] = copia.splice(desde, 1);
  copia.splice(hasta, 0, pieza);
  return copia;
}

/**
 * Duplica un bloque justo debajo del original.
 *
 * Debajo y no al final: quien duplica una sección casi siempre quiere las dos
 * juntas —dos banners seguidos, dos rejillas— y mandarla al final obliga a
 * arrastrarla de vuelta.
 */
export function duplicar(composicion: Composicion, id: string): Composicion {
  const i = composicion.findIndex((b) => b.id === id);
  if (i < 0) return composicion;
  const copia = {
    ...composicion[i],
    id: nuevoId(composicion[i].tipo, composicion),
    // Copia profunda de las props. Los dos editores duplicaban con un `spread`
    // suelto, que comparte el objeto: hoy no rompe nada porque sus formularios
    // reemplazan en vez de mutar —`{...valores, [clave]: v}`—, así que esto no
    // arregla un fallo, cierra la puerta a uno.
    //
    // Y la puerta está abierta de verdad: en cuanto alguien escriba
    // `props.pasos.push(...)` en un editor de listas, duplicar una sección
    // empezaría a editar las dos a la vez, y el sitio donde se buscaría el
    // fallo sería el formulario, no esta línea.
    props: structuredClone(composicion[i].props),
    estilo: { ...composicion[i].estilo },
    visible: { ...composicion[i].visible },
  };
  return [...composicion.slice(0, i + 1), copia, ...composicion.slice(i + 1)];
}

export function quitar(composicion: Composicion, id: string): Composicion {
  return composicion.filter((b) => b.id !== id);
}

/** Cambia lo que sea de un bloque, dejando el resto igual. */
export function actualizar(
  composicion: Composicion,
  id: string,
  cambios: Partial<BloqueColocado>
): Composicion {
  return composicion.map((b) => (b.id === id ? { ...b, ...cambios } : b));
}

/**
 * Los bloques únicos que ya están puestos.
 *
 * Lo usa el catálogo del editor para no ofrecer lo que el servidor va a
 * rechazar. Decirlo antes es mejor que dejar pulsar y explicar después.
 */
export function tiposPuestos(composicion: Composicion): Set<string> {
  return new Set(composicion.map((b) => b.tipo));
}

/**
 * La composición lista para la previa en vivo: con el estilo de cada bloque
 * ya traducido a variables CSS.
 *
 * Existe porque la previa viaja por `postMessage` y nunca pasa por
 * `composicion.para_la_tienda` del servidor, que es quien hace esta
 * traducción para la tienda publicada. La composición que se guarda —y la que
 * editan `Propiedades`/`Diseno`— sigue por código; esta es una copia aparte,
 * solo para lo que se manda al iframe.
 */
export function composicionParaPrevia(
  composicion: Composicion,
  catalogo: TokenTema[]
): Composicion {
  return composicion.map((b) => ({ ...b, estilo: variablesDeEstilo(b.estilo, catalogo) }));
}
