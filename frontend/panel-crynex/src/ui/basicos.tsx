/**
 * Los componentes de los que está hecho todo lo demás.
 *
 * Existen para que un botón secundario sea el mismo botón secundario en las
 * siete pantallas. Cada uno acepta las props nativas del elemento que envuelve:
 * así nunca hay que abrir este archivo para añadir un `type="submit"` o un
 * `aria-label`, que es cuando la gente deja de usar el componente compartido y
 * vuelve a escribir estilos sueltos.
 */
import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Tono } from "../datos/derivados";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

export function Boton({
  variante = "secundario",
  tamano = "normal",
  cargando = false,
  icono,
  children,
  className = "",
  disabled,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: "normal" | "pequeno";
  cargando?: boolean;
  icono?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn btn--${variante} ${tamano === "pequeno" ? "btn--pequeno" : ""} ${className}`}
      disabled={disabled || cargando}
      {...resto}
    >
      {cargando ? <Loader2 size={14} className="girando" /> : icono}
      {children}
    </button>
  );
}

/** Estado, plan, módulo: cualquier etiqueta corta con semántica de color. */
export function Insignia({
  tono = "neutro",
  punto = false,
  children,
  className = "",
  ...resto
}: HTMLAttributes<HTMLSpanElement> & { tono?: Tono; punto?: boolean }) {
  return (
    <span className={`insignia insignia--${tono} ${className}`} {...resto}>
      {punto && <i className="insignia__punto" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Tarjeta({
  titulo,
  accion,
  pie,
  children,
  className = "",
  ...resto
}: HTMLAttributes<HTMLElement> & {
  titulo?: ReactNode;
  accion?: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <section className={`tarjeta ${className}`} {...resto}>
      {(titulo || accion) && (
        <header className="tarjeta__cabecera">
          {typeof titulo === "string" ? <h2>{titulo}</h2> : titulo}
          {accion}
        </header>
      )}
      <div className="tarjeta__cuerpo">{children}</div>
      {pie && <footer className="tarjeta__pie">{pie}</footer>}
    </section>
  );
}

/** Pares dato/valor. Es la mitad de este panel: fechas, límites, precios. */
export function Dato({
  etiqueta,
  children,
  destacado = false,
}: {
  etiqueta: ReactNode;
  children: ReactNode;
  destacado?: boolean;
}) {
  return (
    <div className={`dato ${destacado ? "dato--destacado" : ""}`}>
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="campo">
      <span className="campo__etiqueta">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </label>
  );
}

export function Aviso({
  tono = "malo",
  children,
}: {
  tono?: Tono;
  children: ReactNode;
}) {
  return (
    <p className={`aviso aviso--${tono}`} role={tono === "malo" ? "alert" : undefined}>
      {children}
    </p>
  );
}

/**
 * El hueco que ocupará el contenido mientras llega.
 *
 * Con la forma real —una fila de tabla, una tarjeta— y no un spinner centrado:
 * la página no salta cuando los datos entran.
 */
export function Esqueleto({
  alto = 16,
  ancho = "100%",
  radio = 6,
}: {
  alto?: number;
  ancho?: number | string;
  radio?: number;
}) {
  return (
    <span
      className="esqueleto"
      style={{ height: alto, width: ancho, borderRadius: radio }}
      aria-hidden="true"
    />
  );
}

export function EstadoVacio({
  icono: Icono,
  titulo,
  children,
  accion,
}: {
  icono?: ElementType;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="vacio">
      {Icono && (
        <span className="vacio__icono" aria-hidden="true">
          <Icono size={20} />
        </span>
      )}
      <p className="vacio__titulo">{titulo}</p>
      {children && <p className="vacio__texto">{children}</p>}
      {accion && <div className="vacio__accion">{accion}</div>}
    </div>
  );
}
