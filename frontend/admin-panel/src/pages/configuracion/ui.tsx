import { createContext, useContext, useEffect, type ReactNode } from "react";
import { AlertTriangle, Check, Loader2, Lock } from "lucide-react";

/**
 * Las piezas con las que se arma cada vista del centro de configuración.
 *
 * Una vista es una pila de grupos; un grupo, una lista de filas. La fila es
 * la unidad: título y una línea de descripción a la izquierda, el control a
 * la derecha, ~64 px de alto. Así una pantalla con doce ajustes cabe sin
 * desplazarse y el ojo recorre una sola columna de interruptores.
 */

// ---------------------------------------------------------------- cambios pendientes
interface Pendientes {
  /** Una vista avisa de que tiene cambios sin guardar (o de que ya no). */
  marcar: (clave: string, pendiente: boolean) => void;
}

export const PendientesContexto = createContext<Pendientes>({ marcar: () => {} });

/**
 * Registra los cambios sin guardar de una vista: el centro pregunta antes de
 * cambiar de sección, y el navegador antes de cerrar la pestaña.
 */
export function useCambiosPendientes(clave: string, pendiente: boolean) {
  const { marcar } = useContext(PendientesContexto);
  useEffect(() => {
    marcar(clave, pendiente);
    return () => marcar(clave, false);
  }, [clave, pendiente, marcar]);
}

// ---------------------------------------------------------------- estructura
export function CabeceraVista({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="cfg-vista-cabecera">
      <div>
        <h2>{titulo}</h2>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {acciones && <div className="cfg-vista-acciones">{acciones}</div>}
    </header>
  );
}

export function Grupo({
  titulo,
  descripcion,
  acciones,
  children,
  sinRelleno,
}: {
  titulo?: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  /** El contenido trae su propio espaciado (tablas, listas con filas). */
  sinRelleno?: boolean;
}) {
  return (
    <section className="cfg-grupo">
      {(titulo || acciones) && (
        <div className="cfg-grupo-cabecera">
          <div>
            {titulo && <h3>{titulo}</h3>}
            {descripcion && <p>{descripcion}</p>}
          </div>
          {acciones && <div className="cfg-grupo-acciones">{acciones}</div>}
        </div>
      )}
      <div className={sinRelleno ? "cfg-grupo-cuerpo sin-relleno" : "cfg-grupo-cuerpo"}>{children}</div>
    </section>
  );
}

/** Una fila de ajuste: lo que es, lo que hace, y su control. */
export function Fila({
  titulo,
  descripcion,
  children,
  estado,
  htmlFor,
  deshabilitada,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  children?: ReactNode;
  estado?: ReactNode;
  htmlFor?: string;
  deshabilitada?: boolean;
}) {
  return (
    <div className={`cfg-fila ${deshabilitada ? "deshabilitada" : ""}`}>
      <div className="cfg-fila-texto">
        <div className="cfg-fila-titulo">
          {htmlFor ? <label htmlFor={htmlFor}>{titulo}</label> : titulo}
          {estado}
        </div>
        {descripcion && <div className="cfg-fila-desc">{descripcion}</div>}
      </div>
      {children !== undefined && <div className="cfg-fila-control">{children}</div>}
    </div>
  );
}

/** Interruptor accesible con el estilo del panel. */
export function Interruptor({
  activo,
  onCambiar,
  deshabilitado,
  etiqueta,
}: {
  activo: boolean;
  onCambiar: (valor: boolean) => void;
  deshabilitado?: boolean;
  etiqueta: string;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        aria-label={etiqueta}
        aria-checked={activo}
        checked={activo}
        disabled={deshabilitado}
        onChange={(e) => onCambiar(e.target.checked)}
      />
      <span className="switch-riel" />
    </label>
  );
}

export type TipoEstado = "activo" | "inactivo" | "bloqueado" | "aviso" | "neutro";

/** El estado de un módulo, una regla o una conexión, siempre con el mismo código visual. */
export function Estado({ tipo, children }: { tipo: TipoEstado; children: ReactNode }) {
  return (
    <span className={`cfg-estado ${tipo}`}>
      {tipo === "bloqueado" ? <Lock size={11} aria-hidden /> : <span className="cfg-estado-punto" aria-hidden />}
      {children}
    </span>
  );
}

export function SoloLectura({ children }: { children: ReactNode }) {
  return (
    <div className="cfg-aviso neutro" role="note">
      <Lock size={14} aria-hidden /> {children}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="cfg-cargando" aria-busy="true">
      <Loader2 size={16} className="cfg-girar" aria-hidden /> {texto}
    </div>
  );
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="cfg-aviso error" role="alert">
      <AlertTriangle size={15} aria-hidden /> {mensaje}
      {onReintentar && (
        <button type="button" className="btn secundario sm" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/**
 * La barra de cambios pendientes: aparece pegada abajo en cuanto hay algo
 * sin guardar, y confirma brevemente cuando se guarda.
 */
export function BarraGuardado({
  pendiente,
  guardando,
  guardado,
  error,
  onGuardar,
  onDescartar,
}: {
  pendiente: boolean;
  guardando: boolean;
  guardado: boolean;
  error?: string | null;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  if (!pendiente && !guardado && !error) return null;
  return (
    <div className={`cfg-barra ${error ? "con-error" : guardado && !pendiente ? "guardada" : ""}`} role="status">
      <span className="cfg-barra-texto">
        {error ? (
          <>
            <AlertTriangle size={15} aria-hidden /> {error}
          </>
        ) : pendiente ? (
          <>
            <span className="cfg-barra-punto" aria-hidden /> Tienes cambios sin guardar
          </>
        ) : (
          <>
            <Check size={15} aria-hidden /> Cambios guardados
          </>
        )}
      </span>
      {pendiente && (
        <span className="cfg-barra-acciones">
          <button type="button" className="btn secundario sm" onClick={onDescartar} disabled={guardando}>
            Descartar
          </button>
          <button type="button" className="btn primario sm" onClick={onGuardar} disabled={guardando} aria-busy={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </span>
      )}
    </div>
  );
}
