import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Tooltip } from "../Tooltip";
import "./gestion.css";

/**
 * Piezas compartidas por las vistas de gestión del panel (Pedidos, Clientes).
 * Los estilos están en `gestion.css`, que se carga con este módulo.
 */

export type Tono = "neutro" | "ambar" | "verde" | "azul" | "violeta";

// ---------- Indicador ----------

/**
 * Tarjeta de indicador que además es un acceso rápido: al pulsarla aplica el
 * filtro que representa. `activa` marca la que coincide con el filtro puesto.
 */
export function TarjetaKpi({
  tono,
  icono,
  etiqueta,
  valor,
  activa,
  descripcion,
  pie,
  onClick,
}: {
  tono: Tono;
  icono: ReactNode;
  etiqueta: string;
  /** `null` mientras carga. */
  valor: string | null;
  activa?: boolean;
  descripcion: string;
  /** Dato secundario REAL bajo la cifra; se omite si no aporta. */
  pie?: ReactNode;
  /** Sin `onClick` la tarjeta solo informa: no es botón ni filtra nada. */
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <div className={`kpi-gestion estatica ${tono}`} title={descripcion}>
        <span className="kpi-gestion-icono" aria-hidden="true">
          {icono}
        </span>
        <span className="kpi-gestion-texto">
          <span className="kpi-gestion-etiqueta">{etiqueta}</span>
          {valor === null ? (
            <span className="kpi-cargando" />
          ) : (
            <span className={`kpi-gestion-valor ${valor.length > 10 ? "larga" : ""}`}>{valor}</span>
          )}
          {pie && <span className="kpi-gestion-pie">{pie}</span>}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`kpi-gestion ${tono} ${activa ? "activa" : ""}`}
      aria-pressed={activa}
      title={descripcion}
      onClick={onClick}
    >
      <span className="kpi-gestion-icono" aria-hidden="true">
        {icono}
      </span>
      <span className="kpi-gestion-texto">
        <span className="kpi-gestion-etiqueta">{etiqueta}</span>
        {valor === null ? (
          <span className="kpi-cargando" />
        ) : (
          <span className={`kpi-gestion-valor ${valor.length > 10 ? "larga" : ""}`}>{valor}</span>
        )}
        {pie && <span className="kpi-gestion-pie">{pie}</span>}
      </span>
      <ChevronRight size={16} className="kpi-gestion-flecha" aria-hidden="true" />
    </button>
  );
}

// ---------- Pastilla ----------

export function Pastilla({ tono = "neutro", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`pastilla ${tono}`}>{children}</span>;
}

// ---------- Estado vacío ----------

export function EstadoVacio({
  icono,
  titulo,
  texto,
  accion,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <div className="gestion-vacio">
      <span className="gestion-vacio-icono" aria-hidden="true">
        {icono}
      </span>
      <p className="gestion-vacio-titulo">{titulo}</p>
      <p className="gestion-vacio-texto">{texto}</p>
      {accion}
    </div>
  );
}

// ---------- Menú contextual de fila ----------

export interface AccionMenu {
  clave: string;
  etiqueta: string;
  icono: ReactNode;
  onSeleccionar: () => void;
  peligro?: boolean;
  /** Color de la acción (mismo código que los botones de ícono). `peligro` equivale a "peligro". */
  tono?: TonoAccion;
  deshabilitada?: boolean;
}

export type TonoAccion = "ver" | "editar" | "exito" | "info" | "copiar" | "peligro";

/** Cuántas acciones de una fila se pintan como botón antes de pasar al "⋯". */
export const ACCIONES_VISIBLES = 3;

export interface AccionFila extends AccionMenu {
  /** Qué lee un lector de pantalla si la acción se pinta como botón redondo.
   *  La `etiqueta` dice QUÉ hace ("Editar"); esto dice SOBRE QUÉ
   *  ("Editar Kilo de papa"). Sin ella se usa la etiqueta tal cual. */
  aria?: string;
}

/**
 * La columna de acciones de una fila, con una sola regla: como mucho
 * {@link ACCIONES_VISIBLES} botones redondos y, si hay más, un "⋯" al final
 * que abre el resto. Nunca cuatro botones sueltos: el cuarto hueco es siempre
 * el menú, así que la columna mide lo mismo en todas las tablas y la acción
 * rara no le quita sitio a la de todos los días.
 *
 * El ORDEN de `acciones` es el que manda: las primeras son las principales.
 */
export function AccionesFila({
  etiqueta,
  acciones,
  className,
}: {
  etiqueta: string;
  acciones: AccionFila[];
  /** Clase extra del grupo, para las filas que lo colocan con su rejilla. */
  className?: string;
}) {
  const cabenTodas = acciones.length <= ACCIONES_VISIBLES;
  const visibles = cabenTodas ? acciones : acciones.slice(0, ACCIONES_VISIBLES);
  const resto = cabenTodas ? [] : acciones.slice(ACCIONES_VISIBLES);
  if (acciones.length === 0) return null;
  return (
    <div className={`acciones ${className ?? ""}`.trim()}>
      {visibles.map((a) => (
        <Tooltip key={a.clave} label={a.etiqueta}>
          <button
            type="button"
            className={`btn-icon ${a.peligro ? "peligro" : a.tono ?? ""}`}
            disabled={a.deshabilitada}
            onClick={a.onSeleccionar}
            aria-label={a.aria ?? a.etiqueta}
          >
            {a.icono}
          </button>
        </Tooltip>
      ))}
      {resto.length > 0 && <MenuFila etiqueta={etiqueta} acciones={resto} />}
    </div>
  );
}

/**
 * El "⋯" de cada fila. El menú se pinta en `document.body` con posición fija:
 * dentro de la tabla lo recortaría su contenedor con scroll horizontal. Se
 * cierra al hacer clic fuera, con Escape o al desplazar la página (quedaría
 * flotando lejos de su fila).
 */
export function MenuFila({ etiqueta, acciones }: { etiqueta: string; acciones: AccionMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estilo, setEstilo] = useState<CSSProperties>({});
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const altoEstimado = acciones.length * 40 + 12;
    const haciaArriba = r.bottom + altoEstimado + 8 > window.innerHeight;
    setEstilo({
      right: Math.max(8, window.innerWidth - r.right),
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    });
  }, [abierto, acciones.length]);

  useEffect(() => {
    if (!abierto) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    function cerrar() {
      setAbierto(false);
    }
    function alClicFuera(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !botonRef.current?.contains(t)) cerrar();
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cerrar();
        botonRef.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const siguiente = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[siguiente]?.focus();
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alTeclear);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alTeclear);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className={`btn-icon menu-fila-boton ${abierto ? "abierto" : ""}`}
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {abierto &&
        createPortal(
          <div ref={menuRef} className="menu-fila" role="menu" aria-label={etiqueta} style={estilo}>
            {acciones.map((a) => (
              <button
                key={a.clave}
                type="button"
                role="menuitem"
                className={a.peligro ? "peligro" : a.tono ?? ""}
                disabled={a.deshabilitada}
                onClick={() => {
                  setAbierto(false);
                  a.onSeleccionar();
                }}
              >
                {a.icono}
                {a.etiqueta}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
