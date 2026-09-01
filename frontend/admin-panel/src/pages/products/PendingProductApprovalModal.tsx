import { useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import { aprobarProductoPendiente, type ProductoPayload } from "../../api/resources";
import type { Categoria, ProductoPendiente, UnidadMedida } from "../../types";
import { extraerMensajeError } from "../../utils";

interface PresRow {
  nombre_presentacion: string;
  unidad_venta: number | "";
  factor_conversion: string;
  precio_unitario: string;
}

interface Props {
  pendiente: ProductoPendiente;
  categorias: Categoria[];
  unidades: UnidadMedida[];
  onCerrar: () => void;
  onAprobado: () => void;
}

export function PendingProductApprovalModal({
  pendiente,
  categorias,
  unidades,
  onCerrar,
  onAprobado,
}: Props) {
  const [nombre, setNombre] = useState(pendiente.nombre_personalizado);
  const [categoria, setCategoria] = useState<number | "">(pendiente.categoria_id ?? "");
  const [unidadBase, setUnidadBase] = useState<number | "">(pendiente.unidad_id ?? "");
  const [tipoCantidad, setTipoCantidad] = useState("entero");
  const [permiteFraccion, setPermiteFraccion] = useState(false);
  const [presentaciones, setPresentaciones] = useState<PresRow[]>([
    {
      nombre_presentacion: "",
      unidad_venta: pendiente.unidad_id ?? "",
      factor_conversion: "1",
      precio_unitario: pendiente.precio_unitario || "0",
    },
  ]);
  const [presentacionDelPedido, setPresentacionDelPedido] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cambiarPres(i: number, campo: keyof PresRow, valor: string) {
    setPresentaciones((prev) =>
      prev.map((p, idx) =>
        idx === i
          ? { ...p, [campo]: campo === "unidad_venta" ? Number(valor) : valor }
          : p
      )
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || categoria === "") {
      setError("El nombre y la categoría son obligatorios.");
      return;
    }

    const presValidas = presentaciones.filter(
      (p) => p.nombre_presentacion.trim() && p.unidad_venta !== ""
    );
    if (presValidas.length === 0) {
      setError("Agrega al menos una presentación con nombre, unidad y precio.");
      return;
    }

    // Si hay más de una presentación, el admin debe marcar cuál es la que pidió
    // este cliente, para que la línea del pedido quede enlazada a la correcta
    // (con una sola no hay ambigüedad y se enlaza sola en el backend).
    let indicePresentacionPedido: number | undefined;
    if (presValidas.length > 1) {
      indicePresentacionPedido = presValidas.indexOf(presentaciones[presentacionDelPedido]);
      if (indicePresentacionPedido === -1) {
        setError("Marca cuál presentación corresponde al pedido de este cliente.");
        return;
      }
    }

    const payload: ProductoPayload = {
      nombre_producto: nombre.trim(),
      categoria: Number(categoria),
      unidad_base: unidadBase === "" ? null : Number(unidadBase),
      tipo_cantidad: tipoCantidad,
      permite_fraccion: permiteFraccion,
      // Nace sin control de existencias: nadie ha contado todavia cuantas
      // hay de un producto que acaba de existir.
      controla_stock: false,
      codigo_barras: "",
      estado_producto: true,
      presentaciones: presValidas.map((p) => ({
        nombre_presentacion: p.nombre_presentacion.trim(),
        unidad_venta: Number(p.unidad_venta),
        factor_conversion: p.factor_conversion || "1",
        precio_unitario: p.precio_unitario || "0",
      })),
    };

    setGuardando(true);
    try {
      await aprobarProductoPendiente(pendiente.id, payload, indicePresentacionPedido);
      onAprobado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el producto."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      lateral
      titulo="Aceptar producto personalizado"
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar en catálogo"}
          </button>
        </>
      }
    >
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}

        <p style={{ color: "var(--gris)", marginTop: 0 }}>
          El cliente escribió <strong>"{pendiente.nombre_personalizado}"</strong> ({pendiente.cantidad}{" "}
          {pendiente.unidad_nombre || "unid."}) en el pedido #{pendiente.pedido}. Completa los
          datos para que quede disponible en el catálogo.
        </p>

        <div className="campo">
          <label>Nombre del producto *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="fila">
          <div className="campo">
            <label>Categoría *</label>
            <select
              value={categoria}
              onChange={(e) =>
                setCategoria(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Selecciona…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Unidad base</label>
            <select
              value={unidadBase}
              onChange={(e) =>
                setUnidadBase(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">—</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_unidad}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fila">
          <div className="campo">
            <label>Tipo de cantidad</label>
            <select value={tipoCantidad} onChange={(e) => setTipoCantidad(e.target.value)}>
              <option value="entero">Entero</option>
              <option value="medio">Medio</option>
              <option value="cuarto">Cuartos</option>
            </select>
          </div>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", marginTop: "1.6rem" }}>
            <input
              type="checkbox"
              checked={permiteFraccion}
              onChange={(e) => setPermiteFraccion(e.target.checked)}
              style={{ width: "auto" }}
            />
            Permite fracción
          </label>
        </div>

        <div className="modal-seccion">
          <Layers size={16} />
          <span>Presentaciones</span>
        </div>
        {presentaciones.length > 1 && (
          <p style={{ color: "var(--gris)", fontSize: ".82rem", marginTop: 0 }}>
            Marca con el punto cuál presentación es la que pidió este cliente, para dejar su
            pedido enlazado a esa presentación del catálogo.
          </p>
        )}
        {presentaciones.map((p, i) => (
          <div className="pres-row" key={i}>
            {presentaciones.length > 1 && (
              <Tooltip label="Esta es la que pidió el cliente">
                <input
                  type="radio"
                  name="presentacion-del-pedido"
                  checked={presentacionDelPedido === i}
                  onChange={() => setPresentacionDelPedido(i)}
                  style={{ width: "auto", marginBottom: ".1rem" }}
                  aria-label={`Usar la presentación ${i + 1} para este pedido`}
                />
              </Tooltip>
            )}
            <span className="pres-row-indice">{i + 1}</span>
            <div className="pres-row-campo" style={{ flex: 2 }}>
              <span>Nombre</span>
              <input
                placeholder="Ej: Bulto"
                value={p.nombre_presentacion}
                onChange={(e) => cambiarPres(i, "nombre_presentacion", e.target.value)}
              />
            </div>
            <div className="pres-row-campo">
              <span>Unidad</span>
              <select
                value={p.unidad_venta}
                onChange={(e) => cambiarPres(i, "unidad_venta", e.target.value)}
              >
                <option value="">Unidad</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.abreviatura_unidad}
                  </option>
                ))}
              </select>
            </div>
            <div className="pres-row-campo" style={{ flex: .7 }}>
              <span>Factor</span>
              <input
                type="number"
                step="0.001"
                placeholder="1"
                value={p.factor_conversion}
                onChange={(e) => cambiarPres(i, "factor_conversion", e.target.value)}
              />
            </div>
            <div className="pres-row-campo" style={{ flex: .8 }}>
              <span>Precio</span>
              <input
                type="number"
                placeholder="0"
                value={p.precio_unitario}
                onChange={(e) => cambiarPres(i, "precio_unitario", e.target.value)}
              />
            </div>
            {presentaciones.length > 1 && (
              <Tooltip label="Quitar presentación">
                <button
                  type="button"
                  className="btn-icon peligro"
                  onClick={() => {
                    setPresentaciones((prev) => prev.filter((_, idx) => idx !== i));
                    setPresentacionDelPedido((actual) =>
                      actual === i ? 0 : actual > i ? actual - 1 : actual
                    );
                  }}
                  aria-label="Quitar presentación"
                >
                  <Trash2 size={15} />
                </button>
              </Tooltip>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn secundario sm"
          onClick={() =>
            setPresentaciones((prev) => [
              ...prev,
              { nombre_presentacion: "", unidad_venta: "", factor_conversion: "1", precio_unitario: "0" },
            ])
          }
          style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}
        >
          <Plus size={14} /> Agregar presentación
        </button>
      </form>
    </Modal>
  );
}
