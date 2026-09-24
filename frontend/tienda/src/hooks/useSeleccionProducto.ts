"use client";

import { useMemo, useState } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { agruparPresentaciones } from "@/componentes/PresentationSelector";
import { useCart } from "@/estado/carrito";
import { useAgregarAlCarrito } from "@/hooks/useAgregarAlCarrito";
import type { Producto } from "@/lib/tipos";
import { ajustarCantidad, pasoCantidad } from "@/lib/utiles";

/**
 * Todo lo que hace falta para comprar UN producto: qué variante y qué unidad
 * están elegidas, cuánto cuesta eso, cuánto se va a pedir y si ya está en el
 * pedido.
 *
 * Vivía escrito dentro de `ProductCard`; la vista rápida y la ficha de
 * producto necesitan exactamente lo mismo, y tres copias acabarían con tres
 * criterios distintos de "cuál es la presentación por defecto" o de qué pasa
 * al bajar de la cantidad mínima.
 *
 * # La cantidad: una sola, la que se ve
 *
 * Mientras la presentación elegida NO está en el pedido, la cantidad es un
 * borrador local y "Agregar" lo manda al carrito. Empieza en 1 —lo que se
 * pide casi siempre— aunque el producto admita medias: bajar a ½ es un clic.
 * En cuanto está dentro, el mismo control edita directamente esa línea del
 * carrito. Así el número que el cliente ve junto al producto nunca contradice
 * lo que va a pedir — no hay "tengo 3 en el pedido pero la tarjeta dice 1".
 */
export function useSeleccionProducto(producto: Producto, unidadPreferida: number | null = null) {
  const { agregar, agregado } = useAgregarAlCarrito();
  const cambiarCantidadCarrito = useCart((s) => s.cambiarCantidad);
  const quitar = useCart((s) => s.quitar);

  const paso = pasoCantidad(producto.permite_fraccion, producto.tipo_cantidad);
  const grupos = useMemo(
    () => agruparPresentaciones(producto.presentaciones),
    [producto.presentaciones]
  );

  // Con el filtro "Se vende por" puesto, la tarjeta arranca en esa unidad:
  // filtrar "por arroba" y ver el precio por libra sería contradecirse.
  const preferida =
    unidadPreferida === null
      ? null
      : grupos.flatMap((g) => g.opciones).find((p) => p.unidad_venta === unidadPreferida) ?? null;
  const [nombreSel, setNombreSel] = useState<string | null>(
    preferida?.nombre_presentacion ?? grupos[0]?.nombre ?? null
  );
  const [presId, setPresId] = useState<number | null>(
    preferida?.id ?? grupos[0]?.opciones[0]?.id ?? null
  );
  const inicial = Math.max(1, paso);
  const [borrador, setBorrador] = useState(inicial);

  const grupo = grupos.find((g) => g.nombre === nombreSel) ?? grupos[0] ?? null;
  const presentacion =
    grupo?.opciones.find((p) => p.id === presId) ?? grupo?.opciones[0] ?? null;

  const enCarrito = useCart((s) =>
    presentacion ? s.items.find((i) => i.presentacionId === presentacion.id) : undefined
  );

  const precioUnitario = presentacion ? parseFloat(presentacion.precio_unitario) : 0;
  const sinPresentaciones = grupos.length === 0;

  /**
   * Si se puede prometer o no.
   *
   * Solo cuenta cuando el producto lleva inventario: para todo lo demás
   * `disponible` no significa nada y tratar su ausencia como «agotado» dejaría
   * el catálogo entero sin botón de comprar.
   */
  const agotado = producto.controla_stock === true && Number(producto.disponible ?? 0) <= 0;

  /**
   * Hay negocios cuyo canal es el mostrador y no internet: su tienda es un
   * catálogo sin botón de pedir. Por defecto `true` para fallar hacia el
   * comportamiento de siempre, nunca hacia la tienda apagada.
   */
  const { config } = useSiteConfig();
  const recibePedidos = config.acepta_pedidos_online !== false;
  const puedePedir = Boolean(presentacion) && !agotado && recibePedidos;

  const cantidad = enCarrito ? enCarrito.cantidad : borrador;
  /** Bajar desde aquí saca la línea del pedido (solo si ya está dentro). */
  const enElMinimo = cantidad - paso < paso - 1e-6;

  function elegirVariante(nombre: string) {
    setNombreSel(nombre);
    // La unidad elegida puede no existir bajo la nueva variante: se cae a la
    // más barata del grupo en vez de dejar el producto sin presentación.
    setPresId(grupos.find((g) => g.nombre === nombre)?.opciones[0]?.id ?? null);
  }

  function fijarCantidad(valor: number) {
    const limpio = Math.max(paso, Number(valor.toFixed(2)));
    if (enCarrito && presentacion) cambiarCantidadCarrito(presentacion.id, limpio, paso);
    else setBorrador(limpio);
  }

  function subir() {
    fijarCantidad(ajustarCantidad(cantidad, paso, paso));
  }

  function bajar() {
    if (enCarrito && presentacion && enElMinimo) {
      quitar(presentacion.id);
      setBorrador(inicial);
      return;
    }
    fijarCantidad(ajustarCantidad(cantidad, -paso, paso));
  }

  function agregarAlPedido() {
    if (!presentacion || !puedePedir) return;
    agregar({
      productoId: producto.id,
      productoNombre: producto.nombre_producto,
      imagenUrl: producto.imagen_url,
      presentacionId: presentacion.id,
      presentacionNombre: `${presentacion.nombre_presentacion} · ${presentacion.unidad_venta_nombre}`,
      precioUnitario,
      cantidad: borrador,
      permiteFraccion: producto.permite_fraccion,
      tipoCantidad: producto.tipo_cantidad,
    });
    setBorrador(inicial);
  }

  return {
    grupos,
    grupo,
    presentacion,
    elegirVariante,
    elegirUnidad: setPresId,
    precioUnitario,
    sinPresentaciones,
    agotado,
    recibePedidos,
    puedePedir,
    paso,
    cantidad,
    enCarrito,
    enElMinimo,
    fijarCantidad,
    subir,
    bajar,
    agregarAlPedido,
    agregado,
  };
}

export type SeleccionProducto = ReturnType<typeof useSeleccionProducto>;
