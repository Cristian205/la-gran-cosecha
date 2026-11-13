import { useEffect, useState } from "react";
import { ArrowRight, History, TrendingDown, TrendingUp } from "lucide-react";
import { Modal } from "../../components/Modal";
import type { HistorialPrecio } from "../../types";
import { formatoFecha, formatoPrecio } from "../../utils";

interface Props {
  titulo: string;
  subtitulo?: string;
  /** De dónde sale la lista: el historial del producto o el de una presentación. */
  cargar: () => Promise<HistorialPrecio[]>;
  /** En el de una presentación sobra repetir su nombre en cada fila. */
  conPresentacion?: boolean;
  onCerrar: () => void;
}

/**
 * Historial de precios: quién cambió qué precio, de cuánto a cuánto y
 * cuándo. Sirve para un producto entero (Catálogo) o para una sola
 * presentación (Presentaciones comerciales).
 */
export function PriceHistoryModal({ titulo, subtitulo, cargar, conPresentacion = true, onCerrar }: Props) {
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    cargar()
      .then(setHistorial)
      .catch(() => setError(true))
      .finally(() => setCargando(false));
    // Se carga una vez por apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal titulo={titulo} subtitulo={subtitulo} onCerrar={onCerrar} cerrarConEscape amplio medio>
      {cargando ? (
        <div className="vacio">Cargando…</div>
      ) : error ? (
        <div className="error-box">No se pudo cargar el historial. Inténtalo de nuevo.</div>
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
                  {conPresentacion && <div className="historial-presentacion">{h.presentacion_nombre}</div>}
                  <div className="historial-precios">
                    <span className="anterior">{formatoPrecio(h.precio_anterior)}</span>
                    <ArrowRight size={13} />
                    <span className={`nuevo ${sube ? "sube" : "baja"}`}>{formatoPrecio(h.precio_nuevo)}</span>
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
