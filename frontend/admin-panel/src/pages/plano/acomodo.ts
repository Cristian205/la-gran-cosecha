import type { GrupoCarga, Posicion, Rejilla } from "../../api/logistica";

/**
 * El acomodo de las canastillas, sin nada de 3D: funciones puras sobre la
 * rejilla (fila 0 = fondo contra la cabina, última fila = puerta).
 *
 * Toda operación deja el acomodo FÍSICAMENTE POSIBLE —nada flotando, nada
 * encimado, nada fuera del furgón—, que es lo mismo que valida el servidor.
 */

const clave = (fila: number, columna: number, nivel: number) => `${fila}:${columna}:${nivel}`;

/**
 * El orden en que se llenan los huecos: del fondo hacia la puerta, de
 * izquierda a derecha, y cada pila de abajo hacia arriba. Así una pila suele
 * ser de un solo destino y se descarga entera.
 */
function huecosEnOrden(r: Rejilla): Array<Omit<Posicion, "grupo">> {
  const huecos: Array<Omit<Posicion, "grupo">> = [];
  for (let fila = 0; fila < r.filas; fila++)
    for (let columna = 0; columna < r.columnas; columna++)
      for (let nivel = 0; nivel < r.niveles; nivel++) huecos.push({ fila, columna, nivel });
  return huecos;
}

/**
 * Lo que se entrega de ÚLTIMO va al fondo; lo primero, junto a la puerta.
 * Con el mismo orden de entrega, se respeta el orden en que se anotaron.
 */
export function acomodarAutomatico(grupos: GrupoCarga[], r: Rejilla): Posicion[] {
  const secuencia = grupos
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.orden - a.g.orden || a.i - b.i)
    .flatMap(({ g }) => Array.from({ length: g.cantidad }, () => g.id));
  const huecos = huecosEnOrden(r);
  return secuencia.slice(0, huecos.length).map((grupo, i) => ({ grupo, ...huecos[i] }));
}

/** Cuántas canastillas de cada grupo quedaron sin lugar. */
export function pendientesPorGrupo(grupos: GrupoCarga[], posiciones: Posicion[]): Map<string, number> {
  const ubicadas = new Map<string, number>();
  for (const p of posiciones) ubicadas.set(p.grupo, (ubicadas.get(p.grupo) ?? 0) + 1);
  return new Map(grupos.map((g) => [g.id, Math.max(0, g.cantidad - (ubicadas.get(g.id) ?? 0))]));
}

/** Baja las canastillas de una pila para que no quede ninguna flotando. */
function compactarPila(posiciones: Posicion[], fila: number, columna: number): Posicion[] {
  const pila = posiciones
    .filter((p) => p.fila === fila && p.columna === columna)
    .sort((a, b) => a.nivel - b.nivel);
  const resto = posiciones.filter((p) => !(p.fila === fila && p.columna === columna));
  return [...resto, ...pila.map((p, nivel) => ({ ...p, nivel }))];
}

/** Altura actual de una pila (cuántas tiene). */
export function alturaPila(posiciones: Posicion[], fila: number, columna: number): number {
  return posiciones.filter((p) => p.fila === fila && p.columna === columna).length;
}

/** Intercambia de lugar dos canastillas (en realidad, sus grupos). */
export function intercambiar(posiciones: Posicion[], a: Posicion, b: Posicion): Posicion[] {
  const ka = clave(a.fila, a.columna, a.nivel);
  const kb = clave(b.fila, b.columna, b.nivel);
  return posiciones.map((p) => {
    const k = clave(p.fila, p.columna, p.nivel);
    if (k === ka) return { ...p, grupo: b.grupo };
    if (k === kb) return { ...p, grupo: a.grupo };
    return p;
  });
}

/**
 * Lleva una canastilla a lo alto de otra pila. La pila de la que sale se
 * compacta: lo que tenía encima baja un nivel.
 */
export function moverAPila(posiciones: Posicion[], origen: Posicion, fila: number, columna: number, r: Rejilla): Posicion[] {
  if (origen.fila === fila && origen.columna === columna) return posiciones;
  const destino = alturaPila(posiciones, fila, columna);
  if (destino >= r.niveles) return posiciones;
  const k = clave(origen.fila, origen.columna, origen.nivel);
  const sin = posiciones.filter((p) => clave(p.fila, p.columna, p.nivel) !== k);
  const compactado = compactarPila(sin, origen.fila, origen.columna);
  return [...compactado, { grupo: origen.grupo, fila, columna, nivel: destino }];
}

/** Saca una canastilla del furgón (queda pendiente). */
export function quitar(posiciones: Posicion[], origen: Posicion): Posicion[] {
  const k = clave(origen.fila, origen.columna, origen.nivel);
  return compactarPila(
    posiciones.filter((p) => clave(p.fila, p.columna, p.nivel) !== k),
    origen.fila,
    origen.columna
  );
}

/**
 * Mete las pendientes en los huecos libres, en el mismo orden del acomodo
 * automático, sin mover las que ya están. Solo usa huecos con su pila completa
 * debajo, para no dejar ninguna flotando.
 */
export function ubicarPendientes(grupos: GrupoCarga[], posiciones: Posicion[], r: Rejilla): Posicion[] {
  const faltan = pendientesPorGrupo(grupos, posiciones);
  const secuencia = grupos
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.orden - a.g.orden || a.i - b.i)
    .flatMap(({ g }) => Array.from({ length: faltan.get(g.id) ?? 0 }, () => g.id));
  const resultado = [...posiciones];
  const alturas = new Map<string, number>();
  for (const p of posiciones) alturas.set(`${p.fila}:${p.columna}`, (alturas.get(`${p.fila}:${p.columna}`) ?? 0) + 1);
  let i = 0;
  for (let fila = 0; fila < r.filas && i < secuencia.length; fila++)
    for (let columna = 0; columna < r.columnas && i < secuencia.length; columna++) {
      let altura = alturas.get(`${fila}:${columna}`) ?? 0;
      while (altura < r.niveles && i < secuencia.length) {
        resultado.push({ grupo: secuencia[i++], fila, columna, nivel: altura++ });
      }
    }
  return resultado;
}

/** Quita las posiciones de grupos borrados y las que sobran si bajó la cantidad. */
export function depurar(grupos: GrupoCarga[], posiciones: Posicion[]): Posicion[] {
  const cupo = new Map(grupos.map((g) => [g.id, g.cantidad]));
  // Se descartan primero las de más arriba, para no dejar huecos debajo.
  const ordenadas = [...posiciones].sort((a, b) => a.nivel - b.nivel);
  const usadas = new Map<string, number>();
  const quedan: Posicion[] = [];
  for (const p of ordenadas) {
    const n = usadas.get(p.grupo) ?? 0;
    if (n < (cupo.get(p.grupo) ?? 0)) {
      usadas.set(p.grupo, n + 1);
      quedan.push(p);
    }
  }
  // Compacta todas las pilas tocadas.
  let resultado = quedan;
  const pilas = new Set(posiciones.map((p) => `${p.fila}:${p.columna}`));
  for (const pila of pilas) {
    const [f, c] = pila.split(":").map(Number);
    resultado = compactarPila(resultado, f, c);
  }
  return resultado;
}

/** Paleta para grupos nuevos: distinguibles entre sí y legibles sobre blanco. */
export const COLORES_GRUPO = [
  "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569",
];
