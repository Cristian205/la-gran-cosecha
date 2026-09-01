import { useMemo, useState } from "react";
import { AlertTriangle, Check, Layers, Plus, Sparkles, Trash2 } from "lucide-react";
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
import { extraerMensajeError, formatoPrecio } from "../../utils";

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
  precio_unitario: "",
};

type ModoVenta = "entero" | "medio" | "cuarto";

const OPCIONES_MODO_VENTA: {
  valor: ModoVenta;
  titulo: string;
  ejemplo: string;
  descripcion: string;
}[] = [
  {
    valor: "entero",
    titulo: "Unidades completas",
    ejemplo: "1, 2, 3…",
    descripcion: "El cliente solo pide cantidades completas.",
  },
  {
    valor: "medio",
    titulo: "Medias unidades",
    ejemplo: "1, 1½, 2…",
    descripcion: "El cliente también puede pedir mitades.",
  },
  {
    valor: "cuarto",
    titulo: "Cuartos de unidad",
    ejemplo: "1, 1¼, 1½…",
    descripcion: "El cliente también puede pedir cuartos.",
  },
];

/** Normaliza datos existentes: si tipo_cantidad es "entero", el producto se
 * comporta igual que "sin fracción" sin importar permite_fraccion, así que
 * no vale la pena distinguirlos en la pantalla. */
