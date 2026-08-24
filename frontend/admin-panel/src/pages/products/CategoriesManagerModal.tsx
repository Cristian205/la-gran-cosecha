import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { eliminarCategoria, obtenerCategorias } from "../../api/resources";
import { Modal } from "../../components/Modal";
import type { Categoria } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { CategoryFormModal } from "./CategoryFormModal";

interface Props {
  onCerrar: () => void;
  onCambio: () => void;
}

export function CategoriesManagerModal({ onCerrar, onCambio }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);

  function cargar() {
    setCargando(true);
    obtenerCategorias()
      .then(setCategorias)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(c: Categoria) {
    if (
      !(await confirmarEliminar(
        `¿Eliminar la categoría "${c.nombre_categoria}"? Solo se puede si no tiene productos.`
      ))
    )
      return;
    try {
      await eliminarCategoria(c.id);
      cargar();
      onCambio();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar la categoría."));
    }
  }

  return (
    <Modal
      titulo="Categorías del catálogo"
      onCerrar={onCerrar}
      lateral
      footer={
        <button className="btn secundario" onClick={onCerrar}>
          Cerrar
        </button>
      }
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button
          className="btn primario sm"
          onClick={() => {
            setEditando(null);
            setModalForm(true);
          }}
        >
          <Plus size={14} /> Nueva categoría
        </button>
      </div>

      {cargando ? (
        <div className="vacio">Cargando…</div>
      ) : categorias.length === 0 ? (
        <div className="vacio">Sin categorías todavía</div>
      ) : (
        <div className="mini-lista">
          {categorias.map((c) => (
            <div className="categoria-fila" key={c.id}>
              <div className="categoria-fila-miniatura">
                {c.imagen_url ? (
                  <img src={c.imagen_url} alt="" />
                ) : (
                  <ImageOff size={16} />
                )}
              </div>
              <div className="categoria-fila-info">
                <span className="nombre">{c.nombre_categoria}</span>
                <span className="meta">
                  {c.abreviatura} · orden {c.orden} ·{" "}
                  <span className={c.estado_categoria ? "" : "inactivo-texto"}>
                    {c.estado_categoria ? "Activa" : "Inactiva"}
                  </span>
                </span>
              </div>
              <div className="acciones">
                <button
                  className="btn-icon editar"
                  onClick={() => {
                    setEditando(c);
                    setModalForm(true);
                  }}
                  aria-label="Editar categoría"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="btn-icon peligro"
                  onClick={() => eliminar(c)}
                  aria-label="Eliminar categoría"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalForm && (
        <CategoryFormModal
          categoria={editando}
          onCerrar={() => setModalForm(false)}
          onGuardado={() => {
            setModalForm(false);
            cargar();
            onCambio();
          }}
        />
      )}
    </Modal>
  );
}
