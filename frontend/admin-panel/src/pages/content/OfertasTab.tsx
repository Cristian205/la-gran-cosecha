import { useEffect, useState } from "react";
import { eliminarOferta, obtenerOfertas } from "../../api/content";
import type { OfertaProducto } from "../../types";
import { extraerMensajeError, formatoFecha, formatoPrecio } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";
import { OfertaFormModal } from "./OfertaFormModal";

export function OfertasTab() {
  const [ofertas, setOfertas] = useState<OfertaProducto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<OfertaProducto | null>(null);

  function cargar() {
    setCargando(true);
    obtenerOfertas()
      .then(setOfertas)
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function eliminar(o: OfertaProducto) {
    if (!(await confirmarEliminar(`¿Eliminar la oferta de "${o.producto_nombre}"?`))) return;
    try {
      await eliminarOferta(o.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar la oferta."));
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <div>
          <h2>Ofertas de la semana ({ofertas.length})</h2>
          <p style={{ color: "var(--gris)", fontSize: ".82rem", margin: ".2rem 0 0" }}>
            El precio normal y el % de ahorro se calculan siempre en vivo desde el precio actual del
            catálogo.
          </p>
        </div>
        <button
          className="btn primario"
          onClick={() => {
            setEditando(null);
            setModal(true);
          }}
        >
          + Nueva oferta
        </button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th>Precio normal</th>
              <th>Precio oferta</th>
              <th>Ahorro</th>
              <th>Termina</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={8} className="vacio">
                  Cargando…
                </td>
              </tr>
            ) : ofertas.length === 0 ? (
              <tr>
                <td colSpan={8} className="vacio">
                  Sin ofertas todavía
                </td>
              </tr>
            ) : (
              ofertas.map((o) => (
                <tr key={o.id}>
                  <td>{o.producto_nombre}</td>
                  <td>
                    {o.presentacion_detalle.nombre_presentacion} ·{" "}
                    {o.presentacion_detalle.unidad_venta_nombre}
                  </td>
                  <td style={{ textDecoration: "line-through", color: "var(--gris)" }}>
                    {formatoPrecio(o.precio_normal)}
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatoPrecio(o.precio_oferta)}</td>
                  <td>
                    <span className="badge activo">-{o.porcentaje_ahorro}%</span>
                  </td>
                  <td>{o.fecha_fin ? formatoFecha(o.fecha_fin) : "Sin fecha"}</td>
                  <td>
                    <span className={`badge ${o.activo ? "activo" : "inactivo"}`}>
                      {o.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td>
                    <div className="acciones">
                      <button
                        className="btn secundario sm"
                        onClick={() => {
                          setEditando(o);
                          setModal(true);
                        }}
                      >
                        Editar
                      </button>
                      <button className="btn peligro sm" onClick={() => eliminar(o)}>
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
        <OfertaFormModal
          oferta={editando}
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
