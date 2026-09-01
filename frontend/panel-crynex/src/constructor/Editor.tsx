/**
 * El editor de composición.
 *
 * Es la misma operación en los dos sitios donde hará falta —Crynex editando una
 * plantilla y un cliente editando su tienda— porque en los dos se manipula la
 * misma estructura: una lista ordenada de bloques con sus propiedades. Por eso
 * no sabe nada de plantillas ni de páginas: recibe una composición y devuelve
 * otra. Quien la guarde y dónde es problema de quien lo use.
 *
 * Tres columnas: qué se puede añadir, qué hay puesto y cómo se configura lo
 * seleccionado. Es la disposición que evita el problema de los constructores
 * de una sola columna, donde elegir un bloque tapa la página que estás
 * componiendo.
 */
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  Trash2,
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
} from "../api/tienda";
import { Boton, EstadoVacio } from "../ui/basicos";
import { Propiedades } from "./Propiedades";

const DISPOSITIVOS = [
  { clave: "escritorio", icono: Monitor, nombre: "Escritorio" },
  { clave: "tablet", icono: Tablet, nombre: "Tablet" },
  { clave: "movil", icono: Smartphone, nombre: "Móvil" },
] as const;

interface Props {
  catalogo: Bloque[];
  composicion: Composicion;
  /**
   * Qué bloque está elegido. Se controla desde fuera porque la vista previa
   * también lo cambia: pulsar una sección en la tienda tiene que seleccionarla
   * aquí, y con el estado dentro las dos versiones se separarían.
   */
  elegido: string | null;
  onElegir: (id: string | null) => void;
  onCambio: (composicion: Composicion) => void;
}

