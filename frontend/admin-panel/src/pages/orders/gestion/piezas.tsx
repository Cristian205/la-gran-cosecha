import { Check, ImageOff, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import type { EstadoAccion } from "./useGestionPedido";
import type { LineaEditable } from "./modelo";

/** Original · Agregado, y Personalizado como segunda marca cuando aplica. */
export function MarcasOrigen({ linea, compacto = false }: { linea: Pick<LineaEditable, "origen" | "personalizado" | "id">; compacto?: boolean }) {
  return (
    <span className="gp-marcas">
      {linea.origen === "ADMIN" ? (
        <span className="gp-marca agregado" title="Agregado por el negocio">
          {compacto ? "Agr." : "Agregado"}
        </span>
      ) : (
        <span className="gp-marca original" title="Solicitado por el cliente en la tienda">
          {compacto ? "Orig." : "Original"}
        </span>
      )}
      {linea.personalizado && (
        <span className="gp-marca personalizado" title="Producto manual, sin asociación al catálogo">
          {compacto ? "Pers." : "Personalizado"}
        </span>
      )}
      {linea.id === null && <span className="gp-marca nuevo">Sin guardar</span>}
    </span>
  );
}

export function Miniatura({ src, nombre, grande = false }: { src?: string | null; nombre: string; grande?: boolean }) {
  return (
    <span className={`gp-mini ${grande ? "grande" : ""}`} aria-hidden="true">
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : nombre.trim() ? (
        <span className="gp-mini-inicial">{nombre.trim()[0].toUpperCase()}</span>
      ) : (
        <ImageOff size={14} />
      )}
    </span>
  );
}

/** Botón con estados de carga, éxito y error, sin cambiar de ancho. */
export function BotonAccion({
  estado,
  onClick,
  clase,
  icono,
  texto,
  textoCargando,
  textoExito,
  textoError,
  disabled,
  title,
}: {
  estado: EstadoAccion;
  onClick: () => void;
  clase: string;
  icono: ReactNode;
  texto: string;
  textoCargando: string;
  textoExito: string;
  textoError?: string;
  disabled?: boolean;
  title?: string;
}) {
  const contenido =
    estado === "cargando" ? (
      <>
        <Loader2 size={16} className="gp-gira" aria-hidden="true" /> {textoCargando}
      </>
    ) : estado === "exito" ? (
      <>
        <Check size={16} aria-hidden="true" /> {textoExito}
      </>
    ) : estado === "error" && textoError ? (
      <>
        <X size={16} aria-hidden="true" /> {textoError}
      </>
    ) : (
      <>
        {icono} {texto}
      </>
    );
  return (
    <button
      type="button"
      className={`btn ${clase} gp-boton-estado ${estado}`}
      onClick={onClick}
      disabled={disabled || estado === "cargando"}
      aria-busy={estado === "cargando"}
      title={title}
    >
      <span aria-live="polite">{contenido}</span>
    </button>
  );
}

export function Esqueleto({ alto = 14, ancho = "100%", radio = 6 }: { alto?: number; ancho?: number | string; radio?: number }) {
  return <span className="gp-esqueleto" style={{ height: alto, width: ancho, borderRadius: radio }} />;
}
