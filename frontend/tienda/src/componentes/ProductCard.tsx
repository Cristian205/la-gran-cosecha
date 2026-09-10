"use client";

import { Sprout } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import { useCart } from "@/estado/carrito";
import type { Producto } from "@/lib/tipos";
import { ajustarCantidad, colorCategoria, formatoPrecio, pasoCantidad } from "@/lib/utiles";
import { TEXTO_PRECIOS_ESTIMADOS } from "@/componentes/AvisoPrecios";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { agruparPresentaciones, PresentationSelector } from "@/componentes/PresentationSelector";
import { QuantityControl } from "@/componentes/QuantityControl";
import { AddToCartButton } from "@/componentes/AddToCartButton";
import { claseDeVariante } from "@/bloques/Seccion";

const precio = (p: { precio_unitario: string }) => parseFloat(p.precio_unitario);

/**
 * `estandar` es la tarjeta de siempre. `compacta` es una fila —imagen chica,
 * nombre y precio en línea, mismo stepper y mismo botón— para donde una
 * tarjeta grande sobra: compra rápida, un carrusel denso, una lista larga.
 * Mismos datos, mismos componentes por dentro (`PresentationSelector`,
 * `QuantityControl`, `AddToCartButton`); solo cambia cómo se acomodan.
 */
const VARIANTES = ["estandar", "compacta"] as const;

interface Props {
  producto: Producto;
  variante?: string;
}

export function ProductCard({ producto, variante }: Props) {
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

  function subirCantidad() {
    if (!presSeleccionada) return;
    if (enCarrito) {
      cambiarCantidad(
        presSeleccionada.id,
        ajustarCantidad(enCarrito.cantidad, paso, paso),
        paso
      );
    } else {
      handleAgregar();
    }
  }

  /**
   * Si se puede prometer o no.
   *
   * Solo cuenta cuando el producto lleva inventario: para todo lo demás
   * `disponible` no significa nada y tratar su ausencia como «agotado» dejaría
   * el catálogo entero sin botón de comprar. La comprobación es explícita por
   * eso, y no un `Number(...) > 0` a secas.
   */
  const agotado = producto.controla_stock === true && Number(producto.disponible ?? 0) <= 0;

  /**
   * Hay negocios cuyo canal es el mostrador y no internet.
   *
   * Su tienda sigue siendo un catálogo —se ve, se busca, se comparte—; lo que
   * no tiene es botón de pedir. El valor por defecto es `true` para que un
   * negocio cuya configuración aún no ha llegado siga vendiendo: fallar hacia
   * el comportamiento de siempre, nunca hacia la tienda apagada.
   */
  const { config } = useSiteConfig();
  const recibePedidos = config.acepta_pedidos_online !== false;
  const noSePuedePedir = agotado || !recibePedidos;

  const clase = claseDeVariante(variante, VARIANTES, "producto-card", "estandar");
  const esCompacta = clase.endsWith("compacta");

  const imagen = producto.imagen_url ? (
    <img src={producto.imagen_url} alt={producto.nombre_producto} loading="lazy" decoding="async" />
  ) : (
    <Sprout size={esCompacta ? 22 : 38} strokeWidth={1.5} />
  );

  const controlDeCompra = sinPresentaciones ? null : !recibePedidos ? null : enCarrito ? (
    <QuantityControl
      cantidad={enCarrito.cantidad}
      permiteFraccion={producto.permite_fraccion}
      enElMinimo={enElMinimo}
      leyenda={esCompacta ? undefined : "en tu pedido"}
      nombreProducto={producto.nombre_producto}
      onDisminuir={bajarCantidad}
      onAumentar={subirCantidad}
    />
  ) : (
    <AddToCartButton
      disabled={!presSeleccionada || noSePuedePedir}
      agotado={agotado}
      nombreProducto={producto.nombre_producto}
      precioUnitario={precioUnitario}
      onClick={handleAgregar}
      compacto={esCompacta}
    />
  );

  if (esCompacta) {
    return (
      <article
        className={`producto-card ${clase} ${agregado ? "pc-agregado" : ""} ${agotado ? "pc-agotado" : ""}`}
        id={`producto-${producto.id}`}
      >
        <div className="pc-media" style={{ "--cat-grad": colorCategoria(producto.categoria) } as CSSProperties}>
          {imagen}
          {agotado && <span className="pc-cinta-agotado">Agotado</span>}
        </div>

        <div className="pc-compacta-info">
          <h3 className="pc-nombre" title={producto.nombre_producto}>
            {producto.nombre_producto}
          </h3>
          {sinPresentaciones ? (
            <span className="pc-vacio">Sin presentaciones</span>
          ) : (
            <PresentationSelector
              grupos={grupos}
              grupoSeleccionado={grupoSel}
              presentacionSeleccionada={presSeleccionada}
              productoNombre={producto.nombre_producto}
              onElegirNombre={elegirNombre}
              onElegirPresentacion={setPresId}
              compacto
            />
          )}
        </div>

        {!sinPresentaciones && (
          <span className="pc-precio-valor pc-precio-compacta">{formatoPrecio(precioUnitario)}</span>
        )}

        {controlDeCompra}
      </article>
    );
  }

  return (
    <article
      className={`producto-card glass ${agregado ? "pc-agregado" : ""} ${agotado ? "pc-agotado" : ""}`}
      id={`producto-${producto.id}`}
    >
      <div
        className="pc-media"
        style={{ "--cat-grad": colorCategoria(producto.categoria) } as CSSProperties}
      >
        {imagen}
        {agotado && <span className="pc-cinta-agotado">Agotado</span>}
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

            <PresentationSelector
              grupos={grupos}
              grupoSeleccionado={grupoSel}
              presentacionSeleccionada={presSeleccionada}
              productoNombre={producto.nombre_producto}
              onElegirNombre={elegirNombre}
              onElegirPresentacion={setPresId}
            />

            {controlDeCompra}
          </>
        )}
      </div>
    </article>
  );
}
