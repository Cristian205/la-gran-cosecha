/**
 * La columna izquierda del constructor, en sus dos estados.
 *
 * O se ve la lista de secciones de la página, o se ven los ajustes de la que
 * está elegida — nunca las dos. Es la disposición de Shopify y de WordPress, y
 * la razón es de espacio: la vista previa tiene que ser la pantalla, así que
 * solo queda una columna y hay que turnarla.
 *
 * La alternativa —tres columnas fijas— deja la previa en un tercio, que es
 * demasiado poco para juzgar cómo queda una tienda.
 */
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import {
  ETIQUETA_CATEGORIA,
  bloqueNuevo,
  mover,
  nuevoId,
  type Bloque,
  type BloqueColocado,
  type CategoriaBloque,
  type Composicion,
} from "../../api/tienda";
import { Propiedades } from "./Propiedades";

const DISPOSITIVOS = [
  { clave: "escritorio", icono: Monitor, nombre: "Escritorio" },
  { clave: "tablet", icono: Tablet, nombre: "Tablet" },
  { clave: "movil", icono: Smartphone, nombre: "Móvil" },
] as const;

interface Props {
  catalogo: Bloque[];
  composicion: Composicion;
  elegido: string | null;
  onCambio: (composicion: Composicion) => void;
  onElegir: (id: string | null) => void;
}

export function PanelSecciones({
  catalogo,
  composicion,
  elegido,
  onCambio,
  onElegir,
}: Props) {
  const [anadiendo, setAnadiendo] = useState(false);

  const porCodigo = useMemo(
    () => new Map(catalogo.map((b) => [b.codigo, b])),
    [catalogo]
  );

  const actual = composicion.find((b) => b.id === elegido) ?? null;

  // Los ajustes reemplazan la lista, no conviven con ella.
  if (actual) {
    return (
      <Ajustes
        bloque={actual}
        definicion={porCodigo.get(actual.tipo) ?? null}
        onVolver={() => onElegir(null)}
        onCambio={(cambios) =>
          onCambio(
            composicion.map((b) => (b.id === actual.id ? { ...b, ...cambios } : b))
          )
        }
        onQuitar={() => {
          onCambio(composicion.filter((b) => b.id !== actual.id));
          onElegir(null);
        }}
      />
    );
  }

  if (anadiendo) {
    return (
      <Catalogo
        catalogo={catalogo}
        puestos={new Set(composicion.map((b) => b.tipo))}
        onVolver={() => setAnadiendo(false)}
        onAnadir={(bloque) => {
          const nuevo = bloqueNuevo(bloque, composicion);
          onCambio([...composicion, nuevo]);
          setAnadiendo(false);
          onElegir(nuevo.id);
        }}
      />
    );
  }

  return (
    <Lista
      composicion={composicion}
      porCodigo={porCodigo}
      onCambio={onCambio}
      onElegir={onElegir}
      onAnadir={() => setAnadiendo(true)}
    />
  );
}

