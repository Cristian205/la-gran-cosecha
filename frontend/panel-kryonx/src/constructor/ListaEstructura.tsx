/**
 * La estructura de la página: la zona izquierda permanente del taller.
 *
 * Es la mitad de columna B de lo que antes era `Editor.tsx` — la lista de
 * bloques puestos — pero ya no comparte espacio con el catálogo ni con los
 * ajustes: esos se abren encima de esta lista (ver `SelectorDeBloques` y
 * `PanelTema`) en vez de pelear con ella por sitio. Seleccionar una fila ya no
 * navega a otra vista — solo la resalta aquí y abre el panel derecho al lado,
 * que es lo que permite ver el árbol entero mientras se edita una sección.
 *
 * El reordenado usa `@dnd-kit`: el asa es lo único arrastrable (el resto de la
 * fila sigue siendo un clic normal de selección, sin que arrastrar y elegir se
 * disputen el mismo puntero). Las flechas arriba/abajo se conservan como
 * alternativa sin arrastrar.
 */
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  EyeOff,
  GripVertical,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import {
  duplicar as duplicarBloque,
  mover,
  quitar as quitarBloque,
  type Bloque,
  type BloqueColocado,
  type Composicion,
} from "../api/tienda";
import { EstadoVacio } from "../ui/basicos";
import { iconoDeBloque } from "./iconosBloque";

interface Props {
  catalogo: Bloque[];
  composicion: Composicion;
  elegido: string | null;
  onElegir: (id: string | null) => void;
  onCambio: (composicion: Composicion) => void;
  onAgregarSeccion: () => void;
  onAbrirApariencia: () => void;
}

export function ListaEstructura({
  catalogo,
  composicion,
  elegido,
  onElegir,
  onCambio,
  onAgregarSeccion,
  onAbrirApariencia,
}: Props) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const porCodigo = new Map(catalogo.map((b) => [b.codigo, b]));

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function duplicar(bloque: BloqueColocado) {
    const siguiente = duplicarBloque(composicion, bloque.id);
    onCambio(siguiente);
    const i = siguiente.findIndex((b) => b.id === bloque.id);
    if (i >= 0 && siguiente[i + 1]) onElegir(siguiente[i + 1].id);
  }

  function quitar(id: string) {
    onCambio(quitarBloque(composicion, id));
    if (elegido === id) onElegir(null);
  }

  function alEmpezarArrastre(e: DragStartEvent) {
    setArrastrando(String(e.active.id));
  }

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const desde = composicion.findIndex((b) => b.id === active.id);
    const hasta = composicion.findIndex((b) => b.id === over.id);
    if (desde >= 0 && hasta >= 0) onCambio(mover(composicion, desde, hasta));
  }

  const bloqueArrastrado = arrastrando
    ? composicion.find((b) => b.id === arrastrando)
    : null;

  return (
    <div className="estructura">
      <p className="constructor__titulo">
        Estructura de la página
        <span className="tenue">
          {composicion.length} {composicion.length === 1 ? "sección" : "secciones"}
        </span>
      </p>

      {composicion.length === 0 ? (
        <EstadoVacio titulo="Página vacía">
          Añade secciones desde el botón de abajo. El orden de esta lista es el
          orden en que se verán.
        </EstadoVacio>
      ) : (
        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragStart={alEmpezarArrastre}
          onDragEnd={alSoltar}
          onDragCancel={() => setArrastrando(null)}
        >
          <SortableContext
            items={composicion.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="estructura__pila">
              {composicion.map((bloque, i) => (
                <FilaEstructura
                  key={bloque.id}
                  bloque={bloque}
                  definicion={porCodigo.get(bloque.tipo)}
                  indice={i}
                  total={composicion.length}
                  elegido={bloque.id === elegido}
                  onElegir={() => onElegir(bloque.id)}
                  onSubir={() => onCambio(mover(composicion, i, i - 1))}
                  onBajar={() => onCambio(mover(composicion, i, i + 1))}
                  onDuplicar={() => duplicar(bloque)}
                  onQuitar={() => quitar(bloque.id)}
                />
              ))}
            </ol>
          </SortableContext>

          <DragOverlay>
            {bloqueArrastrado && (
              <div className="estructura__fila estructura__fila--flotante">
                <span className="estructura__asa">
                  <GripVertical size={14} />
                </span>
                <span className="estructura__fila-nombre">
                  {porCodigo.get(bloqueArrastrado.tipo)?.nombre ?? bloqueArrastrado.tipo}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <button type="button" className="estructura__agregar" onClick={onAgregarSeccion}>
        <Plus size={15} />
        Agregar sección
      </button>

      <button type="button" className="tarjeta-apariencia" onClick={onAbrirApariencia}>
        <span className="tarjeta-apariencia__icono" aria-hidden="true">
          <Palette size={16} />
        </span>
        <span>
          <span className="tarjeta-apariencia__titulo">Apariencia global</span>
          <span className="tenue">Colores, tipografía, botones y más.</span>
        </span>
      </button>
    </div>
  );
}

function FilaEstructura({
  bloque,
  definicion,
  indice,
  total,
  elegido,
  onElegir,
  onSubir,
  onBajar,
  onDuplicar,
  onQuitar,
}: {
  bloque: BloqueColocado;
  definicion: Bloque | undefined;
  indice: number;
  total: number;
  elegido: boolean;
  onElegir: () => void;
  onSubir: () => void;
  onBajar: () => void;
  onDuplicar: () => void;
  onQuitar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: bloque.id });
  const Icono = iconoDeBloque(definicion?.icono);
  const oculto =
    !bloque.visible.movil || !bloque.visible.tablet || !bloque.visible.escritorio;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`estructura__fila ${elegido ? "esta-elegida" : ""} ${
        isDragging ? "se-arrastra" : ""
      }`}
      onClick={onElegir}
    >
      <span className="estructura__asa" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical size={14} />
      </span>

      <span className="estructura__fila-icono" aria-hidden="true">
        <Icono size={15} />
      </span>

      <span className="estructura__fila-info">
        <span className="estructura__fila-nombre">
          {definicion?.nombre ?? bloque.tipo}
          {!definicion && <span className="es-malo"> · desconocido</span>}
        </span>
        <span className="tenue">
          {bloque.variante || "por defecto"}
          {oculto && (
            <>
              {" "}
              · <EyeOff size={10} style={{ verticalAlign: "-1px" }} /> oculto
            </>
          )}
        </span>
      </span>

      <span className="estructura__fila-acciones" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icono-boton" aria-label="Subir" disabled={indice === 0} onClick={onSubir}>
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="icono-boton"
          aria-label="Bajar"
          disabled={indice === total - 1}
          onClick={onBajar}
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          className="icono-boton"
          aria-label="Duplicar"
          disabled={definicion?.unico_por_pagina}
          onClick={onDuplicar}
        >
          <Copy size={13} />
        </button>
        <button type="button" className="icono-boton" aria-label="Quitar" onClick={onQuitar}>
          <Trash2 size={13} />
        </button>
      </span>
    </li>
  );
}
