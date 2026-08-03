import { useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import {
  actualizarProducto,
  crearProducto,
  subirImagenProducto,
  type ProductoPayload,
} from "../../api/resources";
import type { Categoria, Producto, UnidadMedida } from "../../types";
import { extraerMensajeError } from "../../utils";

interface PresRow {
  id?: number | null;
  nombre_presentacion: string;
  unidad_venta: number | "";
  factor_conversion: string;
  precio_unitario: string;
}

interface Props {
  producto: Producto | null;
  categorias: Categoria[];
  unidades: UnidadMedida[];
  onCerrar: () => void;
  onGuardado: () => void;
}

const filaVacia: PresRow = {
  nombre_presentacion: "",
  unidad_venta: "",
  factor_conversion: "1",
  precio_unitario: "0",
};

export function ProductFormModal({
  producto,
  categorias,
  unidades,
  onCerrar,
  onGuardado,
}: Props) {
  const esEdicion = producto !== null;

  const [nombre, setNombre] = useState(producto?.nombre_producto ?? "");
  const [categoria, setCategoria] = useState<number | "">(
    producto?.categoria ?? ""
  );
  const [unidadBase, setUnidadBase] = useState<number | "">(
    producto?.unidad_base ?? ""
  );
  const [tipoCantidad, setTipoCantidad] = useState(
    producto?.tipo_cantidad ?? "entero"
  );
  const [permiteFraccion, setPermiteFraccion] = useState(
    producto?.permite_fraccion ?? false
  );
  const [estado, setEstado] = useState(producto?.estado_producto ?? true);
  const [imagen, setImagen] = useState<File | null>(null);

  const [presentaciones, setPresentaciones] = useState<PresRow[]>(
    producto && producto.presentaciones.length > 0
      ? producto.presentaciones
          .filter((p) => p.estado_presentacion)
          .map((p) => ({
            id: p.id,
            nombre_presentacion: p.nombre_presentacion,
            unidad_venta: p.unidad_venta,
            factor_conversion: p.factor_conversion,
            precio_unitario: p.precio_unitario,
          }))
      : [{ ...filaVacia }]
  );

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

    const payload: ProductoPayload = {
      nombre_producto: nombre.trim(),
      categoria: Number(categoria),
      unidad_base: unidadBase === "" ? null : Number(unidadBase),
      tipo_cantidad: tipoCantidad,
      permite_fraccion: permiteFraccion,
      estado_producto: estado,
      presentaciones: presValidas.map((p) => ({
        id: p.id ?? null,
        nombre_presentacion: p.nombre_presentacion.trim(),
        unidad_venta: Number(p.unidad_venta),
        factor_conversion: p.factor_conversion || "1",
        precio_unitario: p.precio_unitario || "0",
      })),
    };

    setGuardando(true);
    try {
      const prod = esEdicion
        ? await actualizarProducto(producto!.id, payload)
        : await crearProducto(payload);
      if (imagen) {
        await subirImagenProducto(prod.id, imagen);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el producto."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      lateral
      titulo={esEdicion ? "Editar producto" : "Nuevo producto"}
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn primario"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}

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
            <select
              value={tipoCantidad}
              onChange={(e) => setTipoCantidad(e.target.value)}
            >
              <option value="entero">Entero</option>
              <option value="medio">Medio</option>
              <option value="cuarto">Cuartos</option>
            </select>
          </div>
          <div className="campo">
            <label>Imagen</label>
            <MediaField
              valor={imagen}
              urlActual={producto?.imagen_url ?? null}
              onCambiar={setImagen}
              accept="image/png,image/jpeg,image/webp"
            />
          </div>
        </div>

        <div className="fila">
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={permiteFraccion}
              onChange={(e) => setPermiteFraccion(e.target.checked)}
              style={{ width: "auto" }}
            />
            Permite fracción
          </label>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={estado}
              onChange={(e) => setEstado(e.target.checked)}
              style={{ width: "auto" }}
            />
            Producto activo
          </label>
        </div>

        <div className="modal-seccion">
          <Layers size={16} />
          <span>Presentaciones</span>
        </div>
        {presentaciones.map((p, i) => (
          <div className="pres-row" key={i}>
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
            <Tooltip label="Quitar presentación">
              <button
                type="button"
                className="btn-icon peligro"
                onClick={() =>
                  setPresentaciones((prev) => prev.filter((_, idx) => idx !== i))
                }
                aria-label="Quitar presentación"
              >
                <Trash2 size={15} />
              </button>
            </Tooltip>
          </div>
        ))}
        <button
          type="button"
          className="btn secundario sm"
          onClick={() => setPresentaciones((prev) => [...prev, { ...filaVacia }])}
          style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}
        >
          <Plus size={14} /> Agregar presentación
        </button>
      </form>
    </Modal>
  );
}