// ==========================================================================
// 1. La lista de secciones de la página
// ==========================================================================
function Lista({
  composicion,
  porCodigo,
  onCambio,
  onElegir,
  onAnadir,
}: {
  composicion: Composicion;
  porCodigo: Map<string, Bloque>;
  onCambio: (c: Composicion) => void;
  onElegir: (id: string) => void;
  onAnadir: () => void;
}) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);

  return (
    <>
      <p className="constructor-titulo">
        Secciones
        <span className="campo-ayuda" style={{ margin: 0 }}>
          {composicion.length}
        </span>
      </p>

      {composicion.length === 0 ? (
        <p className="campo-ayuda">
          Tu página está vacía. Añade la primera sección abajo.
        </p>
      ) : (
        <ol className="constructor-pila">
          {composicion.map((bloque, i) => {
            const def = porCodigo.get(bloque.tipo);
            const ocultoEn = DISPOSITIVOS.filter((d) => !bloque.visible[d.clave]);
            return (
              <li
                key={bloque.id}
                draggable
                onDragStart={() => setArrastrando(i)}
                onDragEnd={() => setArrastrando(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastrando !== null) onCambio(mover(composicion, arrastrando, i));
                  setArrastrando(null);
                }}
                className={`constructor-pieza ${arrastrando === i ? "arrastrando" : ""}`}
                onClick={() => onElegir(bloque.id)}
              >
                <span className="constructor-asa" aria-hidden="true">
                  <GripVertical size={14} />
                </span>

                <span className="constructor-pieza-info">
                  <strong>
                    {def?.nombre ?? bloque.tipo}
                    {!def && <span className="constructor-roto"> · no disponible</span>}
                  </strong>
                  {ocultoEn.length > 0 && (
                    <span className="campo-ayuda" style={{ margin: 0 }}>
                      oculta en {ocultoEn.map((d) => d.nombre.toLowerCase()).join(", ")}
                    </span>
                  )}
                </span>

                <span
                  className="constructor-pieza-acciones"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => onCambio(mover(composicion, i, i - 1))}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Bajar"
                    disabled={i === composicion.length - 1}
                    onClick={() => onCambio(mover(composicion, i, i + 1))}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Duplicar"
                    disabled={def?.unico_por_pagina}
                    onClick={() => {
                      const copia = { ...bloque, id: nuevoId(bloque.tipo, composicion) };
                      onCambio([
                        ...composicion.slice(0, i + 1),
                        copia,
                        ...composicion.slice(i + 1),
                      ]);
                    }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Quitar"
                    onClick={() => onCambio(composicion.filter((b) => b.id !== bloque.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" className="constructor-anadir" onClick={onAnadir}>
        <Plus size={15} /> Añadir sección
      </button>
    </>
  );
}

// ==========================================================================
// 2. El catálogo de lo que se puede añadir
// ==========================================================================
function Catalogo({
  catalogo,
  puestos,
  onVolver,
  onAnadir,
}: {
  catalogo: Bloque[];
  puestos: Set<string>;
  onVolver: () => void;
  onAnadir: (bloque: Bloque) => void;
}) {
  const porCategoria = useMemo(() => {
    const grupos = new Map<CategoriaBloque, Bloque[]>();
    for (const bloque of catalogo) {
      if (!bloque.activo) continue;
      if (!grupos.has(bloque.categoria)) grupos.set(bloque.categoria, []);
      grupos.get(bloque.categoria)!.push(bloque);
    }
    return [...grupos.entries()];
  }, [catalogo]);

  return (
    <>
      <p className="constructor-titulo">
        <button type="button" className="constructor-volver" onClick={onVolver}>
          <ArrowLeft size={14} /> Secciones
        </button>
      </p>

      {porCategoria.map(([categoria, bloques]) => (
        <div key={categoria} className="constructor-grupo">
          <p className="constructor-categoria">{ETIQUETA_CATEGORIA[categoria]}</p>
          {bloques.map((bloque) => {
            // Un bloque único que ya está puesto no se puede repetir: el
            // servidor lo rechazaría y es mejor decirlo antes de intentarlo.
            const agotado = bloque.unico_por_pagina && puestos.has(bloque.codigo);
            return (
              <button
                key={bloque.codigo}
                type="button"
                className="constructor-disponible"
                onClick={() => onAnadir(bloque)}
                disabled={agotado}
                title={
                  agotado
                    ? "Solo puede aparecer una vez en la página"
                    : bloque.descripcion
                }
              >
                <Plus size={13} />
                <span>{bloque.nombre}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

// ==========================================================================
// 3. Los ajustes de la sección elegida
// ==========================================================================
function Ajustes({
  bloque,
  definicion,
  onVolver,
  onCambio,
  onQuitar,
}: {
  bloque: BloqueColocado;
  definicion: Bloque | null;
  onVolver: () => void;
  onCambio: (cambios: Partial<BloqueColocado>) => void;
  onQuitar: () => void;
}) {
  return (
    <>
      <p className="constructor-titulo">
        <button type="button" className="constructor-volver" onClick={onVolver}>
          <ArrowLeft size={14} /> {definicion?.nombre ?? bloque.tipo}
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label="Cerrar los ajustes"
          onClick={onVolver}
        >
          <X size={14} />
        </button>
      </p>

      {definicion?.descripcion && (
        <p className="campo-ayuda">{definicion.descripcion}</p>
      )}

      {definicion && definicion.variantes.length > 0 && (
        <div className="campo">
          <label>Aspecto</label>
          <select
            value={bloque.variante}
            onChange={(e) => onCambio({ variante: e.target.value })}
          >
            {definicion.variantes.map((v) => (
              <option key={v.codigo} value={v.codigo}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="campo">
        <label>Se ve en</label>
        <div className="constructor-dispositivos">
          {DISPOSITIVOS.map(({ clave, icono: Icono, nombre }) => (
            <button
              key={clave}
              type="button"
              className={`constructor-dispositivo ${
                bloque.visible[clave] ? "activo" : ""
              }`}
              aria-pressed={bloque.visible[clave]}
              onClick={() =>
                onCambio({
                  visible: { ...bloque.visible, [clave]: !bloque.visible[clave] },
                })
              }
            >
              <Icono size={15} />
              {nombre}
            </button>
          ))}
        </div>
      </div>

      <hr className="constructor-separador" />

      <Propiedades
        esquema={definicion?.esquema_props}
        valores={bloque.props}
        onCambio={(props) => onCambio({ props })}
      />

      <hr className="constructor-separador" />

      <button type="button" className="btn peligro constructor-quitar" onClick={onQuitar}>
        <Trash2 size={14} /> Quitar esta sección
      </button>
    </>
  );
}
