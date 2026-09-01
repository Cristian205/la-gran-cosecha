"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/estado/carrito";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { ajustarCantidad, formatoCantidad, formatoPrecio, pasoCantidad } from "@/lib/utiles";

export function CartDrawer({ onCerrar }: { onCerrar: () => void }) {
  const { items, personalizados, cambiarCantidad, quitar, quitarPersonalizado, totalLineas, totalPrecio } =
    useCart();
  const router = useRouter();

  function irAlCheckout() {
    onCerrar();
    router.push("/tienda/pedido");
  }

  return (
    <>
      <div className="overlay" onClick={onCerrar} />
      <aside className="drawer">
        <header>
          <h2>
            <ShoppingBag size={19} /> Tu carrito
          </h2>
          <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={22} />
          </button>
        </header>

        <div className="items">
          {items.length === 0 && personalizados.length === 0 ? (
            <div className="vacio">Tu carrito está vacío</div>
          ) : (
            <>
            {items.map((i) => {
              const paso = pasoCantidad(i.permiteFraccion, i.tipoCantidad);
              return (
                <div className="item" key={i.presentacionId}>
                  <div className="info">
                    <div className="n">{i.productoNombre}</div>
                    <div className="p">{i.presentacionNombre}</div>
                    <div className="precio">
                      {formatoPrecio(i.precioUnitario)} c/u ·{" "}
                      <b>{formatoPrecio(i.precioUnitario * i.cantidad)}</b>
                    </div>
                  </div>
                  <div className="stepper stepper-sm">
                    <button
                      type="button"
                      aria-label="Disminuir cantidad"
                      onClick={() =>
                        cambiarCantidad(
                          i.presentacionId,
                          ajustarCantidad(i.cantidad, -paso, paso),
                          paso
                        )
                      }
                    >
                      <Minus size={12} />
                    </button>
                    {i.permiteFraccion ? (
                      <span className="qty-valor" aria-live="polite">
                        {formatoCantidad(i.cantidad, true)}
                      </span>
                    ) : (
                      <input
                        className="qty"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={i.cantidad}
                        onChange={(e) => {
                          const n = Math.round(Number(e.target.value));
                          cambiarCantidad(i.presentacionId, n > 0 ? n : 1, 1);
                        }}
                      />
                    )}
                    <button
                      type="button"
                      aria-label="Aumentar cantidad"
                      onClick={() =>
                        cambiarCantidad(
                          i.presentacionId,
                          ajustarCantidad(i.cantidad, paso, paso),
                          paso
                        )
                      }
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    className="quitar"
                    onClick={() => quitar(i.presentacionId)}
                    aria-label="Quitar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
            {personalizados.map((p) => (
              <div className="item" key={p.id}>
                <div className="info">
                  <div className="n">{p.nombre}</div>
                  <div className="p">
                    {p.cantidad} {p.unidadNombre || "unid."} · fuera de catálogo
                  </div>
                </div>
                <button
                  className="quitar"
                  onClick={() => quitarPersonalizado(p.id)}
                  aria-label="Quitar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            </>
          )}
        </div>

        <footer>
          <div className="total-linea sub">
            <span>Productos</span>
            <span>{totalLineas()}</span>
          </div>
          <div className="total-linea">
            <span>Total estimado</span>
            <span>{formatoPrecio(totalPrecio())}</span>
          </div>
          <AvisoPrecios compacto />
          <button
            className="btn btn-verde btn-block"
            disabled={items.length === 0 && personalizados.length === 0}
            onClick={irAlCheckout}
          >
            Continuar pedido
          </button>
        </footer>
      </aside>
    </>
  );
}
