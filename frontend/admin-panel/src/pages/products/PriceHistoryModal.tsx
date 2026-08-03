import { useEffect, useState } from "react";
import { ArrowRight, History, TrendingDown, TrendingUp } from "lucide-react";
import { Modal } from "../../components/Modal";
import { obtenerHistorialPrecios } from "../../api/resources";
import type { HistorialPrecio, Producto } from "../../types";
import { formatoFecha, formatoPrecio } from "../../utils";

interface Props {
  producto: Producto;
  onCerrar: () => void;
}

export function PriceHistoryModal({ producto, onCerrar }: Props) {
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorialPrecios(producto.id)
      .then(setHistorial)
      .finally(() => setCargando(false));
  }, [producto.id]);

  return (
    <Modal
      titulo={`Historial de precios · ${producto.nombre_producto}`}
      onCerrar={onCerrar}
    >
      {cargando ? (
        <div className="vacio">Cargando…</div>
      ) : historial.length === 0 ? (
        <div className="vacio">
          <History size={30} style={{ opacity: 0.5, marginBottom: ".5rem" }} />
          <div>Aún no se han registrado cambios de precio.</div>
        </div>
      ) : (
        <div className="historial-lista">
          {historial.map((h) => {
            const sube = parseFloat(h.precio_nuevo) > parseFloat(h.precio_anterior);
            return (
              <div className="historial-item" key={h.id}>
                <span className={`historial-icono ${sube ? "sube" : "baja"}`}>
                  {sube ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </span>
                <div className="historial-detalle">
                  <div className="historial-presentacion">
                    {h.presentacion_nombre}
                  </div>
                  <div className="historial-precios">
                    <span className="anterior">
                      {formatoPrecio(h.precio_anterior)}
                    </span>
                    <ArrowRight size={13} />
                    <span className={`nuevo ${sube ? "sube" : "baja"}`}>
                      {formatoPrecio(h.precio_nuevo)}
                    </span>
                  </div>
                  <div className="historial-meta">
                    {formatoFecha(h.fecha_cambio)} · {h.usuario_nombre} - {h.usuario_rol}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
