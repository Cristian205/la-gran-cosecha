"use client";

import { Minus, Plus, ShoppingBasket, Sprout, Trash2 } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import { useCart } from "@/estado/carrito";
import type { Presentacion, Producto } from "@/lib/tipos";
import {
  ajustarCantidad,
  colorCategoria,
  formatoCantidad,
  formatoPrecio,
  pasoCantidad,
} from "@/lib/utiles";
import { TEXTO_PRECIOS_ESTIMADOS } from "@/componentes/AvisoPrecios";

interface GrupoPresentacion {
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
 */
function agruparPresentaciones(presentaciones: Presentacion[]): GrupoPresentacion[] {
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

export function ProductCard({ producto }: { producto: Producto }) {
  const { agregar, agregado } = useAgregarAlCarrito();
  const cambiarCantidad = useCart((s) => s.cambiarCantidad);
  const quitar = useCart((s) => s.quitar);

  const paso = pasoCantidad(producto.permite_fraccion, producto.tipo_cantidad);

  const grupos = useMemo(
    () => agruparPresentaciones(producto.presentaciones),
    [producto.presentaciones]
  );

  const [nombreSel, setNombreSel] = useState<string | null>(grupos[0]?.nombre ?? null);
  const [presId, setPresId] = useState<number | null>(grupos[0]?.opciones[0]?.id ?? null);

  const grupoSel = grupos.find((g) => g.nombre === nombreSel) ?? grupos[0] ?? null;
  const presSeleccionada =
    grupoSel?.opciones.find((p) => p.id === presId) ?? grupoSel?.opciones[0] ?? null;

  // La cantidad ya no vive en la tarjeta: mientras el producto no está en el
  // pedido solo hace falta "Agregar", y una vez dentro el stepper edita
  // directamente la línea del carrito. Cada tarjeta pierde una fila y la
  // cantidad mostrada no puede desincronizarse de lo que se va a pedir.
  const enCarrito = useCart((s) =>
    presSeleccionada
      ? s.items.find((i) => i.presentacionId === presSeleccionada.id)
      : undefined
  );

  const sinPresentaciones = grupos.length === 0;
  const precioUnitario = presSeleccionada ? precio(presSeleccionada) : 0;

  const hayVariosNombres = grupos.length > 1;
  const hayVariasUnidades = (grupoSel?.opciones.length ?? 0) > 1;
  const enElMinimo = enCarrito ? enCarrito.cantidad - paso < paso - 1e-6 : false;

  function elegirNombre(nombre: string) {
    setNombreSel(nombre);
    // La unidad elegida puede no existir bajo el nuevo nombre, así que caemos a
    // la más barata del grupo en vez de dejar la tarjeta sin presentación.
    setPresId(grupos.find((g) => g.nombre === nombre)?.opciones[0]?.id ?? null);
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
      cantidad: 1,
      permiteFraccion: producto.permite_fraccion,
      tipoCantidad: producto.tipo_cantidad,
    });
  }

  function bajarCantidad() {
    if (!enCarrito || !presSeleccionada) return;
    // Bajar del mínimo saca la línea del pedido: es lo que el cliente espera y
    // evita dejar cantidades imposibles como 0.
    if (enElMinimo) quitar(presSeleccionada.id);
    else
      cambiarCantidad(
        presSeleccionada.id,
        ajustarCantidad(enCarrito.cantidad, -paso, paso),
        paso
      );
  }

  return (
    <article
      className={`producto-card glass ${agregado ? "pc-agregado" : ""}`}
      id={`producto-${producto.id}`}
    >
      <div
        className="pc-media"
        style={{ "--cat-grad": colorCategoria(producto.categoria) } as CSSProperties}
      >
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre_producto}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <Sprout size={38} strokeWidth={1.5} />
        )}
      </div>

      <div className="pc-body">
        <h3 className="pc-nombre" title={producto.nombre_producto}>
          {producto.nombre_producto}
        </h3>

        <span className="pc-cat">
          <i style={{ background: colorCategoria(producto.categoria) }} />
          {producto.categoria_nombre}
        </span>

        {sinPresentaciones ? (
          <div className="pc-vacio">Sin presentaciones disponibles</div>
        ) : (
          <>
            <p className="pc-precio">
              <span className="pc-precio-valor">{formatoPrecio(precioUnitario)}</span>
              {/* El precio depende del mercado del día; AvisoPrecios explica
                  el porqué sin repetirlo entero en cada tarjeta. */}
              <span className="pc-precio-aprox" title={TEXTO_PRECIOS_ESTIMADOS}>
                aprox.
              </span>
              {presSeleccionada && (
                <span className="pc-precio-unidad">
                  / {presSeleccionada.unidad_venta_nombre}
                </span>
              )}
            </p>

            {(hayVariosNombres || hayVariasUnidades) && (
              <div className="pc-presentacion-linea">
                {hayVariosNombres ? (
                  <select
                    className="pc-presentacion"
                    aria-label={`Presentación de ${producto.nombre_producto}`}
                    value={grupoSel?.nombre ?? ""}
                    onChange={(e) => elegirNombre(e.target.value)}
                  >
                    {grupos.map((g) => (
                      <option key={g.nombre} value={g.nombre}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="pc-presentacion-fija">{grupoSel?.nombre}</span>
                )}

                <span className="pc-presentacion-x" aria-hidden="true">
                  ×
                </span>

                {hayVariasUnidades ? (
                  <select
                    className="pc-presentacion"
                    aria-label={`Unidad de ${grupoSel?.nombre}`}
                    value={presSeleccionada?.id ?? ""}
                    onChange={(e) => setPresId(Number(e.target.value))}
                  >
                    {grupoSel?.opciones.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.unidad_venta_nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="pc-presentacion-fija">
                    {presSeleccionada?.unidad_venta_nombre}
                  </span>
                )}
              </div>
            )}

            {enCarrito ? (
              <div className="pc-stepper pc-stepper-carrito">
                <button
                  type="button"
                  onClick={bajarCantidad}
                  aria-label={
                    enElMinimo
                      ? `Quitar ${producto.nombre_producto} del pedido`
                      : "Disminuir cantidad"
                  }
                >
                  {enElMinimo ? <Trash2 size={15} /> : <Minus size={15} />}
                </button>
                <span className="pc-cantidad-valor" aria-live="polite">
                  {formatoCantidad(enCarrito.cantidad, producto.permite_fraccion)}
                  <i>en tu pedido</i>
                </span>
                <button
                  type="button"
                  aria-label="Aumentar cantidad"
                  onClick={() =>
                    presSeleccionada &&
                    cambiarCantidad(
                      presSeleccionada.id,
                      ajustarCantidad(enCarrito.cantidad, paso, paso),
                      paso
                    )
                  }
                >
                  <Plus size={15} />
                </button>
              </div>
            ) : (
              <button
                className="pc-btn-add"
                onClick={handleAgregar}
                disabled={!presSeleccionada}
                aria-label={`Agregar ${producto.nombre_producto} al pedido · ${formatoPrecio(
                  precioUnitario
                )}`}
              >
                <ShoppingBasket size={16} />
                <span>Agregar</span>
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
