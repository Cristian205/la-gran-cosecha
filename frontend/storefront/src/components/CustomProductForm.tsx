import { PackagePlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerUnidades } from "../api/catalog";
import { useCart } from "../store/cart";
import type { UnidadMedida } from "../types";

interface Props {
  categoriaId: number;
  categoriaNombre: string;
}

export function CustomProductForm({ categoriaId, categoriaNombre }: Props) {
  const agregarPersonalizado = useCart((s) => s.agregarPersonalizado);
  const [abierto, setAbierto] = useState(false);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [unidadId, setUnidadId] = useState<number | "">("");
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (abierto && unidades.length === 0) {
      obtenerUnidades()
        .then(setUnidades)
        .catch(() => setUnidades([]));
    }
  }, [abierto, unidades.length]);

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || cantidad <= 0) return;

    const unidad = unidades.find((u) => u.id === unidadId);
    agregarPersonalizado({
      id: crypto.randomUUID(),
      nombre: nombre.trim(),
      cantidad,
      unidadId: unidad ? unidad.id : null,
      unidadNombre: unidad ? unidad.nombre_unidad : "",
      categoriaId,
      categoriaNombre,
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
        Descríbelo y quedará en tu pedido dentro de {categoriaNombre}; confirmamos
        el precio cuando lo recibamos.
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
