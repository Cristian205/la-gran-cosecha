"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { useCart } from "@/estado/carrito";
import { useClienteTienda } from "@/estado/clienteTienda";
import { useUltimoPedido } from "@/estado/ultimoPedido";

interface Props {
  titulo?: string;
  boton_texto?: string;
}

/**
 * "¿Pedimos lo mismo?".
 *
 * En tiendas que identifican por cédula, el historial es del CLIENTE y no del
 * navegador: el bloque lleva a "Mis pedidos", donde elige cuál repetir y lo
 * ajusta antes de enviarlo. Por nombre, recuerda el último pedido hecho desde
 * este navegador, como siempre.
 */
export function RepetirPedido(props: Props) {
  const { config } = useSiteConfig();
  return config.identificacion_clientes === "cedula" ? (
    <RepetirPorCedula {...props} />
  ) : (
    <RepetirUltimoDelNavegador {...props} />
  );
}

function RepetirPorCedula({ titulo, boton_texto = "Ver mis pedidos" }: Props) {
  const nombre = useClienteTienda((s) => s.nombre);

  return (
    <section className="seccion">
      <div className="repetir-pedido glass">
        <span className="repetir-pedido-icono">
          <RotateCcw size={26} />
        </span>
        <div className="repetir-pedido-info">
          <h3>{titulo ?? (nombre ? `Hola, ${nombre}. ¿Repetimos un pedido?` : "¿Ya nos has pedido antes?")}</h3>
          <p>Consulta tus pedidos con tu cédula y repite cualquiera: puedes quitar o agregar productos.</p>
        </div>
        <Link className="btn btn-verde" href="/tienda/mis-pedidos">
          {boton_texto === "Repetir pedido" ? "Ver mis pedidos" : boton_texto}
        </Link>
      </div>
    </section>
  );
}

function RepetirUltimoDelNavegador({
  titulo = "¿Pedimos lo mismo que la última vez?",
  boton_texto = "Repetir pedido",
}: Props) {
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
          <h3>{titulo}</h3>
          <p>
            Tu pedido del {fechaTexto} tenía {items.length}{" "}
            {items.length === 1 ? "producto" : "productos"}
          </p>
        </div>
        <button className="btn btn-verde" onClick={repetirPedido}>
          {boton_texto}
        </button>
      </div>
    </section>
  );
}
