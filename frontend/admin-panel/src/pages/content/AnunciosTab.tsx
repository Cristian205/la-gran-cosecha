import { useEffect, useState } from "react";
import { eliminarAnuncio, obtenerAnuncios } from "../../api/content";
import type { Anuncio } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { AnuncioFormModal } from "./AnuncioFormModal";

/**
 * El carrusel de anuncios del cuerpo del Home — no el de cabecera, que es
 * "Banners". Misma mecánica de pestaña que `BannersTab`, tabla aparte: ver
 * el docstring de `content.Anuncio` para el porqué de separarlas.
 */
export function AnunciosTab() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Anuncio | null>(null);

  function cargar() {
    setCargando(true);
    obtenerAnuncios()
      .then(setAnuncios)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(a: Anuncio) {
    if (!(await confirmarEliminar(`¿Eliminar el anuncio "${a.titulo}"?`))) return;
    try {
      await eliminarAnuncio(a.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el anuncio."));
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>Anuncios del Home ({anuncios.length})</h2>
        <button
          className="btn primario"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          + Nuevo anuncio
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
            ) : anuncios.length === 0 ? (
              <tr>
                <td colSpan={6} className="vacio">
                  Sin anuncios todavía
                </td>
              </tr>
            ) : (
              anuncios.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.imagen_url ? (
                      <img
                        src={a.imagen_url}
                        alt={a.titulo}
                        style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 6 }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{a.titulo}</td>
                  <td>{a.cta_texto}</td>
                  <td>{a.orden}</td>
                  <td>
                    <span className={`badge ${a.activo ? "activo" : "inactivo"}`}>
                      {a.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="acciones">
                      <button
                        className="btn secundario sm"
                        onClick={() => {
                          setEditando(a);
                          setModal(true);
                        }}
                      >
                        Editar
                      </button>
                      <button className="btn peligro sm" onClick={() => eliminar(a)}>
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
        <AnuncioFormModal
          anuncio={editando}
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
