import { CheckCircle2, ClipboardList, Layers, Route, ShieldCheck, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Pastilla, type Tono } from "../../components/gestion/Gestion";
import type { EstadoLote, ParadaLote } from "../../api/lotes";
import type { PedidoPlanificacion } from "../../api/logistica";

/**
 * Las piezas que comparten la lista de lotes y el tablero de un lote: cómo se
 * nombra cada estado, cómo se cuentan las canastillas y los formatos de texto.
 * Las cifras se calculan igual que en el servidor (`apps/logistica/lotes.py`)
 * para que la pantalla no muestre un número y el PDF otro.
 */

export const ESTADOS: Record<EstadoLote, { texto: string; tono: Tono; icono: ReactNode; ayuda: string }> = {
  PREPARACION: {
    texto: "En preparación",
    tono: "azul",
    icono: <ClipboardList size={14} />,
    ayuda: "El reparto se está revisando: todavía no hay planos de carga.",
  },
  PREPARADO: {
    texto: "Despachos preparados",
    tono: "violeta",
    icono: <Layers size={14} />,
    ayuda: "Cada vehículo tiene su plano de carga en borrador; se puede seguir corrigiendo.",
  },
  CONFIRMADO: {
    texto: "Confirmado",
    tono: "verde",
    icono: <ShieldCheck size={14} />,
    ayuda: "Los despachos quedaron confirmados y sus datos congelados.",
  },
  EN_RUTA: {
    texto: "En ruta",
    tono: "ambar",
    icono: <Truck size={14} />,
    ayuda: "Los vehículos salieron a entregar.",
  },
  ENTREGADO: {
    texto: "Entregado",
    tono: "verde",
    icono: <CheckCircle2 size={14} />,
    ayuda: "El día se cerró: sus pedidos quedaron entregados.",
  },
  ANULADO: {
    texto: "Anulado",
    tono: "neutro",
    icono: <Route size={14} />,
    ayuda: "Se descartó; sus pedidos volvieron a quedar sin planificar.",
  },
};

export function EstadoDeLote({ estado }: { estado: EstadoLote }) {
  const e = ESTADOS[estado];
  return (
    <Pastilla tono={e.tono}>
      {e.icono} {e.texto}
    </Pastilla>
  );
}

export const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export const momento = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Canastillas estimadas con las reglas de carga: fracciones sumadas, hacia arriba. */
export function estimar(pedidos: PedidoPlanificacion[]): number {
  return Math.max(1, Math.ceil(pedidos.reduce((a, p) => a + (p.fraccion || 0), 0) - 1e-9));
}

/** Las que se cargan: las fijadas a mano manda sobre la estimación. */
export function canastillasDe(par: ParadaLote): number {
  if (par.extra || par.manual) return Math.max(1, par.canastillas || 1);
  return estimar(par.pedidos);
}

export function pesoDe(pedidos: PedidoPlanificacion[]): number | null {
  if (!pedidos.length || pedidos.some((p) => p.peso_kg == null)) return null;
  return pedidos.reduce((a, p) => a + (p.peso_kg ?? 0), 0);
}

/** Productos de varios pedidos sumados por presentación (sin convertir unidades). */
export function consolidar(pedidos: PedidoPlanificacion[]) {
  const m = new Map<
    string,
    {
      producto: string;
      unidad: string;
      cantidad: number;
      pedidos: Array<{ id: number; cantidad: string }>;
      notas: string[];
      con_regla: boolean;
    }
  >();
  for (const p of pedidos)
    for (const pr of p.productos) {
      const e =
        m.get(pr.clave) ??
        { producto: pr.producto, unidad: pr.unidad, cantidad: 0, pedidos: [], notas: [], con_regla: pr.con_regla };
      e.cantidad += Number(pr.cantidad);
      e.pedidos.push(...pr.pedidos);
      for (const n of pr.notas) if (!e.notas.includes(n)) e.notas.push(n);
      m.set(pr.clave, e);
    }
  return [...m.values()].sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}

/** Abre un PDF que llega como blob (no se descarga: se mira y se imprime). */
export async function verPdf(pedir: () => Promise<Blob>) {
  const blob = await pedir();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
