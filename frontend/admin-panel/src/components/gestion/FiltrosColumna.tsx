import { Filter, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { normalizarTexto } from "../../utils";
import { fechaISO } from "../../utils/fechas";

/**
 * Filtros por columna: un botón «Filtros» junto a «Columnas» que despliega,
 * bajo cada encabezado, el filtro de esa columna. Reemplaza los filtros
 * rápidos sueltos de la barra: cada filtro vive debajo de lo que filtra.
 *
 * Cada vista declara, por clave de columna, qué tipo de filtro lleva:
 *
 * - `texto`: contiene (sin tildes ni mayúsculas).
 * - `opciones`: un combobox con valores cerrados (WhatsApp, rol, estado…).
 * - `numero`: «al menos» este valor.
 * - `fecha`: empieza por lo escrito, en el mismo formato ISO de la tabla:
 *   «2026» filtra el año, «2026-09» el mes y «2026-09-01» el día.
 *
 * El filtrado es en el navegador, sobre la lista que la vista ya tiene.
 */
export type DefFiltro<T> =
  | { tipo: "texto"; valor: (fila: T) => string; placeholder?: string }
  | { tipo: "opciones"; valor: (fila: T) => string; opciones: { valor: string; etiqueta: string }[] }
  | { tipo: "numero"; valor: (fila: T) => number }
  | { tipo: "fecha"; valor: (fila: T) => string | null | undefined };

export type DefsFiltros<T> = Partial<Record<string, DefFiltro<T>>>;

function coincide<T>(def: DefFiltro<T>, fila: T, buscado: string): boolean {
  switch (def.tipo) {
    case "texto":
      return normalizarTexto(def.valor(fila) ?? "").includes(normalizarTexto(buscado));
    case "opciones":
      return def.valor(fila) === buscado;
    case "numero": {
      const minimo = Number(buscado.replace(",", "."));
      return Number.isNaN(minimo) || def.valor(fila) >= minimo;
    }
    case "fecha": {
      const iso = def.valor(fila);
      return Boolean(iso) && fechaISO(iso).startsWith(buscado.trim());
    }
  }
}

export function useFiltrosColumna<T>(defs: DefsFiltros<T>) {
  const [abiertos, setAbiertos] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});

  const activos = useMemo(
    () => Object.entries(valores).filter(([clave, v]) => v.trim() && defs[clave]).length,
    [valores, defs]
  );

  const cambiar = useCallback((clave: string, valor: string) => {
    setValores((prev) => ({ ...prev, [clave]: valor }));
  }, []);

  const limpiar = useCallback(() => setValores({}), []);

  const aplicar = useCallback(
    (lista: T[]) => {
      const vigentes = Object.entries(valores).filter(([clave, v]) => v.trim() && defs[clave]);
      if (vigentes.length === 0) return lista;
      return lista.filter((fila) => vigentes.every(([clave, v]) => coincide(defs[clave]!, fila, v)));
    },
    [valores, defs]
  );

  return {
    abiertos,
    alternar: () => setAbiertos((a) => !a),
    abrir: () => setAbiertos(true),
    valores,
    cambiar,
    limpiar,
    activos,
    aplicar,
  };
}

export function BotonFiltros({
  abiertos,
  activos,
  onAlternar,
}: {
  abiertos: boolean;
  activos: number;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn-filtros ${abiertos ? "abierto" : ""} ${activos ? "con-valor" : ""}`}
      aria-pressed={abiertos}
      onClick={onAlternar}
    >
      <Filter size={15} aria-hidden="true" /> Filtros
      {activos > 0 && (
        <span className="btn-filtros-num" aria-label={`${activos} activos`}>
          {activos}
        </span>
      )}
    </button>
  );
}

/**
 * La fila de filtros, dentro del `<thead>` y alineada columna por columna.
 * `antes` y `despues` son las celdas que no se filtran (casillas, acciones).
 */
export function FilaFiltros<T>({
  columnas,
  defs,
  etiquetas,
  valores,
  onCambiar,
  antes = 0,
  despues = 1,
}: {
  columnas: string[];
  defs: DefsFiltros<T>;
  etiquetas: Record<string, string>;
  valores: Record<string, string>;
  onCambiar: (clave: string, valor: string) => void;
  antes?: number;
  despues?: number;
}) {
  return (
    <tr className="fila-filtros">
      {Array.from({ length: antes }).map((_, i) => (
        <th key={`antes-${i}`} aria-hidden="true" />
      ))}
      {columnas.map((clave) => {
        const def = defs[clave];
        const valor = valores[clave] ?? "";
        const etiqueta = `Filtrar ${etiquetas[clave]?.toLowerCase() ?? clave}`;
        if (!def) return <th key={clave} aria-hidden="true" />;
        return (
          <th key={clave}>
            <div className={`filtro-col ${valor ? "con-valor" : ""}`}>
              {def.tipo === "opciones" ? (
                <select value={valor} onChange={(e) => onCambiar(clave, e.target.value)} aria-label={etiqueta}>
                  <option value="">Todos</option>
                  {def.opciones.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="search"
                  inputMode={def.tipo === "numero" ? "decimal" : def.tipo === "fecha" ? "numeric" : undefined}
                  value={valor}
                  placeholder={
                    def.tipo === "numero"
                      ? "Mín."
                      : def.tipo === "fecha"
                        ? "AAAA-MM-DD"
                        : def.placeholder ?? "Contiene…"
                  }
                  onChange={(e) => onCambiar(clave, e.target.value)}
                  aria-label={etiqueta}
                />
              )}
              {valor && def.tipo !== "opciones" && (
                <button type="button" className="filtro-col-limpiar" onClick={() => onCambiar(clave, "")} aria-label={`Quitar el filtro de ${etiquetas[clave] ?? clave}`}>
                  <X size={12} />
                </button>
              )}
            </div>
          </th>
        );
      })}
      {Array.from({ length: despues }).map((_, i) => (
        <th key={`despues-${i}`} aria-hidden="true" />
      ))}
    </tr>
  );
}