function modoVentaDesdeProducto(producto: Producto | null): ModoVenta {
  if (!producto) return "entero";
  return producto.tipo_cantidad === "medio" || producto.tipo_cantidad === "cuarto"
    ? producto.tipo_cantidad
    : "entero";
}

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
  const [modoVenta, setModoVenta] = useState<ModoVenta>(
    modoVentaDesdeProducto(producto)
  );
  const [estado, setEstado] = useState(producto?.estado_producto ?? true);
  const [controlaStock, setControlaStock] = useState(producto?.controla_stock ?? false);
  const [codigoBarras, setCodigoBarras] = useState(producto?.codigo_barras ?? "");
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
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const unidadesPorId = useMemo(
    () => new Map(unidades.map((u) => [u.id, u])),
    [unidades]
  );

  const precioDesdeVistaPrevia = useMemo(() => {
    const precios = presentaciones
      .filter((p) => p.nombre_presentacion.trim() && p.unidad_venta !== "")
      .map((p) => parseFloat(p.precio_unitario))
      .filter((n) => Number.isFinite(n) && n > 0);
    return precios.length > 0 ? formatoPrecio(Math.min(...precios)) : null;
  }, [presentaciones]);

  function cambiarPres(i: number, campo: keyof PresRow, valor: string) {
    setPresentaciones((prev) =>
      prev.map((p, idx) =>
        idx === i
          ? { ...p, [campo]: campo === "unidad_venta" ? Number(valor) : valor }
          : p
      )
    );
  }

  function filaIncompleta(p: PresRow): boolean {
    const tieneAlgo =
      p.nombre_presentacion.trim() !== "" ||
      p.unidad_venta !== "" ||
      (parseFloat(p.precio_unitario) || 0) > 0;
    const completa = p.nombre_presentacion.trim() !== "" && p.unidad_venta !== "";
    return tieneAlgo && !completa;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIntentoGuardar(true);

    if (!nombre.trim() || categoria === "") {
      setError("Falta el nombre o la categoría del producto.");
      return;
    }

    const presValidas = presentaciones.filter(
      (p) => p.nombre_presentacion.trim() && p.unidad_venta !== ""
    );

    if (presValidas.length === 0) {
      setError("Agrega al menos una presentación completa (nombre y unidad) para poder guardar.");
      return;
    }

    const payload: ProductoPayload = {
      nombre_producto: nombre.trim(),
      categoria: Number(categoria),
      unidad_base: unidadBase === "" ? null : Number(unidadBase),
      tipo_cantidad: modoVenta,
      permite_fraccion: modoVenta !== "entero",
      estado_producto: estado,
      controla_stock: controlaStock,
      codigo_barras: codigoBarras.trim(),
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
            {guardando ? "Guardando…" : "Guardar producto"}
          </button>
        </>
      }
    >
      <form onSubmit={guardar}>
        {error && (
          <div className="error-box">
            <AlertTriangle size={15} style={{ marginRight: ".4rem", verticalAlign: "-2px" }} />
            {error}
          </div>
        )}

        <p className="form-nota">Los campos marcados con * son obligatorios.</p>

        <div className="producto-hero">
          <MediaField
            valor={imagen}
            urlActual={producto?.imagen_url ?? null}
            onCambiar={setImagen}
            accept="image/png,image/jpeg,image/webp"
            ayuda="Una foto clara ayuda a vender más. Se recomienda una imagen cuadrada."
          />
        </div>

        <div className="campo">
          <label>Nombre del producto *</label>
          <input
            autoFocus
            placeholder="Ej: Papa Sabanera"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={intentoGuardar && !nombre.trim() ? "campo-invalido" : ""}
          />
        </div>

        <div className="fila">
          <div className="campo">
            <label>Categoría *</label>
            <select
              value={categoria}
              onChange={(e) =>
                setCategoria(e.target.value === "" ? "" : Number(e.target.value))
              }
              className={intentoGuardar && categoria === "" ? "campo-invalido" : ""}
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
            <label>Unidad de referencia</label>
            <select
              value={unidadBase}
              onChange={(e) =>
                setUnidadBase(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Sin definir</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_unidad}
                </option>
              ))}
            </select>
            <p className="campo-ayuda">
              Opcional, solo para tu referencia. No cambia precios ni pedidos.
            </p>
          </div>
        </div>

        <div className="modal-seccion">
          <Sparkles size={16} />
          <span>¿Cómo se vende este producto?</span>
        </div>
        <div className="opciones-venta">
          {OPCIONES_MODO_VENTA.map((o) => (
            <button
              type="button"
              key={o.valor}
              className={`opcion-venta ${modoVenta === o.valor ? "activa" : ""}`}
              onClick={() => setModoVenta(o.valor)}
            >
              <span className="opcion-venta-check">
                {modoVenta === o.valor && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="opcion-venta-titulo">{o.titulo}</span>
              <span className="opcion-venta-ejemplo">{o.ejemplo}</span>
              <span className="opcion-venta-desc">{o.descripcion}</span>
            </button>
          ))}
        </div>

        <div className="campo-switch">
          <label className="switch">
            <input
              type="checkbox"
              checked={estado}
              onChange={(e) => setEstado(e.target.checked)}
            />
            <span className="switch-riel" />
          </label>
          <div>
            <div className="campo-switch-titulo">
              {estado ? "Visible para tus clientes" : "Oculto de la tienda"}
            </div>
            <div className="campo-switch-desc">
              {estado
                ? "El producto aparece en el catálogo y se puede pedir."
                : "El producto queda guardado pero no se muestra ni se puede pedir."}
            </div>
          </div>
        </div>

        <div className="campo-switch">
          <label className="switch">
            <input
              type="checkbox"
              checked={controlaStock}
              onChange={(e) => setControlaStock(e.target.checked)}
            />
            <span className="switch-riel" />
          </label>
          <div>
            <div className="campo-switch-titulo">
              {controlaStock ? "Lleva cuenta de existencias" : "Sin control de existencias"}
            </div>
            <div className="campo-switch-desc">
              {controlaStock
                ? "Los pedidos apartan unidades y no se puede vender mas de lo que hay. Registra la entrada inicial en Inventario."
                : "Se puede pedir sin limite. Enciendelo cuando hayas contado lo que tienes."}
            </div>
          </div>
        </div>

        <div className="campo">
          <label>Codigo de barras</label>
          <input
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            placeholder="7701234567890"
          />
          <span className="campo-ayuda">
            Opcional. Identifica el articulo para el lector del punto de venta.
          </span>
        </div>

        <div className="modal-seccion">
          <Layers size={16} />
          <span>Presentaciones *</span>
          {precioDesdeVistaPrevia && (
            <span className="precio-vista-previa">Desde {precioDesdeVistaPrevia}</span>
          )}
        </div>
        <p className="form-nota" style={{ marginTop: "-.4rem" }}>
          Son las formas en que se puede comprar (ej: por Bulto, por Libra, por Unidad).
        </p>

        {presentaciones.map((p, i) => {
          const unidad = p.unidad_venta !== "" ? unidadesPorId.get(Number(p.unidad_venta)) : undefined;
          const factor = parseFloat(p.factor_conversion);
          const mostrarEquivalencia =
            unidad && Number.isFinite(factor) && factor > 0 && factor !== 1;
          const incompleta = intentoGuardar && filaIncompleta(p);

          return (
            <div className={`pres-row ${incompleta ? "pres-row-incompleta" : ""}`} key={i}>
              <span className="pres-row-indice">{i + 1}</span>
              <div className="pres-row-linea pres-row-linea-principal">
                <div className="pres-row-campo" style={{ flex: 2 }}>
                  <span>Nombre de la presentación</span>
                  <input
                    placeholder="Ej: Bulto, Libra, Unidad…"
                    value={p.nombre_presentacion}
                    onChange={(e) => cambiarPres(i, "nombre_presentacion", e.target.value)}
                  />
                </div>
                <div className="pres-row-campo">
                  <span>Se vende en</span>
                  <select
                    value={p.unidad_venta}
                    onChange={(e) => cambiarPres(i, "unidad_venta", e.target.value)}
                  >
                    <option value="">Elegir…</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre_unidad}
                      </option>
                    ))}
                  </select>
                </div>
                <Tooltip label="Quitar presentación">
                  <button
                    type="button"
                    className="btn-icon peligro pres-row-quitar"
                    onClick={() =>
                      setPresentaciones((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    aria-label="Quitar presentación"
                  >
                    <Trash2 size={15} />
                  </button>
                </Tooltip>
              </div>

              <div className="pres-row-linea pres-row-linea-precios">
                <div className="pres-row-campo" style={{ flex: 1.2 }}>
                  <span>Precio de venta</span>
                  <div className="input-precio">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={p.precio_unitario}
                      onChange={(e) => cambiarPres(i, "precio_unitario", e.target.value)}
                    />
                  </div>
                  {parseFloat(p.precio_unitario) > 0 && (
                    <span className="pres-row-preview">{formatoPrecio(p.precio_unitario)}</span>
                  )}
                </div>
                <div className="pres-row-campo">
                  <span>Equivale a (opcional)</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="1"
                    value={p.factor_conversion}
                    onChange={(e) => cambiarPres(i, "factor_conversion", e.target.value)}
                  />
                  {mostrarEquivalencia && (
                    <span className="pres-row-preview">
                      1 {p.nombre_presentacion || "unidad"} = {p.factor_conversion} {unidad!.nombre_unidad}
                    </span>
                  )}
                </div>
              </div>

              {incompleta && (
                <div className="pres-row-alerta">
                  <AlertTriangle size={13} /> Falta el nombre o la unidad: esta presentación no se guardará.
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="btn secundario sm"
          onClick={() => setPresentaciones((prev) => [...prev, { ...filaVacia }])}
          style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}
        >
          <Plus size={14} /> Agregar otra presentación
        </button>
      </form>
    </Modal>
  );
}
