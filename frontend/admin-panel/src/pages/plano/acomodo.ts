import type { GrupoCarga, Pila, Posicion, Rejilla, ZonaPila } from "../../api/logistica";

/**
 * El acomodo de las canastillas, sin nada de 3D: funciones puras sobre las
 * PILAS del esquema que calcula el servidor. Una posición es (pila, nivel).
 *
 * Toda operación deja el acomodo FÍSICAMENTE POSIBLE —nada flotando, nada
 * encimado, nada fuera del esquema—, que es lo mismo que valida el servidor.
 */

const ORDEN_ZONA: Record<ZonaPila, number> = { frente: 0, izquierda: 1, derecha: 2, rejilla: 3 };

/**
 * Las pilas en el orden en que se llenan: de la cabina hacia la puerta (lo
 * que se entrega de último va al fondo), y a igual profundidad la fila
 * transversal, luego el lateral izquierdo y luego el derecho.
 */
export function pilasEnOrden(r: Rejilla): number[] {
  return r.pilas
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.x - b.p.x || ORDEN_ZONA[a.p.zona] - ORDEN_ZONA[b.p.zona] || a.p.y - b.p.y)
    .map(({ i }) => i);
}

/** Lo que se entrega de último primero (va al fondo); a igual orden, como se anotaron. */
function secuencia(grupos: GrupoCarga[], cuantas: (g: GrupoCarga) => number): string[] {
  return grupos
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.orden - a.g.orden || a.i - b.i)
    .flatMap(({ g }) => Array.from({ length: Math.max(0, cuantas(g)) }, () => g.id));
}

export interface ResultadoAcomodo {
  posiciones: Posicion[];
  /** Canastillas que no se pudieron ubicar, y por qué. */
  sinLugar: number;
  motivo: string | null;
}

/**
 * Acomodo automático. Conserva lo que hay en las pilas BLOQUEADAS y llena el
 * resto con la última parada hacia la cabina y la primera junto a las puertas.
 * Si sobran pilas, cada parada empieza su propia pila (no se mezclan destinos
 * sin necesidad) y se usan las más cercanas a las puertas. `tope` limita el total (p. ej. por la carga útil).
 * Nunca inventa espacio: lo que no cabe queda pendiente, con su motivo.
 * Mismo algoritmo que `planificacion.acomodar` en el servidor.
 */
export function acomodarAutomatico(
  grupos: GrupoCarga[],
  r: Rejilla,
  opciones: { bloqueos?: number[]; actuales?: Posicion[]; tope?: number | null } = {}
): ResultadoAcomodo {
  const bloqueadas = new Set(opciones.bloqueos ?? []);
  const fijas = (opciones.actuales ?? []).filter((p) => bloqueadas.has(p.pila));
  const yaFijas = new Map<string, number>();
  for (const p of fijas) yaFijas.set(p.grupo, (yaFijas.get(p.grupo) ?? 0) + 1);

  const orden = grupos
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.orden - a.g.orden || a.i - b.i)
    .map(({ g }) => ({ id: g.id, n: Math.max(0, g.cantidad - (yaFijas.get(g.id) ?? 0)) }));
  const porUbicar = orden.reduce((a, g) => a + g.n, 0);
  const todas = pilasEnOrden(r).filter((p) => !bloqueadas.has(p));
  const tope = opciones.tope ?? Infinity;
  const libres = Math.max(0, tope - fijas.length);
  const necesarias = r.niveles > 0 ? orden.reduce((a, g) => a + Math.ceil(g.n / r.niveles), 0) : todas.length + 1;
  const separadas = necesarias <= todas.length;
  // Sobra espacio: las pilas más cercanas a las puertas (la parada 1 en la puerta).
  const pilas = separadas ? todas.slice(todas.length - necesarias) : todas;

  const resultado: Posicion[] = [...fijas];
  let k = 0;
  let iPila = 0;
  let nivel = 0;
  fuera: for (const g of orden) {
    if (separadas && nivel > 0) {
      iPila++;
      nivel = 0;
    }
    for (let j = 0; j < g.n; j++) {
      if (k >= libres || iPila >= pilas.length) break fuera;
      resultado.push({ grupo: g.id, pila: pilas[iPila], nivel });
      k++;
      if (++nivel >= r.niveles) {
        iPila++;
        nivel = 0;
      }
    }
  }
  const sinLugar = porUbicar - k;
  let motivo: string | null = null;
  if (sinLugar > 0) {
    motivo =
      k >= libres && Number.isFinite(tope)
        ? `Se alcanzó la carga útil del vehículo: ${sinLugar} canastilla(s) superarían el peso permitido.`
        : `No hay más posiciones libres: el esquema tiene capacidad para ${r.capacidad} y faltan ${sinLugar}. ` +
          "Sube la altura de apilado, agrega posiciones en los laterales o divide el despacho en dos vehículos.";
  }
  return { posiciones: resultado, sinLugar, motivo };
}

