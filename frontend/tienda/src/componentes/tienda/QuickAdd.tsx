"use client";

import { Check, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import type { SeleccionProducto } from "@/hooks/useSeleccionProducto";
import { formatoCantidad, formatoPrecio, parsearCantidad } from "@/lib/utiles";

interface CantidadProps {
  seleccion: SeleccionProducto;
  productoNombre: string;
  permiteFraccion: boolean;
  tamano?: "normal" | "grande";
}

/**
 * El − cantidad + de un producto.
 *
 * El número se puede ESCRIBIR, no solo empujar con los botones: un pedido de
 * abastecimiento es de "30 libras" o "12 bultos", y llegar ahí a clics es
 * justo la fricción que esta pantalla tiene que quitar. Al enfocarlo muestra
 * el decimal ("1.5") y al salir vuelve a la fracción legible ("1 1/2"), la
 * misma notación que usa el mostrador.
 */
export function Cantidad({ seleccion, productoNombre, permiteFraccion, tamano = "normal" }: CantidadProps) {
  const { cantidad, enCarrito, enElMinimo, paso, subir, bajar, fijarCantidad } = seleccion;
  const [texto, setTexto] = useState<string | null>(null);
  const quitaDelPedido = Boolean(enCarrito) && enElMinimo;

  function confirmar() {
    if (texto === null) return;
    const valor = parsearCantidad(texto, paso);
    if (valor !== null) fijarCantidad(valor);
    setTexto(null);
  }

  return (
    <div className={`qty qty--${tamano}`} role="group" aria-label={`Cantidad de ${productoNombre}`}>
      <button
        type="button"
        onClick={bajar}
        disabled={!enCarrito && enElMinimo}
        aria-label={quitaDelPedido ? `Quitar ${productoNombre} del pedido` : "Disminuir cantidad"}
      >
        {quitaDelPedido ? <Trash2 size={15} /> : <Minus size={15} />}
      </button>
      <input
        // El `key` reinicia la animación del número en cada cambio: es la
        // señal de que el pedido respondió al clic.
        key={cantidad}
        className="qty-valor"
        inputMode="decimal"
        aria-label={enCarrito ? "Cantidad en tu pedido" : "Cantidad a agregar"}
        value={texto ?? formatoCantidad(cantidad, permiteFraccion)}
        onFocus={(e) => {
          setTexto(String(cantidad));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTexto(null);
            e.currentTarget.blur();
          }
        }}
      />
      <button type="button" onClick={subir} aria-label="Aumentar cantidad">
        <Plus size={15} />
      </button>
    </div>
  );
}

interface QuickAddProps {
  seleccion: SeleccionProducto;
  productoNombre: string;
  permiteFraccion: boolean;
  tamano?: "normal" | "grande";
  /** Texto largo en el botón ("Agregar al pedido") donde hay espacio. */
  textoLargo?: boolean;
}

/**
 * Cantidad + Agregar, en una línea: comprar sin entrar a la ficha.
 *
 * El botón tiene tres estados y cada uno dice algo distinto:
 *   Agregar      — la presentación elegida no está en el pedido.
 *   ✓ Agregado   — acaba de entrar (dura un instante, con un "pop").
 *   ✓ En pedido  — ya está dentro; el − + de al lado edita esa línea, y
 *                  pulsar el botón abre el pedido.
 */
export function QuickAdd({ seleccion, productoNombre, permiteFraccion, tamano = "normal", textoLargo = false }: QuickAddProps) {
  const { abrirCarrito } = useEnvoltorio();
  const { puedePedir, agotado, recibePedidos, enCarrito, agregado, agregarAlPedido, precioUnitario, sinPresentaciones } =
    seleccion;

  if (sinPresentaciones || !recibePedidos) return null;

  if (agotado) {
    return (
      <div className={`qadd qadd--${tamano}`}>
        <button type="button" className="qadd-btn qadd-btn--agotado" disabled>
          Agotado
        </button>
      </div>
    );
  }

  const estado = agregado ? "agregado" : enCarrito ? "en-pedido" : "listo";

  return (
    <div className={`qadd qadd--${tamano}`}>
      <Cantidad
        seleccion={seleccion}
        productoNombre={productoNombre}
        permiteFraccion={permiteFraccion}
        tamano={tamano}
      />
      <button
        type="button"
        className={`qadd-btn qadd-btn--${estado}`}
        onClick={enCarrito && !agregado ? abrirCarrito : agregarAlPedido}
        disabled={!puedePedir}
        aria-label={
          estado === "listo"
            ? `Agregar ${productoNombre} al pedido · ${formatoPrecio(precioUnitario)} aprox.`
            : `${productoNombre} está en tu pedido. Ver pedido`
        }
      >
        {estado === "listo" ? (
          <>
            <ShoppingBasket size={16} aria-hidden="true" />
            <span className="qadd-btn-texto">{textoLargo ? "Agregar al pedido" : "Agregar"}</span>
          </>
        ) : (
          <>
            <Check size={16} aria-hidden="true" />
            <span className="qadd-btn-texto">{estado === "agregado" ? "Agregado" : "En pedido"}</span>
          </>
        )}
      </button>
    </div>
  );
}
