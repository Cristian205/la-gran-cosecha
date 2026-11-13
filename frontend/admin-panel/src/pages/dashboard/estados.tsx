import { AlertTriangle, Info, RotateCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "../../components/Tooltip";
import type { EstadoPedido } from "../../types";

/**
 * Las piezas de estado que comparten todas las tarjetas del dashboard: cómo
 * se nombra y se colorea un pedido, y qué se ve mientras carga, cuando no hay
 * nada que mostrar y cuando algo falló.
 */

/** Los estados REALES del pedido. No hay "en preparación" ni "cancelado": el modelo no los tiene. */
export const ESTADOS_PEDIDO: Record<EstadoPedido, { etiqueta: string; tono: string }> = {
  PENDIENTE: { etiqueta: "Pendiente", tono: "ambar" },
  EDITADO: { etiqueta: "Editado", tono: "azul" },
  // Mismos tonos que `.badge.<ESTADO>` en la página de Pedidos.
  CERRADO: { etiqueta: "Cerrado", tono: "gris" },
  IMPRESO: { etiqueta: "Impreso", tono: "gris" },
  ENTREGADO: { etiqueta: "Entregado", tono: "verde" },
};

export function StatusBadge({ estado }: { estado: string }) {
  const meta = ESTADOS_PEDIDO[estado as EstadoPedido];
  return (
    <span className={`db-estado db-tono-${meta?.tono ?? "gris"}`}>
      <span className="db-estado-punto" aria-hidden="true" />
      {meta?.etiqueta ?? estado}
    </span>
  );
}

export function EmptyState({
  icono: Icono,
  titulo,
  texto,
  accion,
}: {
  icono: LucideIcon;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="db-vacio">
      <span className="db-vacio-icono" aria-hidden="true">
        <Icono size={20} />
      </span>
      <p className="db-vacio-titulo">{titulo}</p>
      {texto && <p className="db-vacio-texto">{texto}</p>}
      {accion}
    </div>
  );
}

export function ErrorState({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="db-vacio db-vacio--error" role="alert">
      <span className="db-vacio-icono" aria-hidden="true">
        <AlertTriangle size={20} />
      </span>
      <p className="db-vacio-titulo">{mensaje}</p>
      <button type="button" className="db-boton-sec" onClick={onReintentar}>
        <RotateCw size={14} /> Reintentar
      </button>
    </div>
  );
}

/** Líneas de esqueleto con el ancho de lo que van a ocupar. */
export function LoadingState({ filas = 4, alto = 12 }: { filas?: number; alto?: number }) {
  return (
    <div className="db-cargando" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line skeleton-shimmer en-celda"
          style={{ width: `${88 - ((i * 17) % 40)}%`, height: alto }}
        />
      ))}
    </div>
  );
}

/** Un «i» discreto que explica cómo se calcula una cifra. */
export function InfoTip({ texto, posicion = "arriba" }: { texto: string; posicion?: "arriba" | "abajo" | "izquierda" | "derecha" }) {
  return (
    <Tooltip label={texto} posicion={posicion}>
      <button type="button" className="db-info" aria-label={texto}>
        <Info size={13} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

/** El marco común de una sección: título, ayuda, acción a la derecha y cuerpo. */
export function Tarjeta({
  titulo,
  subtitulo,
  info,
  accion,
  children,
  className = "",
  actualizando = false,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  info?: string;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
  actualizando?: boolean;
}) {
  return (
    <section className={`db-tarjeta ${actualizando ? "db-actualizando" : ""} ${className}`} aria-busy={actualizando}>
      <header className="db-tarjeta-cabecera">
        <div className="db-tarjeta-titulos">
          <h2>
            {titulo}
            {info && <InfoTip texto={info} />}
          </h2>
          {subtitulo && <p className="db-tarjeta-sub">{subtitulo}</p>}
        </div>
        {accion && <div className="db-tarjeta-accion">{accion}</div>}
      </header>
      {children}
    </section>
  );
}

/** El cuerpo de una tarjeta según el estado de su módulo. */
export function CuerpoModulo<T>({
  estado,
  filas = 4,
  error = "No pudimos cargar esta sección.",
  onReintentar,
  children,
}: {
  estado: { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "listo"; datos: T };
  filas?: number;
  error?: string;
  onReintentar: () => void;
  children: (datos: T) => ReactNode;
}) {
  if (estado.tipo === "cargando") return <LoadingState filas={filas} />;
  if (estado.tipo === "error") return <ErrorState mensaje={error} onReintentar={onReintentar} />;
  return <>{children(estado.datos)}</>;
}
