import { useState } from "react";
import { actualizarBeneficio, crearBeneficio } from "../../api/content";
import { Modal } from "../../components/Modal";
import type { BeneficioComercial } from "../../types";
import { extraerMensajeError } from "../../utils";

const ICONOS: BeneficioComercial["icono"][] = [
  "truck",
  "clock",
  "package",
  "wallet",
  "headset",
  "check",
  "shield",
  "users",
  "leaf",
  "sprout",
  "droplet",
  "shopping-bag",
  "apple",
  "badge-check",
  "handshake",
  "headphones",
  "user-check",
];

interface Props {
  beneficio: BeneficioComercial | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function BeneficioFormModal({ beneficio, onCerrar, onGuardado }: Props) {
  const [icono, setIcono] = useState<BeneficioComercial["icono"]>(beneficio?.icono ?? "check");
  const [titulo, setTitulo] = useState(beneficio?.titulo ?? "");
  const [texto, setTexto] = useState(beneficio?.texto ?? "");
  const [orden, setOrden] = useState(beneficio?.orden ?? 0);
  const [activo, setActivo] = useState(beneficio?.activo ?? true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    const payload = { icono, titulo: titulo.trim(), texto: texto.trim(), orden, activo };

    setGuardando(true);
    try {
      if (beneficio) {
        await actualizarBeneficio(beneficio.id, payload);
      } else {
        await crearBeneficio(payload);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el beneficio."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={beneficio ? "Editar beneficio" : "Nuevo beneficio"}
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
          <select value={icono} onChange={(e) => setIcono(e.target.value as BeneficioComercial["icono"])}>
            {ICONOS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Título *</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Nunca te quedas sin insumos"
          />
        </div>
        <div className="campo">
          <label>Texto</label>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej: Inventario disponible confirmado, no catálogo de puede que sí."
          />
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
