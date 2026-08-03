import { useState } from "react";
import { actualizarTrustBadge, crearTrustBadge } from "../../api/content";
import { Modal } from "../../components/Modal";
import type { TrustBadge } from "../../types";
import { extraerMensajeError } from "../../utils";

const ICONOS: TrustBadge["icono"][] = ["leaf", "truck", "shield", "users"];

interface Props {
  badge: TrustBadge | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function TrustBadgeFormModal({ badge, onCerrar, onGuardado }: Props) {
  const [icono, setIcono] = useState<TrustBadge["icono"]>(badge?.icono ?? "leaf");
  const [valor, setValor] = useState(badge?.valor ?? "");
  const [etiqueta, setEtiqueta] = useState(badge?.etiqueta ?? "");
  const [orden, setOrden] = useState(badge?.orden ?? 0);
  const [activo, setActivo] = useState(badge?.activo ?? true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!valor.trim() || !etiqueta.trim()) {
      setError("El valor y la etiqueta son obligatorios.");
      return;
    }

    const payload = { icono, valor, etiqueta, orden, activo };

    setGuardando(true);
    try {
      if (badge) {
        await actualizarTrustBadge(badge.id, payload);
      } else {
        await crearTrustBadge(payload);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el sello de confianza."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={badge ? "Editar sello de confianza" : "Nuevo sello de confianza"}
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
          <label>Ícono</label>
          <select value={icono} onChange={(e) => setIcono(e.target.value as TrustBadge["icono"])}>
            {ICONOS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="fila">
          <div className="campo">
            <label>Valor (ej: 100%, 24-48h) *</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="campo">
            <label>Etiqueta *</label>
            <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
          </div>
        </div>
        <div className="fila">
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
