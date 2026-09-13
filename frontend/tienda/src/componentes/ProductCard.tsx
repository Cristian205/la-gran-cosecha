"use client";

import { ArrowRight, Check } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import { useCart } from "@/estado/carrito";
import type { Producto } from "@/lib/tipos";
import { ajustarCantidad, colorCategoria, formatoPrecio, iconoCategoria, pasoCantidad } from "@/lib/utiles";
import { TEXTO_PRECIOS_ESTIMADOS } from "@/componentes/AvisoPrecios";
import { useEnvoltorio, useSiteConfig } from "@/componentes/CapaCliente";
import { agruparPresentaciones, PresentationSelector } from "@/componentes/PresentationSelector";
import { QuantityControl } from "@/componentes/QuantityControl";
import { AddToCartButton } from "@/componentes/AddToCartButton";
import { claseDeVariante } from "@/bloques/Seccion";
import { Reveal } from "@/componentes/animacion";

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
  /** Una cinta comercial ("Más pedido", "Favorito"). Opt-in: la pasa quien
   *  arma la rejilla (hoy solo `MasVendidos` en el Home), no el catálogo. */
  etiqueta?: string;
  /** Su posición dentro de la rejilla, solo para escalonar la entrada — cada
   *  tarjeta aparece un poco después que la anterior en vez de todas a la vez. */
  indice?: number;
}

export function ProductCard({ producto, variante, etiqueta, indice = 0 }: Props) {
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
  const { abrirCarrito } = useEnvoltorio();
  const recibePedidos = config.acepta_pedidos_online !== false;
  const noSePuedePedir = agotado || !recibePedidos;

  const clase = claseDeVariante(variante, VARIANTES, "producto-card", "estandar");
  const esCompacta = clase.endsWith("compacta");

  const IconoRespaldo = iconoCategoria(producto.categoria_nombre);
  const imagen = producto.imagen_url ? (
    <img src={producto.imagen_url} alt={producto.nombre_producto} loading="lazy" decoding="async" />
  ) : (
    <IconoRespaldo size={esCompacta ? 22 : 38} />
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

  const retraso = Math.min(indice, 7) * 0.05;

  if (esCompacta) {
    return (
      <Reveal
        as="article"
        className={`producto-card ${clase} ${agregado ? "pc-agregado" : ""} ${agotado ? "pc-agotado" : ""}`}
        id={`producto-${producto.id}`}
        retraso={retraso}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.98 }}
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
      </Reveal>
    );
  }

  return (
    <Reveal
      as="article"
      className={`producto-card glass ${agregado ? "pc-agregado" : ""} ${agotado ? "pc-agotado" : ""}`}
      id={`producto-${producto.id}`}
      retraso={retraso}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className="pc-media"
        style={{ "--cat-grad": colorCategoria(producto.categoria) } as CSSProperties}
      >
        {imagen}
        {!agotado && etiqueta && <span className="pc-cinta-destacado">{etiqueta}</span>}
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

            {/* Solo mientras dura el destello de "agregado": un empujoncito
                hacia el pedido, no un enlace permanente que le reste espacio
                a la tarjeta el resto del tiempo. */}
            {agregado && (
              <button type="button" className="pc-ver-pedido" onClick={abrirCarrito}>
                <Check size={13} /> Agregado · Ver pedido <ArrowRight size={13} />
              </button>
            )}
          </>
        )}
      </div>
    </Reveal>
  );
}
