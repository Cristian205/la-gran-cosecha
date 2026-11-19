import { CalendarClock, ClipboardList, History, Package, Store, Truck, UserRound } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { PedidoDetalle } from "../../../types";
import { EstadoPedido } from "../pedidosUi";
import { Esqueleto } from "./piezas";

export type Pestana = "resumen" | "productos" | "entrega" | "historial";

export function fechaHoraLarga(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** La franja bajo el título: estado, origen, cliente y cuándo llegó. */
export function MetaPedido({ pedido }: { pedido: PedidoDetalle | null }) {
  if (!pedido) {
    return (
      <span className="gp-meta">
        <Esqueleto ancho={74} alto={20} radio={999} />
        <Esqueleto ancho={180} alto={14} />
      </span>
    );
  }
  return (
    <span className="gp-meta">
      <EstadoPedido estado={pedido.estado} />
      <span className="gp-meta-origen">
        <Store size={13} aria-hidden="true" /> Pedido recibido desde la tienda
      </span>
      <span className="gp-meta-dato">
        <UserRound size={13} aria-hidden="true" />
        <strong>{pedido.cliente_nombre || "Cliente sin registrar"}</strong>
      </span>
      <span className="gp-meta-dato">
        <CalendarClock size={13} aria-hidden="true" />
        <time dateTime={pedido.fecha_pedido}>{fechaHoraLarga(pedido.fecha_pedido)}</time>
      </span>
    </span>
  );
}

interface DefPestana {
  clave: Pestana;
  etiqueta: string;
  icono: ReactNode;
}

const PESTANAS: DefPestana[] = [
  { clave: "resumen", etiqueta: "Resumen", icono: <ClipboardList size={15} /> },
  { clave: "productos", etiqueta: "Productos", icono: <Package size={15} /> },
  { clave: "entrega", etiqueta: "Entrega", icono: <Truck size={15} /> },
  { clave: "historial", etiqueta: "Historial", icono: <History size={15} /> },
];

export function PestanasPedido({
  activa,
  onCambiar,
  contadores,
  pendientes,
  conError,
  idBase,
}: {
  activa: Pestana;
  onCambiar: (p: Pestana) => void;
  contadores: Partial<Record<Pestana, number | null>>;
  /** Pestañas con cambios sin guardar. */
  pendientes: Partial<Record<Pestana, boolean>>;
  /** Pestañas con datos inválidos. */
  conError: Partial<Record<Pestana, boolean>>;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    const i = PESTANAS.findIndex((p) => p.clave === activa);
    let siguiente = -1;
    if (e.key === "ArrowRight") siguiente = (i + 1) % PESTANAS.length;
    if (e.key === "ArrowLeft") siguiente = (i - 1 + PESTANAS.length) % PESTANAS.length;
    if (e.key === "Home") siguiente = 0;
    if (e.key === "End") siguiente = PESTANAS.length - 1;
    if (siguiente < 0) return;
    e.preventDefault();
    onCambiar(PESTANAS[siguiente].clave);
    refs.current[siguiente]?.focus();
  }

  return (
    <div className="gp-pestanas" role="tablist" aria-label="Secciones del pedido" onKeyDown={alTeclear}>
      {PESTANAS.map((p, i) => {
        const seleccionada = p.clave === activa;
        const contador = contadores[p.clave];
        return (
          <button
            key={p.clave}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${idBase}-tab-${p.clave}`}
            aria-selected={seleccionada}
            aria-controls={`${idBase}-panel-${p.clave}`}
            tabIndex={seleccionada ? 0 : -1}
            className={`gp-pestana ${seleccionada ? "activa" : ""}`}
            onClick={() => onCambiar(p.clave)}
          >
            {p.icono}
            <span>{p.etiqueta}</span>
            {contador != null && <span className="gp-pestana-contador">{contador}</span>}
            {conError[p.clave] ? (
              <span className="gp-pestana-punto error" title="Hay datos por corregir" />
            ) : pendientes[p.clave] ? (
              <span className="gp-pestana-punto" title="Cambios sin guardar" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
