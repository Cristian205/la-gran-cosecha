import { useMemo, useState } from "react";
import { Modal } from "../../components/Modal";
import { cobrar, type MedioPago, type Venta } from "../../api/pos";
import { extraerMensajeError, formatoPrecio } from "../../utils";

interface Props {
  venta: Venta;
  medios: MedioPago[];
  onCerrar: () => void;
  onCobrada: (venta: Venta) => void;
}

interface Reparto {
  medio_id: number;
  importe: string;
  referencia: string;
}

/**
 * El cobro: la cuarta zona.
 *
 * Admite varios medios porque el pago partido —mitad efectivo, mitad tarjeta—
 * es la norma en un mostrador, no la excepción. Arranca con una sola línea por
 * el total, que es el caso del noventa por ciento de las ventas.
 *
 * El vuelto se calcula pero NO se guarda: lo que entra en caja es el importe
 * cobrado, y registrar el vuelto como si fuera un dato del negocio solo daría
 * dos números que decir lo mismo y la posibilidad de que discrepen.
 */
export function CobroModal({ venta, medios, onCerrar, onCobrada }: Props) {
  const total = Number(venta.total);
  const [repartos, setRepartos] = useState<Reparto[]>(() => [
    { medio_id: medios[0]?.id ?? 0, importe: venta.total, referencia: "" },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cubierto = useMemo(
    () => repartos.reduce((suma, r) => suma + (Number(r.importe) || 0), 0),
    [repartos]
  );
  const falta = total - cubierto;
  // Entregar de más solo tiene sentido en efectivo: el datáfono cobra exacto.
  const enEfectivo = repartos.some(
    (r) => medios.find((m) => m.id === r.medio_id)?.tipo === "EFECTIVO"
  );
  const vuelto = falta < 0 && enEfectivo ? -falta : 0;

  function cambiar(indice: number, cambios: Partial<Reparto>) {
    setRepartos((prev) => prev.map((r, i) => (i === indice ? { ...r, ...cambios } : r)));
  }

  async function confirmar() {
    setError(null);
    if (falta > 0.009) {
      setError(`Faltan ${formatoPrecio(falta)} por cubrir.`);
      return;
    }
    setGuardando(true);
    try {
      const cobrada = await cobrar(
        venta.id,
        repartos
          .filter((r) => Number(r.importe) > 0)
          .map((r) => ({
            medio_id: r.medio_id,
            // Nunca más del total: si alguien paga con un billete grande, lo
            // que entra en caja es el precio, no lo que dio.
            importe: String(Math.min(Number(r.importe), total)),
            referencia: r.referencia,
          }))
      );
      onCobrada(cobrada);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo cobrar."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Cobrar ${formatoPrecio(total)}`}
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button className="btn primario" onClick={confirmar} disabled={guardando}>
            {guardando ? "Cobrando…" : "Cobrar"}
          </button>
        </>
      }
    >
      {error && <div className="error-box">{error}</div>}

      {repartos.map((r, i) => (
        <div key={i} className="campo">
          <label>Medio de pago</label>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <select
              value={r.medio_id}
              onChange={(e) => cambiar(i, { medio_id: Number(e.target.value) })}
              style={{ flex: 1 }}
            >
              {medios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={r.importe}
              onChange={(e) => cambiar(i, { importe: e.target.value })}
              style={{ width: "9rem", textAlign: "right" }}
            />
          </div>
          {medios.find((m) => m.id === r.medio_id)?.tipo !== "EFECTIVO" && (
            <input
              placeholder="Referencia o número de aprobación"
              value={r.referencia}
              onChange={(e) => cambiar(i, { referencia: e.target.value })}
              style={{ marginTop: ".4rem" }}
            />
          )}
        </div>
      ))}

      {repartos.length < medios.length && (
        <button
          type="button"
          className="btn secundario"
          onClick={() =>
            setRepartos((prev) => [
              ...prev,
              {
                medio_id:
                  medios.find((m) => !prev.some((r) => r.medio_id === m.id))?.id ??
                  medios[0].id,
                importe: String(Math.max(falta, 0)),
                referencia: "",
              },
            ])
          }
        >
          Partir el pago
        </button>
      )}

      <div
        style={{
          marginTop: "1rem",
          paddingTop: ".75rem",
          borderTop: "1px solid var(--gris-claro)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Total</span>
          <strong>{formatoPrecio(total)}</strong>
        </div>
        {falta > 0.009 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--rojo-texto)",
            }}
          >
            <span>Falta</span>
            <strong>{formatoPrecio(falta)}</strong>
          </div>
        )}
        {vuelto > 0.009 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Vuelto</span>
            <strong>{formatoPrecio(vuelto)}</strong>
          </div>
        )}
      </div>
    </Modal>
  );
}
