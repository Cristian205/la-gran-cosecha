"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Clock,
  Leaf,
  Package,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
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

export interface Beneficio {
  titulo: string;
  texto?: string;
  icono?: string;
}

const ICONOS_BENEFICIO: Record<string, LucideIcon> = {
  hoja: Leaf,
  caja: Package,
  tienda: Store,
  camion: Truck,
  reloj: Clock,
  escudo: ShieldCheck,
};

/**
 * El mismo "¿Ya nos has pedido antes?" como panel lateral de "Los favoritos
 * de los negocios": la sección le habla a la vez al que llega por primera
 * vez (el banner) y al que vuelve (este panel). La lógica es la del bloque
 * de arriba, sin cambios:
 *
 *   · por cédula → "Ver mis pedidos", donde se consulta el historial y se
 *     repite cualquiera (ahí se identifica, no aquí);
 *   · por nombre → el último pedido de este navegador, con "Repetir pedido";
 *     si no hay ninguno, el panel lo dice y no ofrece nada que no existe.
 *
 * Debajo, los beneficios que el negocio configure en el bloque (pueden ir
 * vacíos).
 */
export function PanelPedidosAnteriores({ beneficios = [] }: { beneficios?: Beneficio[] }) {
  const { config } = useSiteConfig();
  const porCedula = config.identificacion_clientes === "cedula";
  const nombre = useClienteTienda((s) => s.nombre);
  const { items, fecha } = useUltimoPedido();
  const agregar = useCart((s) => s.agregar);
  const router = useRouter();

  let titulo = "¿Ya nos has pedido antes?";
  let texto: string;
  let accion: ReactNode = null;

  if (porCedula) {
    if (nombre) titulo = `Hola, ${nombre}. ¿Repetimos?`;
    texto = "Consulta tu historial con tu cédula y repite cualquier pedido en minutos.";
    accion = (
      <Link className="favs-panel-cta" href="/tienda/mis-pedidos">
        Ver mis pedidos <ArrowRight size={16} aria-hidden="true" />
      </Link>
    );
  } else if (items.length > 0) {
    const fechaTexto = fecha ? new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "long" }) : "";
    texto = `Tu pedido${fechaTexto ? ` del ${fechaTexto}` : ""} tenía ${items.length} ${
      items.length === 1 ? "producto" : "productos"
    }. Agrégalo de nuevo y ajústalo antes de enviarlo.`;
    accion = (
      <button
        type="button"
        className="favs-panel-cta"
        onClick={() => {
          items.forEach((item) => agregar(item));
          router.push("/tienda/pedido");
        }}
      >
        Repetir pedido <ArrowRight size={16} aria-hidden="true" />
      </button>
    );
  } else {
    texto = "Cuando hagas tu primer pedido desde este equipo, podrás repetirlo aquí con un toque.";
  }

  const lista = beneficios.filter((b) => b.titulo?.trim());

  return (
    <aside className="favs-panel" aria-label="Pedidos anteriores">
      <div className="favs-panel-cabeza">
        <span className="favs-panel-icono" aria-hidden="true">
          <RotateCcw size={22} />
        </span>
        <div className="favs-panel-texto">
          <h3>{titulo}</h3>
          <p>{texto}</p>
        </div>
      </div>
      {accion}
      {lista.length > 0 && (
        <ul className="favs-panel-beneficios">
          {lista.map((b, i) => {
            const Icono = ICONOS_BENEFICIO[b.icono ?? ""] ?? Leaf;
            return (
              <li key={`${b.titulo}-${i}`}>
                <span className="favs-panel-beneficio-icono" aria-hidden="true">
                  <Icono size={18} strokeWidth={1.75} />
                </span>
                <span>
                  <b>{b.titulo}</b>
                  {b.texto && <small>{b.texto}</small>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
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
