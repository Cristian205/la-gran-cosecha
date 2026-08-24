import { useEffect, useMemo, useState } from "react";
import { actualizarOferta, crearOferta } from "../../api/content";
import { obtenerProductos } from "../../api/resources";
import { Modal } from "../../components/Modal";
import type { OfertaProducto, Producto } from "../../types";
import { extraerMensajeError, formatoPrecio } from "../../utils";

interface Props {
  oferta: OfertaProducto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

function aInputDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OfertaFormModal({ oferta, onCerrar, onGuardado }: Props) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);

  const [productoId, setProductoId] = useState<number | "">(
    oferta?.producto_id ?? ""
  );
  const [presentacionId, setPresentacionId] = useState<number | "">(oferta?.presentacion ?? "");
  const [precioOferta, setPrecioOferta] = useState(oferta?.precio_oferta ?? "");
  const [fechaFin, setFechaFin] = useState(aInputDatetime(oferta?.fecha_fin ?? null));
  const [activo, setActivo] = useState(oferta?.activo ?? true);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerProductos({ estado: "activos" })
      .then(setProductos)
      .finally(() => setCargandoProductos(false));
  }, []);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) ?? null,
    [productos, productoId]
  );
  const presentaciones = productoSeleccionado?.presentaciones.filter((p) => p.estado_presentacion) ?? [];
  const presentacionSeleccionada = presentaciones.find((p) => p.id === presentacionId) ?? null;

  function elegirProducto(id: number | "") {
    setProductoId(id);
    const prod = productos.find((p) => p.id === id);
    const primera = prod?.presentaciones.find((p) => p.estado_presentacion);
    setPresentacionId(primera ? primera.id : "");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const precio = parseFloat(precioOferta);
    if (presentacionId === "") {
      setError("Elige un producto y una presentación.");
      return;
    }
    if (!precioOferta || Number.isNaN(precio) || precio < 0) {
      setError("El precio de oferta debe ser un número válido.");
      return;
    }
    if (presentacionSeleccionada && precio >= parseFloat(presentacionSeleccionada.precio_unitario)) {
      setError("El precio de oferta debe ser menor al precio normal para que sea un descuento real.");
      return;
    }

    const payload = {
      presentacion: Number(presentacionId),
      precio_oferta: precioOferta,
      fecha_fin: fechaFin ? new Date(fechaFin).toISOString() : null,
      activo,
    };

    setGuardando(true);
    try {
      if (oferta) {
        await actualizarOferta(oferta.id, payload);
      } else {
        await crearOferta(payload);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar la oferta."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={oferta ? "Editar oferta" : "Nueva oferta"}
      onCerrar={onCerrar}
      lateral
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}

        <div className="campo">
          <label>Producto *</label>
          <select
            value={productoId}
            onChange={(e) => elegirProducto(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={cargandoProductos}
          >
            <option value="">{cargandoProductos ? "Cargando…" : "Selecciona…"}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_producto}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label>Presentación *</label>
          <select
            value={presentacionId}
            onChange={(e) => setPresentacionId(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={!productoSeleccionado}
          >
            <option value="">Selecciona…</option>
            {presentaciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_presentacion} · {p.unidad_venta_nombre} — {formatoPrecio(p.precio_unitario)}
              </option>
            ))}
          </select>
          {presentacionSeleccionada && (
            <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: ".4rem" }}>
              Precio normal actual: <b>{formatoPrecio(presentacionSeleccionada.precio_unitario)}</b> — si
              lo cambias después en el catálogo, el % de ahorro se recalcula solo.
            </p>
          )}
        </div>

        <div className="fila">
          <div className="campo">
            <label>Precio de oferta *</label>
            <input
              type="number"
              min="0"
              value={precioOferta}
              onChange={(e) => setPrecioOferta(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="campo">
            <label>Termina el (opcional)</label>
            <input
              type="datetime-local"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
        </div>
        <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: "-.6rem" }}>
          Si defines una fecha de fin, el Home muestra un contador regresivo. Si la dejas vacía, la
          oferta se mantiene activa hasta que la desactives aquí.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: ".6rem" }}>
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            style={{ width: "auto" }}
          />
          Activa
        </label>
      </form>
    </Modal>
  );
}
