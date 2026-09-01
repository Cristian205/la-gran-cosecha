"use client";

import { PackagePlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerUnidades } from "@/lib/datos";
import { useCart } from "@/estado/carrito";
import type { Categoria, UnidadMedida } from "@/lib/tipos";

interface Props {
  categorias: Categoria[];
  /** Categoría filtrada en la tienda; si no hay, el cliente la elige aquí. */
  categoriaFija?: Categoria | null;
}

export function CustomProductForm({ categorias, categoriaFija }: Props) {
  const agregarPersonalizado = useCart((s) => s.agregarPersonalizado);
  const [abierto, setAbierto] = useState(false);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [unidadId, setUnidadId] = useState<number | "">("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (abierto && unidades.length === 0) {
      obtenerUnidades()
        .then(setUnidades)
        .catch(() => setUnidades([]));
    }
  }, [abierto, unidades.length]);

  // La categoría del filtro manda; si el cliente cambia de filtro, se refleja.
  useEffect(() => {
    if (categoriaFija) setCategoriaId(categoriaFija.id);
  }, [categoriaFija]);

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    const categoria = categoriaFija ?? categorias.find((c) => c.id === categoriaId);
    if (!nombre.trim() || cantidad <= 0 || !categoria) return;

    const unidad = unidades.find((u) => u.id === unidadId);
    agregarPersonalizado({
      id: crypto.randomUUID(),
      nombre: nombre.trim(),
      cantidad,
      unidadId: unidad ? unidad.id : null,
      unidadNombre: unidad ? unidad.nombre_unidad : "",
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre_categoria,
    });

    setNombre("");
    setCantidad(1);
    setUnidadId("");
    setConfirmado(true);
    setTimeout(() => setConfirmado(false), 1800);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        className="custom-prod-toggle"
        onClick={() => setAbierto(true)}
      >
        <PackagePlus size={16} />
        ¿No encuentras tu producto? Escríbelo aquí
      </button>
    );
  }

  return (
    <form className="custom-prod-card glass" onSubmit={handleAgregar}>
      <h4 className="custom-prod-titulo">
        <PackagePlus size={16} /> Producto que no está en el catálogo
      </h4>
      <p className="custom-prod-hint">
        Descríbelo y quedará en tu pedido
        {categoriaFija ? ` dentro de ${categoriaFija.nombre_categoria}` : ""};
        confirmamos el precio cuando lo recibamos.
      </p>

      <div className="custom-prod-campos">
        <input
          placeholder="Ej: Papa criolla costeña"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          type="number"
          inputMode="decimal"
          min={0.5}
          step={0.5}
          value={cantidad}
          onChange={(e) => setCantidad(Number(e.target.value) || 1)}
          aria-label="Cantidad"
        />
        <select
          value={unidadId}
          onChange={(e) =>
            setUnidadId(e.target.value === "" ? "" : Number(e.target.value))
          }
          aria-label="Unidad"
        >
          <option value="">Unidad (opcional)</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre_unidad}
            </option>
          ))}
        </select>
      </div>

      {!categoriaFija && (
        <select
          className="custom-prod-categoria"
          value={categoriaId}
          onChange={(e) =>
            setCategoriaId(e.target.value === "" ? "" : Number(e.target.value))
          }
          aria-label="Categoría"
          required
        >
          <option value="">¿En qué categoría va?</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre_categoria}
            </option>
          ))}
        </select>
      )}

      <div className="custom-prod-acciones">
        <button type="button" className="btn btn-outline" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-verde">
          <Plus size={16} /> {confirmado ? "¡Agregado!" : "Agregar al pedido"}
        </button>
      </div>
    </form>
  );
}
