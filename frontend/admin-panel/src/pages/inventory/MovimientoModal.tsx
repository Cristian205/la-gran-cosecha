import { useState } from "react";
import { Modal } from "../../components/Modal";
import {
  registrarAjuste,
  registrarEntrada,
  registrarTraslado,
  type Existencia,
  type Ubicacion,
} from "../../api/inventario";
import { extraerMensajeError } from "../../utils";

export type Operacion = "entrada" | "ajuste" | "traslado";

interface Props {
  operacion: Operacion;
  existencia: Existencia;
  ubicaciones: Ubicacion[];
  onCerrar: () => void;
  onHecho: () => void;
}

/**
 * Las tres formas de mover existencias, en un solo formulario.
 *
 * Están juntas porque comparten casi todo —producto, ubicación, motivo— y
 * separarlas en tres modales habría triplicado el mismo código para cambiar un
 * campo. Lo que NO comparten es lo importante, y es donde está el cuidado:
 *
 * * `entrada` pide cuánto LLEGA, que se suma.
 * * `ajuste` pide cuánto HAY, que sustituye. La diferencia la calcula el
 *   servidor. Pedir el total y no la resta es deliberado: contar es lo que la
 *   persona acaba de hacer, y la resta es justo el paso donde se equivoca.
 * * `traslado` pide cuánto se mueve, y a dónde.
 *
 * Confundir "cuánto llega" con "cuánto hay" es el error caro de esta pantalla,
 * así que cada modo lo dice en la etiqueta y lo repite en la ayuda.
 */
const TEXTOS: Record<
  Operacion,
  { titulo: string; etiqueta: string; ayuda: string; boton: string }
> = {
  entrada: {
    titulo: "Registrar entrada",
    etiqueta: "Cantidad que llega",
    ayuda: "Se suma a lo que ya hay. Para una compra, una devolución o el inventario inicial.",
    boton: "Registrar entrada",
  },
  ajuste: {
    titulo: "Ajustar por conteo",
    etiqueta: "Cantidad contada en total",
    ayuda: "Escribe lo que contaste, no la diferencia. El saldo pasa a ser exactamente ese número.",
    boton: "Cuadrar saldo",
  },
  traslado: {
    titulo: "Trasladar existencias",
    etiqueta: "Cantidad a trasladar",
    ayuda: "Sale de una ubicación y entra en otra. El total del negocio no cambia.",
    boton: "Trasladar",
  },
};

export function MovimientoModal({
  operacion,
  existencia,
  ubicaciones,
  onCerrar,
  onHecho,
}: Props) {
  const textos = TEXTOS[operacion];
  const destinosPosibles = ubicaciones.filter(
    (u) => u.activa && u.id !== existencia.ubicacion
  );

  const [cantidad, setCantidad] = useState(
    // El ajuste arranca con el saldo actual: casi siempre el conteo coincide, y
    // así solo hay que teclear cuando NO coincide.
    operacion === "ajuste" ? existencia.cantidad : ""
  );
  const [destino, setDestino] = useState<number | "">(destinosPosibles[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numero = Number(cantidad);
    if (cantidad.trim() === "" || Number.isNaN(numero)) {
      setError("Escribe una cantidad.");
      return;
    }
    if (operacion !== "ajuste" && numero <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }
    if (numero < 0) {
      setError("La cantidad no puede ser negativa.");
      return;
    }
    if (operacion === "traslado" && destino === "") {
      setError("Elige la ubicación de destino.");
      return;
    }

    setGuardando(true);
    try {
      if (operacion === "entrada") {
        await registrarEntrada({
          producto_id: existencia.producto,
          cantidad,
          ubicacion_id: existencia.ubicacion,
          motivo,
        });
      } else if (operacion === "ajuste") {
        await registrarAjuste({
          producto_id: existencia.producto,
          cantidad_contada: cantidad,
          ubicacion_id: existencia.ubicacion,
          motivo,
        });
      } else {
        await registrarTraslado({
          producto_id: existencia.producto,
          origen_id: existencia.ubicacion,
          destino_id: Number(destino),
          cantidad,
          motivo,
        });
      }
      onHecho();
    } catch (err) {
      // El backend devuelve mensajes escritos para una persona —«solo hay 3
      // disponibles»—, así que se muestran tal cual en vez de traducirlos.
      setError(extraerMensajeError(err, "No se pudo registrar el movimiento."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      lateral
      titulo={textos.titulo}
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button className="btn primario" onClick={enviar} disabled={guardando}>
            {guardando ? "Registrando…" : textos.boton}
          </button>
        </>
      }
    >
      <form onSubmit={enviar}>
        {error && <div className="error-box">{error}</div>}

        <div className="campo">
          <label>Producto</label>
          <input value={existencia.producto_nombre} disabled />
          <small className="campo-ayuda">
            {existencia.producto_codigo} · {existencia.ubicacion_nombre} · hay{" "}
            {existencia.cantidad} ({existencia.disponible} disponibles)
          </small>
        </div>

        <div className="campo">
          <label>{textos.etiqueta} *</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            autoFocus
          />
          <small className="campo-ayuda">{textos.ayuda}</small>
        </div>

        {operacion === "traslado" && (
          <div className="campo">
            <label>Destino *</label>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value ? Number(e.target.value) : "")}
            >
              {destinosPosibles.length === 0 && <option value="">Sin otras ubicaciones</option>}
              {destinosPosibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="campo">
          <label>Motivo</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={
              operacion === "ajuste" ? "Conteo de fin de mes" : "Compra a proveedor"
            }
          />
          <small className="campo-ayuda">
            Queda en el historial. Es lo que se lee dentro de seis meses al
            investigar un descuadre.
          </small>
        </div>
      </form>
    </Modal>
  );
}
