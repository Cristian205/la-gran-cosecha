import { Divide, Minus, Plus, ShoppingBasket, Sprout } from "lucide-react";
import { useMemo, useState } from "react";
import { useCart } from "../store/cart";
import type { Producto } from "../types";
import { ajustarCantidad, colorCategoria, formatoCantidad, pasoCantidad } from "../utils";

export function ProductCard({ producto }: { producto: Producto }) {
  const agregar = useCart((s) => s.agregar);
  const presentaciones = producto.presentaciones;
  const paso = pasoCantidad(producto.permite_fraccion, producto.tipo_cantidad);

  // Agrupa las presentaciones por nombre para no repetirlo en el selector
  // (una misma "Libra", "Bulto", etc. puede existir en varias unidades).
  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof presentaciones>();
    for (const p of presentaciones) {
      if (!mapa.has(p.nombre_presentacion)) mapa.set(p.nombre_presentacion, []);
      mapa.get(p.nombre_presentacion)!.push(p);
    }
    return mapa;
  }, [presentaciones]);

  const nombres = useMemo(() => Array.from(grupos.keys()), [grupos]);

  const [presNombre, setPresNombre] = useState<string | null>(nombres[0] ?? null);
  const opcionesUnidad = presNombre ? grupos.get(presNombre) ?? [] : [];
  const [presId, setPresId] = useState<number | null>(opcionesUnidad[0]?.id ?? null);
  const [cantidad, setCantidad] = useState(paso);

  const presSeleccionada = useMemo(
    () => presentaciones.find((p) => p.id === presId) ?? null,
    [presId, presentaciones]
  );

  const sinPresentaciones = presentaciones.length === 0;
  const precioUnitario = presSeleccionada ? parseFloat(presSeleccionada.precio_unitario) : 0;

  function elegirPresentacion(nombre: string) {
    setPresNombre(nombre);
    const primera = grupos.get(nombre)?.[0];
    setPresId(primera ? primera.id : null);
  }

  function handleAgregar() {
    if (!presSeleccionada) return;
    agregar({
      productoId: producto.id,
      productoNombre: producto.nombre_producto,
      imagenUrl: producto.imagen_url,
      presentacionId: presSeleccionada.id,
      presentacionNombre: `${presSeleccionada.nombre_presentacion} · ${presSeleccionada.unidad_venta_nombre}`,
      precioUnitario,
      cantidad,
      permiteFraccion: producto.permite_fraccion,
      tipoCantidad: producto.tipo_cantidad,
    });
    setCantidad(paso);
  }

  return (
    <article className="producto-card glass" id={`producto-${producto.id}`}>
      <div className="pc-media">
        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt={producto.nombre_producto} loading="lazy" />
        ) : (
          <Sprout size={44} strokeWidth={1.5} />
        )}
        <span
          className="pc-cat-pill"
          style={{ background: colorCategoria(producto.categoria) }}
        >
          {producto.categoria_nombre}
        </span>
        {producto.permite_fraccion && (
          <span className="pc-badge">
            <Divide size={12} />
            Por fracción
          </span>
        )}
      </div>

      <div className="pc-body">
        <header className="pc-head">
          <h3 className="pc-nombre">{producto.nombre_producto}</h3>
          <span className="pc-cod">{producto.codigo_producto}</span>
        </header>

        {sinPresentaciones ? (
          <div className="pc-vacio">Sin presentaciones disponibles</div>
        ) : (
          <>
            <div className="pc-campo">
              <span className="pc-label">Presentación</span>
              <div className="pc-pills" role="radiogroup" aria-label="Presentación">
                {nombres.map((nombre) => (
                  <button
                    key={nombre}
                    type="button"
                    role="radio"
                    aria-checked={nombre === presNombre}
                    className={`pc-pill ${nombre === presNombre ? "activo" : ""}`}
                    onClick={() => elegirPresentacion(nombre)}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className="pc-campo">
              <span className="pc-label">Cantidad</span>
              <div className="pc-cantidad-linea">
                <div className="pc-stepper">
                  <button
                    type="button"
                    aria-label="Disminuir cantidad"
                    onClick={() => setCantidad((c) => ajustarCantidad(c, -paso, paso))}
                  >
                    <Minus size={14} />
                  </button>

                  {producto.permite_fraccion ? (
                    <span className="pc-cantidad-valor" aria-live="polite">
                      {formatoCantidad(cantidad, true)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={cantidad}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value));
                        setCantidad(n > 0 ? n : 1);
                      }}
                    />
                  )}

                  <button
                    type="button"
                    aria-label="Aumentar cantidad"
                    onClick={() => setCantidad((c) => ajustarCantidad(c, paso, paso))}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {opcionesUnidad.length > 1 ? (
                  <select
                    className="pc-unidad-select"
                    aria-label="Unidad"
                    value={presId ?? ""}
                    onChange={(e) => setPresId(Number(e.target.value))}
                  >
                    {opcionesUnidad.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.unidad_venta_nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  opcionesUnidad[0] && (
                    <span className="pc-unidad-fija">{opcionesUnidad[0].unidad_venta_nombre}</span>
                  )
                )}
              </div>
            </div>

            <button
              className="pc-btn-add"
              onClick={handleAgregar}
              disabled={!presSeleccionada}
            >
              <ShoppingBasket size={16} />
              <span>Agregar</span>
            </button>
          </>
        )}
      </div>
    </article>
  );
}
