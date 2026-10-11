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
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  ETIQUETA_CATEGORIA,
  actualizar,
  bloqueNuevo,
  duplicar,
  mover,
  quitar,
  type Bloque,
  type BloqueColocado,
  type CategoriaBloque,
  type Composicion,
  type TokenTema,
} from "../../api/tienda";
import { GRUPOS, agrupar, difiere, restaurar, type ClaveGrupo, type Grupo } from "./agrupacion";
import { confirmarAccion } from "../../utils/alertas";
import { Diseno } from "./Diseno";
import { DISPOSITIVOS, type ClaveDispositivo } from "./dispositivos";
import { Propiedades } from "./Propiedades";

interface Props {
  catalogo: Bloque[];
  /** El catalogo de tokens, para la pestaña de diseño de la seccion elegida. */
  tokens: TokenTema[];
  composicion: Composicion;
  elegido: string | null;
  onCambio: (composicion: Composicion) => void;
  onElegir: (id: string | null) => void;
  /** La pantalla de la vista previa. Sin ella (Configuración › Páginas), las
   *  fotos por dispositivo eligen pantalla por su cuenta. */
  pantalla?: ClaveDispositivo;
  onPantalla?: (clave: ClaveDispositivo) => void;
}

export function PanelSecciones({
  catalogo,
  tokens,
  composicion,
  elegido,
  onCambio,
  onElegir,
  pantalla,
  onPantalla,
}: Props) {
  const [anadiendo, setAnadiendo] = useState(false);
  // El apartado abierto se recuerda al pasar de una sección a otra: quien está
  // repasando los botones de toda la página no quiere reabrirlo cada vez.
  const [abierto, setAbierto] = useState<ClaveGrupo | null>("contenido");

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
        tokens={tokens}
        abierto={abierto}
        onAbrir={setAbierto}
        pantalla={pantalla}
        onPantalla={onPantalla}
        onVolver={() => onElegir(null)}
        onCambio={(cambios) => onCambio(actualizar(composicion, actual.id, cambios))}
        onQuitar={() => {
          onCambio(quitar(composicion, actual.id));
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
                    // Duplicar, quitar y actualizar viven en `@constructor`:
                    // son las mismas operaciones que hace el editor de
                    // plantillas, y tenerlas escritas dos veces es como
                    // acabaron siendo dos copias superficiales.
                    onClick={() => onCambio(duplicar(composicion, bloque.id))}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Quitar"
                    onClick={() => onCambio(quitar(composicion, bloque.id))}
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
/**
 * Los ajustes van en apartados desplegables —Contenido, Imágenes, Diseño,
 * Botones, Legibilidad, Colores— y solo uno abierto a la vez: un hero tiene
 * más de veinte ajustes, y verlos todos juntos es una pared de campos.
 *
 * Un apartado sin nada que ajustar en esta sección no se pinta. Cada uno tiene
 * su «Restaurar», que devuelve SOLO ese apartado a los valores de fábrica (y
 * se deshace como cualquier otro cambio).
 */
function Ajustes({
  bloque,
  definicion,
  tokens,
  abierto,
  onAbrir,
  pantalla,
  onPantalla,
  onVolver,
  onCambio,
  onQuitar,
}: {
  bloque: BloqueColocado;
  definicion: Bloque | null;
  tokens: TokenTema[];
  abierto: ClaveGrupo | null;
  onAbrir: (grupo: ClaveGrupo | null) => void;
  pantalla?: ClaveDispositivo;
  onPantalla?: (clave: ClaveDispositivo) => void;
  onVolver: () => void;
  onCambio: (cambios: Partial<BloqueColocado>) => void;
  onQuitar: () => void;
}) {
  const esquema = definicion?.esquema_props;
  const grupos = agrupar(esquema);
  const variantes = definicion?.variantes ?? [];
  const admitidos = definicion?.tokens_admitidos ?? [];
  const sinPropiedades = Object.keys(esquema?.properties ?? {}).length === 0;

  const visibleCompleto = DISPOSITIVOS.every((d) => bloque.visible[d.clave]);
  const varianteInicial = variantes[0]?.codigo ?? "";

  // Qué apartados tienen algo, y si algo de ellos está cambiado de fábrica.
  const hay: Record<ClaveGrupo, boolean> = {
    contenido: grupos.contenido.length > 0 || sinPropiedades,
    imagenes: grupos.imagenes.length > 0,
    diseno: true,
    botones: grupos.botones.length > 0,
    legibilidad: grupos.legibilidad.length > 0,
    estilo: admitidos.length > 0,
  };
  const cambiado: Record<ClaveGrupo, boolean> = {
    contenido: difiere(bloque.props, grupos.contenido, esquema),
    imagenes: difiere(bloque.props, grupos.imagenes, esquema),
    diseno:
      difiere(bloque.props, grupos.diseno, esquema) ||
      !visibleCompleto ||
      (variantes.length > 0 && bloque.variante !== varianteInicial),
    botones: difiere(bloque.props, grupos.botones, esquema),
    legibilidad: difiere(bloque.props, grupos.legibilidad, esquema),
    estilo: Object.keys(bloque.estilo ?? {}).length > 0,
  };

  const disponibles = GRUPOS.filter((g) => hay[g.clave]);
  // Si el apartado recordado no existe en esta sección, se abre el primero.
  const actual = abierto === null ? null : hay[abierto] ? abierto : disponibles[0]?.clave ?? null;

  async function restaurarGrupo(grupo: ClaveGrupo) {
    const nombre = GRUPOS.find((g) => g.clave === grupo)?.titulo ?? grupo;
    const ok = await confirmarAccion(
      `¿Restaurar «${nombre}»?`,
      "Los ajustes de este apartado vuelven a sus valores predeterminados. Puedes deshacerlo con Ctrl+Z.",
      "Restaurar"
    );
    if (!ok) return;
    if (grupo === "estilo") return onCambio({ estilo: {} });
    const props = restaurar(bloque.props, grupos[grupo], esquema);
    if (grupo === "diseno") {
      return onCambio({
        props,
        variante: variantes.length > 0 ? varianteInicial : bloque.variante,
        visible: { movil: true, tablet: true, escritorio: true },
      });
    }
    onCambio({ props });
  }

  const propiedades = (claves: string[]) => (
    <Propiedades
      esquema={esquema}
      valores={bloque.props}
      claves={claves}
      pantalla={pantalla}
      onPantalla={onPantalla}
      onCambio={(props) => onCambio({ props })}
    />
  );

  function cuerpo(grupo: ClaveGrupo): ReactNode {
    switch (grupo) {
      case "contenido":
        return sinPropiedades ? (
          <p className="campo-ayuda">
            Esta sección no tiene textos propios: se alimenta del contenido que
            administras en Configuración (banners, anuncios, beneficios, testimonios…).
          </p>
        ) : (
          propiedades(grupos.contenido)
        );
      case "diseno":
        return (
          <>
            {variantes.length > 0 && (
              <div className="campo">
                <label htmlFor={`variante-${bloque.id}`}>Aspecto</label>
                <select
                  id={`variante-${bloque.id}`}
                  value={bloque.variante}
                  onChange={(e) => onCambio({ variante: e.target.value })}
                >
                  {variantes.map((v) => (
                    <option key={v.codigo} value={v.codigo}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {propiedades(grupos.diseno)}
            <div className="campo">
              <label>Se ve en</label>
              <div className="constructor-dispositivos">
                {DISPOSITIVOS.map(({ clave, icono: Icono, nombre }) => (
                  <button
                    key={clave}
                    type="button"
                    className={`constructor-dispositivo ${bloque.visible[clave] ? "activo" : ""}`}
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
              <p className="campo-ayuda">Apaga una pantalla para ocultar la sección en ella.</p>
            </div>
          </>
        );
      case "estilo":
        return (
          <Diseno
            admitidos={admitidos}
            tokens={tokens}
            valores={bloque.estilo ?? {}}
            onCambio={(estilo) => onCambio({ estilo })}
          />
        );
      default:
        return propiedades(grupos[grupo]);
    }
  }

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
        <p className="campo-ayuda constructor-descripcion">{definicion.descripcion}</p>
      )}

      <div className="apartados">
        {disponibles.map((grupo) => (
          <Apartado
            key={grupo.clave}
            grupo={grupo}
            abierto={actual === grupo.clave}
            cambiado={cambiado[grupo.clave]}
            onAlternar={() => onAbrir(actual === grupo.clave ? null : grupo.clave)}
            onRestaurar={() => void restaurarGrupo(grupo.clave)}
          >
            {cuerpo(grupo.clave)}
          </Apartado>
        ))}
      </div>

      <button type="button" className="btn peligro constructor-quitar" onClick={onQuitar}>
        <Trash2 size={14} /> Quitar esta sección
      </button>
    </>
  );
}

function Apartado({
  grupo,
  abierto,
  cambiado,
  onAlternar,
  onRestaurar,
  children,
}: {
  grupo: Grupo;
  abierto: boolean;
  cambiado: boolean;
  onAlternar: () => void;
  onRestaurar: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const Icono = grupo.icono;
  return (
    <section className={`apartado ${abierto ? "abierto" : ""}`}>
      <div className="apartado-cabecera">
        <button
          type="button"
          className="apartado-boton"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={onAlternar}
        >
          <span className="apartado-icono" aria-hidden="true">
            <Icono size={15} />
          </span>
          <span className="apartado-textos">
            <strong>
              {grupo.titulo}
              {cambiado && (
                <span className="apartado-marca" title="Tiene cambios respecto a los valores predeterminados" />
              )}
            </strong>
            <small>{grupo.ayuda}</small>
          </span>
          <ChevronDown size={15} className="apartado-flecha" aria-hidden="true" />
        </button>
        {cambiado && (
          <button
            type="button"
            className="btn-icon apartado-restaurar"
            title={`Restaurar «${grupo.titulo}» a los valores predeterminados (se puede deshacer)`}
            aria-label={`Restaurar ${grupo.titulo} a los valores predeterminados`}
            onClick={onRestaurar}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
      {abierto && (
        <div id={id} className="apartado-cuerpo" role="region" aria-label={grupo.titulo}>
          {children}
        </div>
      )}
    </section>
  );
}
