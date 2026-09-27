import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { obtenerProductos } from "../../../api/resources";
import type { Producto } from "../../../types";
import { normalizarTexto } from "../../../utils";

/**
 * Los productos que una sección destaca, elegidos a mano y en orden.
 *
 * Guarda solo los ids: el nombre, la foto y el precio se leen del catálogo al
 * pintar la tienda, así que cambiar un precio no obliga a tocar la portada
 * (lo promocional no duplica el catálogo). Un producto desactivado o borrado
 * simplemente no se muestra.
 */
let cache: Promise<Producto[]> | null = null;
const catalogo = () => (cache ??= obtenerProductos({ estado: "activos" }).catch(() => []));

export function CampoProductos({
  etiqueta,
  ayuda,
  valor,
  maximo = 12,
  onCambio,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: number[];
  maximo?: number;
  onCambio: (ids: number[]) => void;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let vivo = true;
    catalogo().then((p) => vivo && setProductos(p));
    return () => {
      vivo = false;
    };
  }, []);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const elegidos = valor.filter((id) => porId.has(id) || productos.length === 0);
  const resultados = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    if (!q) return [];
    return productos
      .filter((p) => !valor.includes(p.id) && normalizarTexto(p.nombre_producto).includes(q))
      .slice(0, 8);
  }, [busqueda, productos, valor]);

  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= valor.length) return;
    const copia = [...valor];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onCambio(copia);
  }

  return (
    <div className="campo">
      <label>{etiqueta}</label>
      {ayuda && <p className="campo-ayuda">{ayuda}</p>}

      {elegidos.length > 0 && (
        <ol className="campo-productos">
          {valor.map((id, i) => {
            const p = porId.get(id);
            return (
              <li key={id}>
                <span className="campo-productos-foto">
                  {p?.imagen_url ? <img src={p.imagen_url} alt="" /> : (p?.nombre_producto ?? "?").charAt(0)}
                </span>
                <span className="campo-productos-nombre">{p?.nombre_producto ?? `Producto #${id} (no disponible)`}</span>
                <button type="button" className="btn-icon" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                  <ArrowUp size={13} />
                </button>
                <button type="button" className="btn-icon" onClick={() => mover(i, 1)} disabled={i === valor.length - 1} aria-label="Bajar">
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  className="btn-icon peligro"
                  onClick={() => onCambio(valor.filter((x) => x !== id))}
                  aria-label={`Quitar ${p?.nombre_producto ?? "producto"}`}
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {valor.length < maximo ? (
        <div className="campo-productos-buscar">
          <Search size={14} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={valor.length ? "Agregar otro producto…" : "Buscar un producto para destacar…"}
            aria-label="Buscar producto para agregar"
          />
          {resultados.length > 0 && (
            <ul className="campo-productos-resultados" role="listbox">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => {
                      onCambio([...valor, p.id]);
                      setBusqueda("");
                    }}
                  >
                    {p.nombre_producto}
                    <small>{p.categoria_nombre}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="campo-ayuda">Llegaste al máximo de {maximo} productos.</p>
      )}
    </div>
  );
}
