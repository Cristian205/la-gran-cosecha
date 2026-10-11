/**
 * El catálogo de secciones, para agregar una nueva.
 *
 * Antes era una columna fija siempre a la vista, aunque la mayor parte del
 * tiempo se está editando y no agregando. Ahora se abre sobre la estructura al
 * pulsar "Agregar sección" y se cierra sola al elegir una — un modo aparte, no
 * un panel que compite todo el tiempo por espacio.
 *
 * No hay capturas de pantalla reales de cada tipo de bloque en el sistema, así
 * que la "miniatura" de cada tarjeta es su ícono (`Bloque.icono`, el mismo que
 * usa la tienda pública) más su nombre y su descripción — no un mockup.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import {
  ETIQUETA_CATEGORIA,
  type Bloque,
  type CategoriaBloque,
  type Composicion,
} from "../api/tienda";
import { iconoDeBloque } from "./iconosBloque";

interface Props {
  catalogo: Bloque[];
  composicion: Composicion;
  onAgregar: (bloque: Bloque) => void;
  onVolver: () => void;
}

export function SelectorDeBloques({ catalogo, composicion, onAgregar, onVolver }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const puestos = new Set(composicion.map((b) => b.tipo));

  const porCategoria = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const filtrado = catalogo.filter(
      (b) =>
        b.activo &&
        (!termino ||
          b.nombre.toLowerCase().includes(termino) ||
          b.descripcion.toLowerCase().includes(termino))
    );
    const grupos = new Map<CategoriaBloque, Bloque[]>();
    for (const bloque of filtrado) {
      if (!grupos.has(bloque.categoria)) grupos.set(bloque.categoria, []);
      grupos.get(bloque.categoria)!.push(bloque);
    }
    return [...grupos.entries()];
  }, [catalogo, busqueda]);

  const sinResultados = porCategoria.length === 0;

  return (
    <div className="selector-bloques">
      <button type="button" className="volver-link" onClick={onVolver}>
        <ArrowLeft size={14} />
        Estructura
      </button>

      <p className="constructor__titulo" style={{ marginTop: 10 }}>
        Agregar sección
      </p>

      <label className="campo-icono">
        <Search size={15} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar una sección…"
          autoFocus
        />
      </label>

      {sinResultados ? (
        <p className="tenue" style={{ marginTop: 14 }}>
          Ninguna sección coincide con «{busqueda}».
        </p>
      ) : (
        porCategoria.map(([categoria, bloques]) => (
          <div key={categoria} className="constructor__grupo">
            <p className="constructor__categoria">{ETIQUETA_CATEGORIA[categoria]}</p>
            <div className="tarjetas-bloque">
              {bloques.map((bloque) => {
                const agotado = bloque.unico_por_pagina && puestos.has(bloque.codigo);
                const Icono = iconoDeBloque(bloque.icono);
                return (
                  <button
                    key={bloque.codigo}
                    type="button"
                    className="tarjeta-bloque"
                    disabled={agotado}
                    title={agotado ? "Solo puede aparecer una vez en la página" : undefined}
                    onClick={() => onAgregar(bloque)}
                  >
                    <span className="tarjeta-bloque__icono" aria-hidden="true">
                      <Icono size={18} />
                    </span>
                    <span className="tarjeta-bloque__nombre">{bloque.nombre}</span>
                    {bloque.descripcion && (
                      <span className="tarjeta-bloque__desc">{bloque.descripcion}</span>
                    )}
                    {agotado && <span className="tarjeta-bloque__agotado">Ya agregada</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