export function Editor({
  catalogo,
  composicion,
  elegido: seleccionado,
  onElegir: setSeleccionado,
  onCambio,
}: Props) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);

  const porCodigo = useMemo(
    () => new Map(catalogo.map((b) => [b.codigo, b])),
    [catalogo]
  );

  const porCategoria = useMemo(() => {
    const grupos = new Map<CategoriaBloque, Bloque[]>();
    for (const bloque of catalogo) {
      if (!bloque.activo) continue;
      if (!grupos.has(bloque.categoria)) grupos.set(bloque.categoria, []);
      grupos.get(bloque.categoria)!.push(bloque);
    }
    return [...grupos.entries()];
  }, [catalogo]);

  const puestos = new Set(composicion.map((b) => b.tipo));
  const actual = composicion.find((b) => b.id === seleccionado) ?? null;
  const definicion = actual ? porCodigo.get(actual.tipo) ?? null : null;

  function actualizar(id: string, cambios: Partial<BloqueColocado>) {
    onCambio(composicion.map((b) => (b.id === id ? { ...b, ...cambios } : b)));
  }

  function anadir(bloque: Bloque) {
    const nuevo = bloqueNuevo(bloque, composicion);
    onCambio([...composicion, nuevo]);
    setSeleccionado(nuevo.id);
  }

  function duplicar(bloque: BloqueColocado) {
    const copia = { ...bloque, id: nuevoId(bloque.tipo, composicion) };
    const i = composicion.findIndex((b) => b.id === bloque.id);
    onCambio([...composicion.slice(0, i + 1), copia, ...composicion.slice(i + 1)]);
    setSeleccionado(copia.id);
  }

  function quitar(id: string) {
    onCambio(composicion.filter((b) => b.id !== id));
    if (seleccionado === id) setSeleccionado(null);
  }

  return (
    <div className="constructor">
      {/* ----------------------------------------------- qué se puede añadir */}
      <aside className="constructor__catalogo">
        <p className="constructor__titulo">Bloques</p>
        {porCategoria.map(([categoria, bloques]) => (
          <div key={categoria} className="constructor__grupo">
            <p className="constructor__categoria">{ETIQUETA_CATEGORIA[categoria]}</p>
            {bloques.map((bloque) => {
              // Un bloque único que ya está puesto no se puede volver a
              // añadir: el servidor lo rechazaría y es mejor decirlo antes.
              const agotado = bloque.unico_por_pagina && puestos.has(bloque.codigo);
              return (
                <button
                  key={bloque.codigo}
                  type="button"
                  className="constructor__disponible"
                  onClick={() => anadir(bloque)}
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
      </aside>

      {/* ------------------------------------------------- qué hay compuesto */}
      <div className="constructor__lienzo">
        <p className="constructor__titulo">
          Composición
          <span className="tenue">
            {composicion.length}{" "}
            {composicion.length === 1 ? "bloque" : "bloques"}
          </span>
        </p>

        {composicion.length === 0 ? (
          <EstadoVacio titulo="Página vacía">
            Añade bloques desde la izquierda. El orden de esta lista es el orden
            en que se verán.
          </EstadoVacio>
        ) : (
          <ol className="constructor__pila">
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
                  className={`constructor__pieza ${
                    bloque.id === seleccionado ? "esta-elegida" : ""
                  } ${arrastrando === i ? "se-arrastra" : ""}`}
                  onClick={() => setSeleccionado(bloque.id)}
                >
                  <span className="constructor__asa" aria-hidden="true">
                    <GripVertical size={14} />
                  </span>

                  <span className="constructor__pieza-info">
                    <span className="constructor__pieza-nombre">
                      {def?.nombre ?? bloque.tipo}
                      {/* Un bloque cuyo componente no existe en el frontend no
                          se pintaría en la tienda; se avisa aquí y no cuando
                          el cliente se pregunte dónde está su sección. */}
                      {!def && <span className="es-malo"> · desconocido</span>}
                    </span>
                    <span className="tenue">
                      {bloque.variante || "por defecto"}
                      {ocultoEn.length > 0 &&
                        ` · oculto en ${ocultoEn.map((d) => d.nombre.toLowerCase()).join(", ")}`}
                    </span>
                  </span>

                  <span
                    className="constructor__pieza-acciones"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="icono-boton"
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => onCambio(mover(composicion, i, i - 1))}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="icono-boton"
                      aria-label="Bajar"
                      disabled={i === composicion.length - 1}
                      onClick={() => onCambio(mover(composicion, i, i + 1))}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="icono-boton"
                      aria-label="Duplicar"
                      disabled={def?.unico_por_pagina}
                      onClick={() => duplicar(bloque)}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="icono-boton"
                      aria-label="Quitar"
                      onClick={() => quitar(bloque.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* ------------------------------------------------- cómo se configura */}
      <aside className="constructor__ajustes">
        {!actual ? (
          <p className="tenue">
            Elige un bloque de la composición para ver sus opciones.
          </p>
        ) : (
          <>
            <p className="constructor__titulo">
              {definicion?.nombre ?? actual.tipo}
            </p>
            {definicion?.descripcion && (
              <p className="tenue">{definicion.descripcion}</p>
            )}

            {definicion && definicion.variantes.length > 0 && (
              <label className="campo">
                <span className="campo__etiqueta">Aspecto</span>
                <select
                  value={actual.variante}
                  onChange={(e) =>
                    actualizar(actual.id, { variante: e.target.value })
                  }
                >
                  {definicion.variantes.map((v) => (
                    <option key={v.codigo} value={v.codigo}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="campo">
              <span className="campo__etiqueta">Se ve en</span>
              <div className="constructor__dispositivos">
                {DISPOSITIVOS.map(({ clave, icono: Icono, nombre }) => (
                  <button
                    key={clave}
                    type="button"
                    className={`constructor__dispositivo ${
                      actual.visible[clave] ? "esta-activo" : ""
                    }`}
                    aria-pressed={actual.visible[clave]}
                    title={nombre}
                    onClick={() =>
                      actualizar(actual.id, {
                        visible: {
                          ...actual.visible,
                          [clave]: !actual.visible[clave],
                        },
                      })
                    }
                  >
                    <Icono size={15} />
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            <hr className="constructor__separador" />

            <Propiedades
              esquema={definicion?.esquema_props}
              valores={actual.props}
              onCambio={(props) => actualizar(actual.id, { props })}
            />

            <div className="constructor__pie">
              <Boton
                variante="fantasma"
                tamano="pequeno"
                icono={<Trash2 size={13} />}
                onClick={() => quitar(actual.id)}
              >
                Quitar de la página
              </Boton>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
