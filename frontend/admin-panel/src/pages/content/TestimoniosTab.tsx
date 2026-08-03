import { useEffect, useState } from "react";
import { eliminarTestimonio, obtenerTestimonios } from "../../api/content";
import type { Testimonio } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { TestimonioFormModal } from "./TestimonioFormModal";

export function TestimoniosTab() {
  const [testimonios, setTestimonios] = useState<Testimonio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Testimonio | null>(null);

  function cargar() {
    setCargando(true);
    obtenerTestimonios()
      .then(setTestimonios)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(t: Testimonio) {
    if (!(await confirmarEliminar(`¿Eliminar el testimonio de "${t.nombre}"?`))) return;
    try {
      await eliminarTestimonio(t.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el testimonio."));
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>Testimonios ({testimonios.length})</h2>
        <button
          className="btn primario"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          + Nuevo testimonio
        </button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estrellas</th>
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
            ) : testimonios.length === 0 ? (
              <tr>
                <td colSpan={6} className="vacio">
                  Sin testimonios todavía
                </td>
              </tr>
            ) : (
              testimonios.map((t) => (
                <tr key={t.id}>
                  <td>{t.nombre}</td>
                  <td>{t.rol}</td>
                  <td>{"★".repeat(t.estrellas)}</td>
                  <td>{t.orden}</td>
                  <td>
                    <span className={`badge ${t.activo ? "activo" : "inactivo"}`}>
                      {t.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="acciones">
                      <button
                        className="btn secundario sm"
                        onClick={() => {
                          setEditando(t);
                          setModal(true);
                        }}
                      >
                        Editar
                      </button>
                      <button className="btn peligro sm" onClick={() => eliminar(t)}>
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
        <TestimonioFormModal
          testimonio={editando}
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