/** Cuántas canastillas de cada grupo quedaron sin lugar. */
export function pendientesPorGrupo(grupos: GrupoCarga[], posiciones: Posicion[]): Map<string, number> {
  const ubicadas = new Map<string, number>();
  for (const p of posiciones) ubicadas.set(p.grupo, (ubicadas.get(p.grupo) ?? 0) + 1);
  return new Map(grupos.map((g) => [g.id, Math.max(0, g.cantidad - (ubicadas.get(g.id) ?? 0))]));
}

/** Cuántas canastillas tiene una pila. */
export function alturaPila(posiciones: Posicion[], pila: number): number {
  return posiciones.filter((p) => p.pila === pila).length;
}

/** Lo que hay en una pila, de abajo hacia arriba. */
export function contenidoPila(posiciones: Posicion[], pila: number): Posicion[] {
  return posiciones.filter((p) => p.pila === pila).sort((a, b) => a.nivel - b.nivel);
}

const misma = (a: Posicion, b: Posicion) => a.pila === b.pila && a.nivel === b.nivel;

/** Baja las canastillas de una pila para que no quede ninguna flotando. */
function compactar(posiciones: Posicion[], pila: number): Posicion[] {
  const resto = posiciones.filter((p) => p.pila !== pila);
  return [...resto, ...contenidoPila(posiciones, pila).map((p, nivel) => ({ ...p, nivel }))];
}

/** Intercambia de lugar dos canastillas (en realidad, sus destinos). */
export function intercambiar(posiciones: Posicion[], a: Posicion, b: Posicion): Posicion[] {
  return posiciones.map((p) => (misma(p, a) ? { ...p, grupo: b.grupo } : misma(p, b) ? { ...p, grupo: a.grupo } : p));
}

/** Lleva una canastilla a lo alto de otra pila; la de origen se compacta. */
export function moverAPila(posiciones: Posicion[], origen: Posicion, pila: number, r: Rejilla): Posicion[] {
  if (origen.pila === pila) return posiciones;
  const altura = alturaPila(posiciones, pila);
  if (altura >= r.niveles) return posiciones;
  const sin = compactar(posiciones.filter((p) => !misma(p, origen)), origen.pila);
  return [...sin, { grupo: origen.grupo, pila, nivel: altura }];
}

/** Saca una canastilla del furgón (queda pendiente). */
export function quitar(posiciones: Posicion[], origen: Posicion): Posicion[] {
  return compactar(posiciones.filter((p) => !misma(p, origen)), origen.pila);
}

/** Mete las pendientes en los huecos libres sin mover las demás (ni tocar bloqueadas). */
export function ubicarPendientes(
  grupos: GrupoCarga[],
  posiciones: Posicion[],
  r: Rejilla,
  bloqueos: number[] = [],
  tope: number | null = null
): Posicion[] {
  const faltan = pendientesPorGrupo(grupos, posiciones);
  const porUbicar = secuencia(grupos, (g) => faltan.get(g.id) ?? 0);
  const bloqueadas = new Set(bloqueos);
  const resultado = [...posiciones];
  const maximo = Math.max(0, (tope ?? Infinity) - posiciones.length);
  let k = 0;
  for (const pila of pilasEnOrden(r)) {
    if (bloqueadas.has(pila)) continue;
    let altura = alturaPila(posiciones, pila);
    while (altura < r.niveles && k < porUbicar.length && k < maximo) {
      resultado.push({ grupo: porUbicar[k++], pila, nivel: altura++ });
    }
  }
  return resultado;
}

/** Quita las posiciones de grupos borrados y las que sobran si bajó la cantidad. */
export function depurar(grupos: GrupoCarga[], posiciones: Posicion[]): Posicion[] {
  const cupo = new Map(grupos.map((g) => [g.id, g.cantidad]));
  const usadas = new Map<string, number>();
  const quedan: Posicion[] = [];
  for (const p of [...posiciones].sort((a, b) => a.nivel - b.nivel)) {
    const n = usadas.get(p.grupo) ?? 0;
    if (n < (cupo.get(p.grupo) ?? 0)) {
      usadas.set(p.grupo, n + 1);
      quedan.push(p);
    }
  }
  let resultado = quedan;
  for (const pila of new Set(posiciones.map((p) => p.pila))) resultado = compactar(resultado, pila);
  return resultado;
}

/**
 * Advertencias del orden de entrega, igual que el servidor: estorba lo que se
 * entrega DESPUÉS si queda encima en la misma pila, o —si a la pila se llega
 * desde la puerta— si queda más cerca de la puerta.
 */
