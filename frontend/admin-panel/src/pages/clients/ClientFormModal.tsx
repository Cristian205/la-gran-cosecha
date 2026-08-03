import { useState } from "react";
import { Modal } from "../../components/Modal";
import { actualizarCliente, crearCliente } from "../../api/resources";
import type { Cliente } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  cliente: Cliente | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function ClientFormModal({ cliente, onCerrar, onGuardado }: Props) {
  const esEdicion = cliente !== null;

  const [nombre, setNombre] = useState(cliente?.nombre_cliente ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono_cliente ?? "");
  const [direccion, setDireccion] = useState(cliente?.direccion_cliente ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    const payload = {
      nombre_cliente: nombre.trim(),
      telefono_cliente: telefono.trim(),
      direccion_cliente: direccion.trim(),
    };

    setGuardando(true);
    try {
      if (esEdicion) {
        await actualizarCliente(cliente!.id, payload);
      } else {
        await crearCliente(payload);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el cliente."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      lateral
      titulo={esEdicion ? "Editar cliente" : "Nuevo cliente"}
      onCerrar={onCerrar}
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
          <label>Nombre del cliente *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="campo">
          <label>Teléfono</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>

        <div className="campo">
          <label>Dirección</label>
          <textarea
            rows={3}
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
