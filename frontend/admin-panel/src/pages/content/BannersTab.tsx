import { useEffect, useState } from "react";
import { eliminarBanner, obtenerBanners } from "../../api/content";
import type { PromoBanner } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { BannerFormModal } from "./BannerFormModal";

export function BannersTab() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<PromoBanner | null>(null);

  function cargar() {
    setCargando(true);
    obtenerBanners()
      .then(setBanners)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(b: PromoBanner) {
    if (!(await confirmarEliminar(`¿Eliminar el banner "${b.titulo}"?`))) return;
    try {
      await eliminarBanner(b.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el banner."));
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>Banners del carrusel ({banners.length})</h2>
        <button
          className="btn primario"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          + Nuevo banner
        </button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Título</th>
              <th>Botón</th>
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
            ) : banners.length === 0 ? (
              <tr>
                <td colSpan={6} className="vacio">
                  Sin banners todavía
                </td>
              </tr>
            ) : (
              banners.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.imagen_url ? (
                      <img
                        src={b.imagen_url}
                        alt={b.titulo}
                        style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 6 }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{b.titulo}</td>
                  <td>{b.cta_texto}</td>
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
        <BannerFormModal
          banner={editando}
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
