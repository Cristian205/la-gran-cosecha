import { useState } from "react";
import { actualizarCategoria, crearCategoria } from "../../api/resources";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import type { Categoria } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  categoria: Categoria | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function CategoryFormModal({ categoria, onCerrar, onGuardado }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre_categoria ?? "");
  const [abreviatura, setAbreviatura] = useState(categoria?.abreviatura ?? "");
  const [orden, setOrden] = useState(categoria?.orden ?? 0);
  const [estado, setEstado] = useState(categoria?.estado_categoria ?? true);
  const [imagen, setImagen] = useState<File | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !abreviatura.trim()) {
      setError("El nombre y la abreviatura son obligatorios.");
      return;
    }

    const payload = {
      nombre_categoria: nombre.trim(),
      abreviatura: abreviatura.trim(),
      orden,
      estado_categoria: estado,
    };

    setGuardando(true);
    try {
      if (categoria) {
        await actualizarCategoria(categoria.id, payload, imagen);
      } else {
        await crearCategoria(payload, imagen);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar la categoría."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={categoria ? "Editar categoría" : "Nueva categoría"}
      onCerrar={onCerrar}
      lateral
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}

        <div className="campo">
          <label>Foto de la categoría</label>
          <MediaField
            valor={imagen}
            urlActual={categoria?.imagen_url ?? null}
            onCambiar={setImagen}
            accept="image/png,image/jpeg,image/webp"
            ayuda="Se usa en los tiles de categoría de Inicio, en vez de un color plano."
          />
        </div>

        <div className="campo">
          <label>Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Verduras" />
        </div>
        <div className="fila">
          <div className="campo">
            <label>Abreviatura * (para el código de producto)</label>
            <input
              value={abreviatura}
              onChange={(e) => setAbreviatura(e.target.value)}
              placeholder="Ej: VER"
            />
          </div>
          <div className="campo">
            <label>Orden</label>
            <input
              type="number"
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <input
            type="checkbox"
            checked={estado}
            onChange={(e) => setEstado(e.target.checked)}
            style={{ width: "auto" }}
          />
          Categoría activa
        </label>
      </form>
    </Modal>
  );
}
