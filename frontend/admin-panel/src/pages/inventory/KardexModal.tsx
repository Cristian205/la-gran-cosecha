import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import {
  obtenerMovimientos,
  type Existencia,
  type Movimiento,
} from "../../api/inventario";
import { extraerMensajeError, formatoFecha } from "../../utils";

interface Props {
  existencia: Existencia;
  onCerrar: () => void;
}

/**
 * El kardex: por qué el saldo es el que es.
 *
 * Es la pantalla que responde «¿por qué hay siete y no nueve?», que en un
 * negocio real se pregunta cada semana. Por eso muestra el ORIGEN de cada
 * movimiento —el pedido, el ajuste, quién lo hizo— y no solo la cifra: un
 * histórico sin procedencia no resuelve ningún descuadre.
 *
 * No hay botón de editar ni de borrar, y no es un olvido. Un movimiento
 * equivocado se corrige con un ajuste que deja los dos a la vista; poder
 * reescribir el historial convertiría la única fuente de verdad del inventario
 * en una opinión.
 */
function describirOrigen(m: Movimiento): string {
  if (m.origen_tipo === "orders.Pedido" && m.origen_id) return `Pedido #${m.origen_id}`;
  if (m.origen_tipo === "panel") return "Desde el panel";
  if (!m.origen_tipo) return "—";
  return m.origen_id ? `${m.origen_tipo} #${m.origen_id}` : m.origen_tipo;
}

export function KardexModal({ existencia, onCerrar }: Props) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerMovimientos({
      producto: existencia.producto,
      ubicacion: existencia.ubicacion,
    })
      .then((datos) => {
        if (vigente) setMovimientos(datos);
      })
      .catch((err) => {
        if (vigente) setError(extraerMensajeError(err, "No se pudo cargar el historial."));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    // Evita escribir en un componente ya cerrado si la respuesta llega tarde.
    return () => {
      vigente = false;
    };
  }, [existencia.producto, existencia.ubicacion]);

  return (
    <Modal
      ancho
      titulo={`Historial · ${existencia.producto_nombre}`}
      onCerrar={onCerrar}
      footer={
        <button className="btn secundario" onClick={onCerrar}>
          Cerrar
        </button>
      }
    >
      {error && <div className="error-box">{error}</div>}

      <p className="campo-ayuda" style={{ marginBottom: "1rem" }}>
        {existencia.ubicacion_nombre} · saldo actual {existencia.cantidad}
        {Number(existencia.reservada) > 0 && ` · ${existencia.reservada} reservadas`}
      </p>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th style={{ textAlign: "right" }}>Cantidad</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th>Origen</th>
              <th>Quién</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="vacio">
                  Cargando historial…
                </td>
              </tr>
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={7} className="vacio">
                  Todavía no hay movimientos de este producto aquí
                </td>
              </tr>
            ) : (
              movimientos.map((m) => {
                const cantidad = Number(m.cantidad);
                return (
                  <tr key={m.id}>
                    <td>{formatoFecha(m.fecha)}</td>
                    <td>{m.tipo_display}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        // El signo es la información: distinguir lo que entra
                        // de lo que sale de un vistazo es la mitad de para qué
                        // se abre esta pantalla.
                        color: cantidad < 0 ? "var(--rojo-texto)" : "var(--verde-texto)",
                      }}
                    >
                      {cantidad > 0 ? "+" : ""}
                      {m.cantidad}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {m.saldo_resultante ?? "—"}
                    </td>
                    <td>{describirOrigen(m)}</td>
                    <td>{m.usuario_nombre || "—"}</td>
                    <td>{m.motivo || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
