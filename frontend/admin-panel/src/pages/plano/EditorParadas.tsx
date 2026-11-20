import { ArrowDown, ArrowUp, GripVertical, MapPin, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Combobox } from "../../components/Combobox";
import type { Cliente } from "../../types";

/**
 * La secuencia de visitas de una ruta: clientes de la tienda en orden.
 * Se reordena arrastrando (ratón) o con las flechas (teclado y pantallas
 * táctiles, donde el arrastre nativo no existe).
 */

export interface ParadaEditable {
  cliente: number;
  cliente_nombre: string;
  direccion: string;
  nota: string;
}

interface Props {
  paradas: ParadaEditable[];
  clientes: Cliente[];
  editable: boolean;
  onCambiar: (paradas: ParadaEditable[]) => void;
  /** Clientes que otra ruta del mismo día ya visita (solo se avisa). */
  enOtraRuta?: Map<number, string>;
  idBase: string;
}

export function EditorParadas({ paradas, clientes, editable, onCambiar, enOtraRuta, idBase }: Props) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const usados = useMemo(() => new Set(paradas.map((p) => p.cliente)), [paradas]);
  const opciones = useMemo(
    () =>
      clientes
        .filter((c) => !usados.has(c.id))
        .map((c) => ({ valor: c.id, etiqueta: c.nombre_cliente, detalle: c.direccion_cliente?.slice(0, 40) || undefined })),
    [clientes, usados]
  );

  function mover(desde: number, hacia: number) {
    if (desde === hacia || hacia < 0 || hacia > paradas.length) return;
    const lista = [...paradas];
    const [p] = lista.splice(desde, 1);
    lista.splice(hacia > desde ? hacia - 1 : hacia, 0, p);
    onCambiar(lista);
  }

  function agregar(id: number | "") {
    if (id === "") return;
    const c = clientes.find((x) => x.id === id);
    if (!c) return;
    onCambiar([...paradas, { cliente: c.id, cliente_nombre: c.nombre_cliente, direccion: c.direccion_cliente || "", nota: "" }]);
  }

  return (
    <div className="pl-paradas">
      {paradas.length === 0 ? (
        <p className="pl-paradas-vacio">
          <MapPin size={15} /> Sin paradas. Agrega los clientes en el orden en que se visitan.
        </p>
      ) : (
        <ol
          className="pl-paradas-lista"
          onDragOver={(e) => {
            if (arrastrando === null) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            // Al bajar, se suelta DESPUÉS de la fila de destino; al subir, antes.
            if (arrastrando !== null && sobre !== null) mover(arrastrando, arrastrando < sobre ? sobre + 1 : sobre);
            setArrastrando(null);
            setSobre(null);
          }}
        >
          {paradas.map((p, i) => (
            <li
              key={p.cliente}
              className={`pl-parada-fila ${arrastrando === i ? "arrastrando" : ""} ${sobre === i && arrastrando !== null && arrastrando !== i ? "destino" : ""}`}
              draggable={editable}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(p.cliente));
                setArrastrando(i);
              }}
              onDragEnter={() => setSobre(i)}
              onDragEnd={() => {
                setArrastrando(null);
                setSobre(null);
              }}
            >
              {editable && <GripVertical size={15} className="pl-asa" aria-hidden="true" />}
              <span className="pl-parada-num">{i + 1}</span>
              <div className="pl-parada-datos">
                <strong>{p.cliente_nombre}</strong>
                <small>{p.direccion || "Sin dirección registrada"}</small>
                {enOtraRuta?.get(p.cliente) && <small className="pl-aviso-texto">También en {enOtraRuta.get(p.cliente)}</small>}
                {editable ? (
                  <input
                    className="pl-parada-nota"
                    value={p.nota}
                    maxLength={200}
                    placeholder="Nota para el conductor (opcional)"
                    aria-label={`Nota de ${p.cliente_nombre}`}
                    onChange={(e) => onCambiar(paradas.map((x, k) => (k === i ? { ...x, nota: e.target.value } : x)))}
                  />
                ) : (
                  p.nota && <small className="pl-parada-nota-texto">{p.nota}</small>
                )}
              </div>
              {editable && (
                <div className="pl-parada-acciones">
                  <button type="button" className="btn-icon" disabled={i === 0} onClick={() => mover(i, i - 1)} aria-label={`Visitar antes a ${p.cliente_nombre}`}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="btn-icon" disabled={i === paradas.length - 1} onClick={() => mover(i, i + 2)} aria-label={`Visitar después a ${p.cliente_nombre}`}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="btn-icon peligro" onClick={() => onCambiar(paradas.filter((_, k) => k !== i))} aria-label={`Quitar a ${p.cliente_nombre}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {editable && (
        <div className="pl-paradas-agregar">
          <Combobox<number>
            id={`${idBase}-agregar`}
            valor=""
            opciones={opciones}
            onCambiar={agregar}
            placeholder="Agregar cliente a la ruta…"
            buscable
            icono={<Plus size={15} />}
          />
        </div>
      )}
    </div>
  );
}
