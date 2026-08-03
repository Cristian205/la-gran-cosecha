import { useEffect, useState } from "react";
import { eliminarTrustBadge, obtenerTrustBadges } from "../../api/content";
import type { TrustBadge } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { TrustBadgeFormModal } from "./TrustBadgeFormModal";

export function TrustBadgesTab() {
  const [badges, setBadges] = useState<TrustBadge[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<TrustBadge | null>(null);

  function cargar() {
    setCargando(true);
    obtenerTrustBadges()
      .then(setBadges)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(b: TrustBadge) {
    if (!(await confirmarEliminar(`¿Eliminar el sello "${b.etiqueta}"?`))) return;
    try {
      await eliminarTrustBadge(b.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el sello."));
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>Sellos de confianza ({badges.length})</h2>
        <button
          className="btn primario"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          + Nuevo sello
        </button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Ícono</th>
              <th>Valor</th>
              <th>Etiqueta</th>
              <th>Orden</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : badges.length === 0 ? (
              <tr>
                <td colSpan={6} className="vacio">
                  Sin sellos todavía
                </td>
              </tr>
            ) : (
              badges.map((b) => (
                <tr key={b.id}>
                  <td>{b.icono}</td>
                  <td>{b.valor}</td>
                  <td>{b.etiqueta}</td>
                  <td>{b.orden}</td>
                  <td>
                    <span className={`badge ${b.activo ? "activo" : "inactivo"}`}>
                      {b.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="acciones">
                      <button
                        className="btn secundario sm"
                        onClick={() => {
                          setEditando(b);
                          setModal(true);
                        }}
                      >
                        Editar
                      </button>
                      <button className="btn peligro sm" onClick={() => eliminar(b)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <TrustBadgeFormModal
          badge={editando}
          onCerrar={() => setModal(false)}
          onGuardado={() => {
            setModal(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}
