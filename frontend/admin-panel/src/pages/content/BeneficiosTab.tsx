import { useEffect, useState } from "react";
import { eliminarBeneficio, obtenerBeneficios } from "../../api/content";
import type { BeneficioComercial } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { BeneficioFormModal } from "./BeneficioFormModal";

export function BeneficiosTab() {
  const [beneficios, setBeneficios] = useState<BeneficioComercial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<BeneficioComercial | null>(null);

  function cargar() {
    setCargando(true);
    obtenerBeneficios()
      .then(setBeneficios)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(b: BeneficioComercial) {
    if (!(await confirmarEliminar(`¿Eliminar el beneficio "${b.titulo}"?`))) return;
    try {
      await eliminarBeneficio(b.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el beneficio."));
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <div>
          <h2>¿Por qué comprar con nosotros? ({beneficios.length})</h2>
          <p style={{ color: "var(--gris)", fontSize: ".82rem", margin: ".2rem 0 0" }}>
            Bloque de Inicio con las razones comerciales para elegirte a ti sobre otro proveedor.
          </p>
        </div>
        <button
          className="btn primario"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          + Nuevo beneficio
        </button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Ícono</th>
              <th>Título</th>
              <th>Texto</th>
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
            ) : beneficios.length === 0 ? (
              <tr>
                <td colSpan={6} className="vacio">
                  Sin beneficios todavía
                </td>
              </tr>
            ) : (
              beneficios.map((b) => (
                <tr key={b.id}>
                  <td>{b.icono}</td>
                  <td>{b.titulo}</td>
                  <td>{b.texto}</td>
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
        <BeneficioFormModal
          beneficio={editando}
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
