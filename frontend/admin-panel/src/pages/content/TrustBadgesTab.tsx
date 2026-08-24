import { useEffect, useState } from "react";
import { eliminarTrustBadge, obtenerTrustBadges } from "../../api/content";
import type { TrustBadge } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { TrustBadgeFormModal } from "./TrustBadgeFormModal";

interface GrupoProps {
  titulo: string;
  ayuda: string;
  tipo: TrustBadge["tipo"];
  items: TrustBadge[];
  cargando: boolean;
  onNuevo: () => void;
  onEditar: (b: TrustBadge) => void;
  onEliminar: (b: TrustBadge) => void;
}

function GrupoTrustBadges({
  titulo,
  ayuda,
  items,
  cargando,
  onNuevo,
  onEditar,
  onEliminar,
}: GrupoProps) {
  return (
    <div className="panel">
      <div className="cabecera">
        <div>
          <h2>{titulo} ({items.length})</h2>
          <p style={{ color: "var(--gris)", fontSize: ".82rem", margin: ".2rem 0 0" }}>{ayuda}</p>
        </div>
        <button className="btn primario" onClick={onNuevo}>
          + Nuevo
        </button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
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
                <td colSpan={5} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="vacio">
                  Nada todavía
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr key={b.id}>
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
                      <button className="btn secundario sm" onClick={() => onEditar(b)}>
                        Editar
                      </button>
                      <button className="btn peligro sm" onClick={() => onEliminar(b)}>
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
    </div>
  );
}

export function TrustBadgesTab() {
  const [badges, setBadges] = useState<TrustBadge[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<TrustBadge | null>(null);
  const [tipoNuevo, setTipoNuevo] = useState<TrustBadge["tipo"]>("insignia");

  function cargar() {
    setCargando(true);
    obtenerTrustBadges()
      .then(setBadges)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(b: TrustBadge) {
    if (!(await confirmarEliminar(`¿Eliminar "${b.etiqueta}"?`))) return;
    try {
      await eliminarTrustBadge(b.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar."));
    }
  }

  function abrirNuevo(tipo: TrustBadge["tipo"]) {
    setTipoNuevo(tipo);
    setEditando(null);
    setModal(true);
  }

  function abrirEdicion(b: TrustBadge) {
    setTipoNuevo(b.tipo);
    setEditando(b);
    setModal(true);
  }

  return (
    <>
      <GrupoTrustBadges
        titulo="Barra de confianza"
        ayuda="Insignias cortas debajo del hero (ej: Entrega 24-48h, Factura electrónica)."
        tipo="insignia"
        items={badges.filter((b) => b.tipo === "insignia")}
        cargando={cargando}
        onNuevo={() => abrirNuevo("insignia")}
        onEditar={abrirEdicion}
        onEliminar={eliminar}
      />
      <GrupoTrustBadges
        titulo="Estadísticas de confianza"
        ayuda="Números grandes de prueba social (ej: +350 productos, 98% a tiempo). No inventes cifras: usa datos reales del negocio."
        tipo="estadistica"
        items={badges.filter((b) => b.tipo === "estadistica")}
        cargando={cargando}
        onNuevo={() => abrirNuevo("estadistica")}
        onEditar={abrirEdicion}
        onEliminar={eliminar}
      />

      {modal && (
        <TrustBadgeFormModal
          badge={editando}
          tipoInicial={tipoNuevo}
          onCerrar={() => setModal(false)}
          onGuardado={() => {
            setModal(false);
            cargar();
          }}
        />
      )}
    </>
  );
}
