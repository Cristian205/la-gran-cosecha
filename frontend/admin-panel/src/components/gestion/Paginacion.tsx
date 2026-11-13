import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Paginación de las tablas del panel.
 *
 * Es del NAVEGADOR a propósito: cada tabla ya trae su lista y la filtra y
 * ordena aquí (filtros por columna, orden al pulsar el encabezado). Paginar
 * en el servidor haría que esos filtros y el orden solo vieran una página.
 * Así que el orden es: lista → filtros → orden → **página**.
 *
 *   const pag = usePaginacion(listaOrdenada, "pedidos", [busqueda, estado]);
 *   <tabla con pag.visibles />
 *   <Paginacion {...pag} />
 *
 * - Vuelve a la página 1 cuando cambian los filtros (`reiniciarCon`).
 * - Si la lista se achica (se borró un registro), no se queda en una página
 *   que ya no existe.
 * - Recuerda el tamaño de página de cada tabla en este navegador.
 */
export const TAMANOS = [10, 25, 50, 100] as const;
const PREFIJO = "kryonx-paginacion-";

function leerTamano(clave: string, defecto: number): number {
  try {
    const n = Number(localStorage.getItem(PREFIJO + clave));
    return (TAMANOS as readonly number[]).includes(n) ? n : defecto;
  } catch {
    return defecto;
  }
}

export interface EstadoPaginacion<T> {
  visibles: T[];
  pagina: number;
  paginas: number;
  tamano: number;
  total: number;
  desde: number;
  hasta: number;
  irA: (pagina: number) => void;
  cambiarTamano: (tamano: number) => void;
}

export function usePaginacion<T>(
  lista: T[],
  clave: string,
  reiniciarCon: unknown[] = [],
  tamanoPorDefecto = 25
): EstadoPaginacion<T> {
  const [tamano, setTamano] = useState(() => leerTamano(clave, tamanoPorDefecto));
  const [pagina, setPagina] = useState(1);

  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / tamano));

  // Filtros nuevos → página 1.
  useEffect(() => {
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, reiniciarCon);

  // La lista se achicó: la última página válida.
  useEffect(() => {
    if (pagina > paginas) setPagina(paginas);
  }, [pagina, paginas]);

  const actual = Math.min(pagina, paginas);
  const visibles = useMemo(() => lista.slice((actual - 1) * tamano, actual * tamano), [lista, actual, tamano]);

  return {
    visibles,
    pagina: actual,
    paginas,
    tamano,
    total,
    desde: total === 0 ? 0 : (actual - 1) * tamano + 1,
    hasta: Math.min(actual * tamano, total),
    irA: (p) => setPagina(Math.min(Math.max(1, p), paginas)),
    cambiarTamano: (t) => {
      setTamano(t);
      setPagina(1);
      try {
        localStorage.setItem(PREFIJO + clave, String(t));
      } catch {
        // Navegación privada: solo se pierde el recuerdo.
      }
    },
  };
}

/** Los números que se muestran: 1 … 4 5 6 … 12 (siempre la primera y la última). */
function numeros(pagina: number, paginas: number): (number | "…")[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const salida: (number | "…")[] = [1];
  const inicio = Math.max(2, pagina - 1);
  const fin = Math.min(paginas - 1, pagina + 1);
  if (inicio > 2) salida.push("…");
  for (let i = inicio; i <= fin; i++) salida.push(i);
  if (fin < paginas - 1) salida.push("…");
  salida.push(paginas);
  return salida;
}

export function Paginacion<T>({
  pagina,
  paginas,
  tamano,
  total,
  desde,
  hasta,
  irA,
  cambiarTamano,
  etiqueta = "registros",
}: EstadoPaginacion<T> & { etiqueta?: string }) {
  // Con pocos registros no estorba: sin nada que paginar, no se pinta.
  if (total <= TAMANOS[0]) return null;

  return (
    <nav className="paginacion" aria-label="Paginación">
      <p className="paginacion-info" aria-live="polite">
        Mostrando <strong>{desde.toLocaleString("es-CO")}</strong>–<strong>{hasta.toLocaleString("es-CO")}</strong> de{" "}
        <strong>{total.toLocaleString("es-CO")}</strong> {etiqueta}
      </p>

      <div className="paginacion-controles">
        <label className="paginacion-tamano">
          <span>Por página</span>
          <select value={tamano} onChange={(e) => cambiarTamano(Number(e.target.value))} aria-label="Registros por página">
            {TAMANOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="paginacion-paginas">
          <button type="button" onClick={() => irA(1)} disabled={pagina === 1} aria-label="Primera página" className="paginacion-extremo">
            <ChevronsLeft size={15} />
          </button>
          <button type="button" onClick={() => irA(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
            <ChevronLeft size={15} />
          </button>
          {numeros(pagina, paginas).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="paginacion-puntos" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={`paginacion-num ${n === pagina ? "activa" : ""}`}
                onClick={() => irA(n)}
                aria-label={`Página ${n}`}
                aria-current={n === pagina ? "page" : undefined}
              >
                {n}
              </button>
            )
          )}
          <span className="paginacion-movil" aria-hidden="true">
            {pagina} / {paginas}
          </span>
          <button type="button" onClick={() => irA(pagina + 1)} disabled={pagina === paginas} aria-label="Página siguiente">
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            onClick={() => irA(paginas)}
            disabled={pagina === paginas}
            aria-label="Última página"
            className="paginacion-extremo"
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      </div>
    </nav>
  );
}
