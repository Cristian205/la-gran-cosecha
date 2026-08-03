import { useState } from "react";
import { actualizarTestimonio, crearTestimonio } from "../../api/content";
import { Modal } from "../../components/Modal";
import type { Testimonio } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  testimonio: Testimonio | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function TestimonioFormModal({ testimonio, onCerrar, onGuardado }: Props) {
  const [nombre, setNombre] = useState(testimonio?.nombre ?? "");
  const [rol, setRol] = useState(testimonio?.rol ?? "");
  const [texto, setTexto] = useState(testimonio?.texto ?? "");
  const [estrellas, setEstrellas] = useState(testimonio?.estrellas ?? 5);
  const [orden, setOrden] = useState(testimonio?.orden ?? 0);
  const [activo, setActivo] = useState(testimonio?.activo ?? true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !texto.trim()) {
      setError("El nombre y el testimonio son obligatorios.");
      return;
    }

    const payload = { nombre, rol, texto, estrellas, orden, activo };

    setGuardando(true);
    try {
      if (testimonio) {
        await actualizarTestimonio(testimonio.id, payload);
      } else {
        await crearTestimonio(payload);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el testimonio."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={testimonio ? "Editar testimonio" : "Nuevo testimonio"}
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

        <div className="fila">
          <div className="campo">
            <label>Nombre *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="campo">
            <label>Rol / negocio</label>
            <input value={rol} onChange={(e) => setRol(e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label>Testimonio *</label>
          <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="fila">
          <div className="campo">
            <label>Estrellas (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={estrellas}
              onChange={(e) => setEstrellas(Number(e.target.value) || 5)}
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
          <label style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: "1.6rem" }}>
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              style={{ width: "auto" }}
            />
            Activo
          </label>
        </div>
      </form>
    </Modal>
  );
}
