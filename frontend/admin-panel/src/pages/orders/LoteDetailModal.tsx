import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Modal } from "../../components/Modal";
import { obtenerLote } from "../../api/resources";
import type { LoteDetalle } from "../../types";
import { formatoFecha, formatoPrecio } from "../../utils";
import { Tooltip } from "../../components/Tooltip";

interface Props {
  loteId: number;
  onCerrar: () => void;
  onVerPedido: (id: number) => void;
}

export function LoteDetailModal({ loteId, onCerrar, onVerPedido }: Props) {
  const [lote, setLote] = useState<LoteDetalle | null>(null);

  useEffect(() => {
    obtenerLote(loteId).then(setLote);
  }, [loteId]);

  return (
    <Modal
      ancho
      lateral
      titulo={lote ? `Lote #${lote.id} · ${lote.tipo_display}` : `Lote #${loteId}`}
      onCerrar={onCerrar}
      footer={
        <button className="btn secundario" onClick={onCerrar}>
          Cerrar
        </button>
      }
    >
      {!lote ? (
        <div className="vacio">Cargando…</div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: "1rem" }}>
            <div className="stat azul compacto">
              <div className="label">Pedidos incluidos</div>
              <div className="valor">{lote.cantidad_pedidos}</div>
            </div>
            <div className="stat verde compacto">
              <div className="label">Total del lote</div>
              <div className="valor">{formatoPrecio(lote.total_lote)}</div>
            </div>
            <div className="stat dark compacto">
              <div className="label">Generado por</div>
              <div className="valor" style={{ fontSize: "1rem" }}>
                {lote.usuario_nombre}
              </div>
              <div className="pie">{formatoFecha(lote.fecha_creacion)}</div>
            </div>
          </div>

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lote.pedidos.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{p.cliente_nombre || "—"}</td>
                    <td>{formatoFecha(p.fecha_pedido)}</td>
                    <td className="num">{p.num_items}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{formatoPrecio(p.total_pedido)}</td>
                    <td>
                      <span className={`badge ${p.estado}`}>{p.estado}</span>
                    </td>
                    <td>
                      <Tooltip label="Ver pedido">
                        <button
                          type="button"
                          className="btn-icon editar"
                          onClick={() => onVerPedido(p.id)}
                          aria-label="Ver pedido"
                        >
                          <Eye size={16} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
                {lote.pedidos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="vacio">
                      Sin pedidos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
