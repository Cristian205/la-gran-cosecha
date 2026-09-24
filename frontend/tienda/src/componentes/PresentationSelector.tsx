import type { Presentacion } from "@/lib/tipos";

export interface GrupoPresentacion {
  nombre: string;
  /** Unidades disponibles para ese nombre, de menor a mayor precio. */
  opciones: Presentacion[];
}

const precio = (p: Presentacion) => parseFloat(p.precio_unitario);

/**
 * Agrupa las presentaciones por nombre. Un mismo "Tommy" puede venderse por
 * unidad, kilo y caja: listarlo tres veces obliga a leer el mismo nombre una y
 * otra vez, así que el nombre se elige una vez y la unidad por separado.
 * Grupos y opciones van de menor a mayor precio, para que lo primero que se
 * ofrece sea siempre la entrada más barata.
 *
 * Es la única fuente de "cuál es la presentación por defecto": la usan
 * `useSeleccionProducto` (tarjeta, vista rápida, ficha) y las campañas del
 * Inicio. Repetirla en cada consumidor acabaría con dos criterios de "cuál es
 * la opción más barata". El selector que antes vivía en este archivo pasó a
 * `componentes/tienda/SelectorPresentacion.tsx`.
 */
export function agruparPresentaciones(presentaciones: Presentacion[]): GrupoPresentacion[] {
  const mapa = new Map<string, Presentacion[]>();
  for (const p of presentaciones) {
    const grupo = mapa.get(p.nombre_presentacion);
    if (grupo) grupo.push(p);
    else mapa.set(p.nombre_presentacion, [p]);
  }
  return Array.from(mapa, ([nombre, opciones]) => ({
    nombre,
    opciones: [...opciones].sort((a, b) => precio(a) - precio(b)),
  })).sort((a, b) => precio(a.opciones[0]) - precio(b.opciones[0]));
}