export function estorbosDeOrden(grupos: GrupoCarga[], posiciones: Posicion[], r: Rejilla): string[] {
  const orden = new Map(grupos.map((g) => [g.id, g.orden]));
  const nombre = new Map(grupos.map((g) => [g.id, g.nombre]));
  const cuenta = new Map<string, number>();
  for (const b of posiciones) {
    for (const a of posiciones) {
      if ((orden.get(b.grupo) ?? 0) <= (orden.get(a.grupo) ?? 0)) continue;
      const pa = r.pilas[a.pila];
      const pb = r.pilas[b.pila];
      const encima = a.pila === b.pila && b.nivel > a.nivel;
      const delante = pa?.acceso === "puerta" && pb && pb.x > pa.x;
      if (encima || delante) {
        const k = `${b.grupo}|${a.grupo}`;
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
        break;
      }
    }
  }
  return [...cuenta.entries()].map(([k, n]) => {
    const [tarde, temprano] = k.split("|");
    return `${n} canastilla(s) de «${nombre.get(tarde)}» estorban a «${nombre.get(temprano)}», que se entrega antes.`;
  });
}

/** Paleta para grupos nuevos: distinguibles entre sí y legibles sobre blanco. */
export const COLORES_GRUPO = [
  "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569",
];

// ---------------------------------------------------------------------------
// Filas: cómo se nombra cada lugar para quien carga. Las filas se cuentan
// DESDE LA CABINA (fila 1 = la primera después de la fila delantera), igual
// en el plano 2D, el visor 3D y el PDF.
// ---------------------------------------------------------------------------

export interface FilaDePila {
  /** Agrupa las pilas de la misma fila (las dos laterales de la fila 3 comparten clave). */
  clave: string;
  titulo: string;
  orden: number;
  /** Lado o posición dentro de la fila. */
  lado: string;
  /** Número corto para dibujar en la pila. */
  corto: string;
}

export function filaDePila(p: Pila): FilaDePila {
  if (p.zona === "frente") {
    const n = Number(p.etiqueta.replace(/D/g, "")) || 1;
    return { clave: "frente", titulo: "Fila delantera", orden: 0, lado: `posición ${n}`, corto: `D${n}` };
  }
  if (p.zona === "izquierda" || p.zona === "derecha") {
    const n = Number(p.etiqueta.replace(/D/g, "")) || 1;
    return { clave: `l${n}`, titulo: `Fila ${n}`, orden: n, lado: p.zona === "izquierda" ? "Izquierda" : "Derecha", corto: String(n) };
  }
  const m = /^F(d+)-C(d+)$/.exec(p.etiqueta);
  const f = m ? Number(m[1]) : 1;
  return { clave: `f${f}`, titulo: `Fila ${f}`, orden: f, lado: `columna ${m ? m[2] : 1}`, corto: String(f) };
}

/** [1,2,3,5] → "1–3, 5". */
function rangos(nums: number[]): string {
  const o = [...new Set(nums)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < o.length; i++) {
    let j = i;
    while (j + 1 < o.length && o[j + 1] === o[j] + 1) j++;
    partes.push(i === j ? String(o[i]) : `${o[i]}–${o[j]}`);
    i = j;
  }
  return partes.join(", ");
}

/** «Lateral izquierdo, filas 1–3 · Fila delantera»: dónde quedó un destino, en palabras. */
export function ubicacionDe(r: Rejilla, posiciones: Posicion[], grupo: string): string {
  const por = new Map<ZonaPila, number[]>();
  for (const p of posiciones) {
    if (p.grupo !== grupo) continue;
    const pila = r.pilas[p.pila];
    if (!pila) continue;
    const l = por.get(pila.zona) ?? [];
    l.push(filaDePila(pila).orden);
    por.set(pila.zona, l);
  }
  const partes: string[] = [];
  if (por.has("frente")) partes.push("Fila delantera");
  for (const [zona, nombre] of [["izquierda", "Lateral izquierdo"], ["derecha", "Lateral derecho"]] as const) {
    const n = por.get(zona);
    if (n) partes.push(`${nombre}, ${new Set(n).size === 1 ? "fila" : "filas"} ${rangos(n)}`);
  }
  const rj = por.get("rejilla");
  if (rj) partes.push(`${new Set(rj).size === 1 ? "Fila" : "Filas"} ${rangos(rj)}`);
  return partes.join(" · ");
}

export interface FilaCarga {
  clave: string;
  titulo: string;
  orden: number;
  lados: Array<{ lado: string; pila: number; grupos: Array<{ grupo: string; canastillas: number }> }>;
}

/** La carga organizada por filas, de la cabina a las puertas (solo filas con algo). */
export function cargaPorFilas(r: Rejilla, posiciones: Posicion[]): FilaCarga[] {
  const filas = new Map<string, FilaCarga>();
  r.pilas.forEach((pila, i) => {
    const cont = contenidoPila(posiciones, i);
    if (!cont.length) return;
    const f = filaDePila(pila);
    const fila = filas.get(f.clave) ?? { clave: f.clave, titulo: f.titulo, orden: f.orden, lados: [] };
    const grupos: Array<{ grupo: string; canastillas: number }> = [];
    for (const p of cont) {
      const g = grupos.find((x) => x.grupo === p.grupo);
      if (g) g.canastillas++;
      else grupos.push({ grupo: p.grupo, canastillas: 1 });
    }
    fila.lados.push({ lado: f.lado, pila: i, grupos });
    filas.set(f.clave, fila);
  });
  return [...filas.values()].sort((a, b) => a.orden - b.orden);
}
