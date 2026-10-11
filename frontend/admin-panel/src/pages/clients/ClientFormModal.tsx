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
  const [documento, setDocumento] = useState(cliente?.documento_cliente ?? "");
  const [aceptaWhatsapp, setAceptaWhatsapp] = useState(cliente?.acepta_whatsapp ?? false);
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
      documento_cliente: documento.trim(),
      acepta_whatsapp: aceptaWhatsapp,
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
      amplio
      medio
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
          <label>Cédula</label>
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            inputMode="numeric"
            placeholder="Sin puntos"
          />
          <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: ".4rem" }}>
            Con la cédula, el cliente puede pedir y ver sus pedidos en la tienda sin volver a escribir sus datos
            (si la tienda identifica por cédula).
            {cliente?.acepto_precios_en &&
              ` Aceptó el ajuste de precios el ${new Date(cliente.acepto_precios_en).toLocaleDateString("es-CO")}.`}
          </p>
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

        <div className="campo-switch">
          <label className="switch">
            <input type="checkbox" checked={aceptaWhatsapp} onChange={(e) => setAceptaWhatsapp(e.target.checked)} />
            <span className="switch-riel" />
          </label>
          <div>
            <div className="campo-switch-titulo">Acepta avisos por WhatsApp</div>
            <div className="campo-switch-desc">
              Márcalo solo si el cliente te lo autorizó (por teléfono, en persona o en la tienda).
              {cliente?.whatsapp_decidido_en &&
                ` Última decisión: ${new Date(cliente.whatsapp_decidido_en).toLocaleDateString("es-CO")}.`}
            </div>
          </div>
        </div>

        {esEdicion && (
          <p style={{ color: "var(--gris)", fontSize: ".82rem" }}>
            {cliente?.autorizo_datos_en
              ? `Autorizó el tratamiento de sus datos el ${new Date(cliente.autorizo_datos_en).toLocaleDateString("es-CO")}.`
              : "Aún no ha autorizado el tratamiento de sus datos en la tienda: se le pedirá en su próximo pedido."}
          </p>
        )}
      </form>
    </Modal>
  );
}
