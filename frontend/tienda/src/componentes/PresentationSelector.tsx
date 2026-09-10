"use client";

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
 * Exportada porque quien use `PresentationSelector` (una tarjeta, una ficha de
 * producto, una fila de compra rápida) necesita el mismo agrupamiento para
 * calcular el precio de lo seleccionado — repetirlo en cada consumidor
 * acabaría con dos criterios de "cuál es la opción más barata".
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

interface Props {
  grupos: GrupoPresentacion[];
  grupoSeleccionado: GrupoPresentacion | null;
  presentacionSeleccionada: Presentacion | null;
  productoNombre: string;
  onElegirNombre: (nombre: string) => void;
  onElegirPresentacion: (id: number) => void;
  /** Compacto: una sola línea de texto en vez de dos `<select>`, para filas
   *  densas (compra rápida). Solo tiene sentido cuando hay una única
   *  combinación — si hay varias, elegir sigue exigiendo el control real. */
  compacto?: boolean;
}

/**
 * El selector de presentación de un producto: nombre + unidad de venta.
 *
 * Es un componente CONTROLADO a propósito: quien lo usa (`ProductCard` hoy,
 * una ficha de producto o una fila de compra rápida mañana) ya necesita la
 * presentación seleccionada para calcular el precio y armar el ítem del
 * carrito, así que el estado vive una sola vez, en el padre — no aquí y
 * también allá.
 *
 * Sin variedad que elegir no se dibuja nada: un selector con una sola opción
 * es una etiqueta redundante, no un control.
 */
export function PresentationSelector({
  grupos,
  grupoSeleccionado,
  presentacionSeleccionada,
  productoNombre,
  onElegirNombre,
  onElegirPresentacion,
  compacto = false,
}: Props) {
  const hayVariosNombres = grupos.length > 1;
  const hayVariasUnidades = (grupoSeleccionado?.opciones.length ?? 0) > 1;

  if (!hayVariosNombres && !hayVariasUnidades) return null;

  if (compacto) {
    return (
      <span className="pc-presentacion-compacta">
        {grupoSeleccionado?.nombre}
        {presentacionSeleccionada && ` · ${presentacionSeleccionada.unidad_venta_nombre}`}
      </span>
    );
  }

  return (
    <div className="pc-presentacion-linea">
      {hayVariosNombres ? (
        <select
          className="pc-presentacion"
          aria-label={`Presentación de ${productoNombre}`}
          value={grupoSeleccionado?.nombre ?? ""}
          onChange={(e) => onElegirNombre(e.target.value)}
        >
          {grupos.map((g) => (
            <option key={g.nombre} value={g.nombre}>
              {g.nombre}
            </option>
          ))}
        </select>
      ) : (
        <span className="pc-presentacion-fija">{grupoSeleccionado?.nombre}</span>
      )}

      <span className="pc-presentacion-x" aria-hidden="true">
        ×
      </span>

      {hayVariasUnidades ? (
        <select
          className="pc-presentacion"
          aria-label={`Unidad de ${grupoSeleccionado?.nombre}`}
          value={presentacionSeleccionada?.id ?? ""}
          onChange={(e) => onElegirPresentacion(Number(e.target.value))}
        >
          {grupoSeleccionado?.opciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.unidad_venta_nombre}
            </option>
          ))}
        </select>
      ) : (
        <span className="pc-presentacion-fija">{presentacionSeleccionada?.unidad_venta_nombre}</span>
      )}
    </div>
  );
}
