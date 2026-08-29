"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCart } from "@/estado/carrito";
import { useUltimoPedido } from "@/estado/ultimoPedido";

export function RepetirPedido() {
  const { items, fecha } = useUltimoPedido();
  const agregar = useCart((s) => s.agregar);
  const router = useRouter();

  if (items.length === 0) return null;

  const fechaTexto = fecha
    ? new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "long" })
    : "";

  function repetirPedido() {
    items.forEach((item) => agregar(item));
    router.push("/tienda/pedido");
  }

  return (
    <section className="seccion">
      <div className="repetir-pedido glass">
        <span className="repetir-pedido-icono">
          <RotateCcw size={26} />
        </span>
        <div className="repetir-pedido-info">
          <h3>¿Pedimos lo mismo que la última vez?</h3>
          <p>
            Tu pedido del {fechaTexto} tenía {items.length}{" "}
            {items.length === 1 ? "producto" : "productos"}
          </p>
        </div>
        <button className="btn btn-verde" onClick={repetirPedido}>
          Repetir pedido
        </button>
      </div>
    </section>
  );
}
