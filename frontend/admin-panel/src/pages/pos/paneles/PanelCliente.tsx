import { useEffect, useState } from "react";
import { obtenerClientes } from "../../../api/resources";
import type { Cliente } from "../../../types";
import type { PropsDePanel } from "./registro";

/**
 * A quién se le vende.
 *
 * Es el panel que trae el propio POS: los clientes son del núcleo y poner
 * nombre a una venta es algo que hace cualquier mostrador. Carga su propia
 * lista en vez de recibirla de `PosPage`, y eso es deliberado: si la pantalla
 * tuviera que saber qué datos necesita cada panel, añadir el segundo la
 * obligaría a cambiar.
 */
export function PanelCliente({ venta, aporte, onAporte }: PropsDePanel) {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    void obtenerClientes().then(setClientes).catch(() => setClientes([]));
  }, []);

  const elegido = venta ? (venta.cliente ?? "") : ((aporte.cliente_id as number) ?? "");

  return (
    <div className="campo">
      <label>Cliente</label>
      <select
        value={elegido}
        // Una vez abierta, la venta ya lleva su cliente dentro. Cambiarlo a
        // mitad de venta pedirá su propio endpoint el día que alguien lo
        // necesite; hoy se elige antes, que es como se atiende.
        disabled={Boolean(venta)}
        onChange={(e) =>
          onAporte(e.target.value ? { cliente_id: Number(e.target.value) } : {})
        }
      >
        <option value="">Sin cliente</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre_cliente}
          </option>
        ))}
      </select>
      {venta && (
        <small className="campo-ayuda">
          Se fija al abrir la venta. Anúlala si te equivocaste de cliente.
        </small>
      )}
    </div>
  );
}
