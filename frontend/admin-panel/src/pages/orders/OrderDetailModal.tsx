import { useEffect, useMemo, useRef, useState } from "react";
import { History, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  descargarPdfPedido,
  editarPedido,
  obtenerCategorias,
  obtenerHistorialPedido,
  obtenerPedido,
  obtenerProductos,
  obtenerUnidades,
} from "../../api/resources";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import type {
  Categoria,
  DetallePedido,
  HistorialDetallePedido,
  PedidoDetalle,
  Producto,
  UnidadMedida,
} from "../../types";
import { extraerMensajeError, formatoFecha, formatoPrecio } from "../../utils";

function formatoValorHistorial(campo: string, valor: string): string {
  return campo === "precio_unitario" ? formatoPrecio(valor) : valor;
}

interface FilaDetalle extends DetallePedido {
  categoria_id: number | null;
}

interface Props {
  pedidoId: number;
  soloLectura?: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function OrderDetailModal({
  pedidoId,
  soloLectura = false,
  onCerrar,
  onGuardado,
}: Props) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [detalles, setDetalles] = useState<FilaDetalle[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialDetallePedido[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const nextTempId = useRef(0);

  const [modoAgregar, setModoAgregar] = useState<"catalogo" | "personalizado">("catalogo");
  const [nuevoProductoId, setNuevoProductoId] = useState<number | "">("");
  const [nuevaPresentacionId, setNuevaPresentacionId] = useState<number | "">("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCategoriaId, setNuevaCategoriaId] = useState<number | "">("");
  const [nuevaUnidadId, setNuevaUnidadId] = useState<number | "">("");
  const [nuevaCantidad, setNuevaCantidad] = useState("1");
  const [nuevoPrecio, setNuevoPrecio] = useState("0");
  const [errorAgregar, setErrorAgregar] = useState<string | null>(null);

  useEffect(() => {
    obtenerPedido(pedidoId)
      .then((p) => {
        setPedido(p);
        setDetalles(p.detalles.map((d) => ({ ...d, categoria_id: null })));
        setObservaciones(p.observaciones ?? "");
      })
      .catch(() => setError("No se pudo cargar el pedido."));
    obtenerHistorialPedido(pedidoId).then(setHistorial);
  }, [pedidoId]);

  useEffect(() => {
    if (soloLectura) return;
    obtenerProductos({ estado: "activos" }).then(setProductos);
    obtenerUnidades().then(setUnidades);
    obtenerCategorias().then(setCategorias);
  }, [soloLectura]);

  const presentacionPorId = useMemo(() => {
    const mapa = new Map<number, { producto: Producto; presentacion: Producto["presentaciones"][number] }>();
    for (const p of productos) {
      for (const pres of p.presentaciones) {
        mapa.set(pres.id, { producto: p, presentacion: pres });
      }
    }
    return mapa;
  }, [productos]);

  function cambiar(id: number, campo: keyof FilaDetalle, valor: string) {
    setDetalles((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [campo]: valor } : d))
    );
  }

  function cambiarProducto(id: number, productoId: number) {
    const prod = productos.find((p) => p.id === productoId);
    setDetalles((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              producto_id: productoId,
              nombre_producto: prod?.nombre_producto ?? "",
              categoria: prod?.categoria_nombre ?? "",
              presentacion_id: null,
              presentacion_nombre: null,
              unidad_id: null,
              unidad_nombre: "",
            }
          : d
      )
    );
    const primera = prod?.presentaciones[0];
    if (primera) cambiarPresentacion(id, primera.id);
  }

  function cambiarPresentacion(id: number, presentacionId: number) {
    const info = presentacionPorId.get(presentacionId);
    if (!info) return;
    setDetalles((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              presentacion_id: info.presentacion.id,
              presentacion_nombre: info.presentacion.nombre_presentacion,
              producto_id: info.producto.id,
              nombre_producto: info.producto.nombre_producto,
              categoria: info.producto.categoria_nombre,
              unidad_id: info.presentacion.unidad_venta,
              unidad_nombre: info.presentacion.unidad_venta_nombre,
              precio_unitario: info.presentacion.precio_unitario,
            }
          : d
      )
    );
  }

  function cambiarUnidadPersonalizada(id: number, unidadId: number) {
    const u = unidades.find((x) => x.id === unidadId);
    setDetalles((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, unidad_id: unidadId, unidad_nombre: u?.nombre_unidad ?? "" } : d
      )
    );
  }

  function quitar(id: number) {
    setDetalles((prev) => prev.filter((d) => d.id !== id));
  }

  function agregarLinea() {
    setErrorAgregar(null);
    const cantidad = nuevaCantidad || "0";
    if (!(parseFloat(cantidad) > 0)) {
      setErrorAgregar("La cantidad debe ser mayor a 0.");
      return;
    }

    const id = (nextTempId.current -= 1);

    if (modoAgregar === "catalogo") {
      if (nuevaPresentacionId === "") {
        setErrorAgregar("Selecciona un producto y una presentación.");
        return;
      }
      const info = presentacionPorId.get(Number(nuevaPresentacionId));
      if (!info) return;
      setDetalles((prev) => [
        ...prev,
        {
          id,
          detalle_id: id,
          presentacion_id: info.presentacion.id,
          presentacion_nombre: info.presentacion.nombre_presentacion,
          producto_id: info.producto.id,
          nombre_producto: info.producto.nombre_producto,
          categoria: info.producto.categoria_nombre,
          unidad_id: info.presentacion.unidad_venta,
          unidad_nombre: info.presentacion.unidad_venta_nombre,
          cantidad,
          precio_unitario: nuevoPrecio || info.presentacion.precio_unitario,
          subtotal: "0",
          personalizado: false,
          estado_revision: null,
          categoria_id: null,
        },
      ]);
    } else {
      if (!nuevoNombre.trim()) {
        setErrorAgregar("Escribe un nombre para el producto personalizado.");
        return;
      }
      const cat = categorias.find((c) => c.id === Number(nuevaCategoriaId));
      const uni = unidades.find((u) => u.id === Number(nuevaUnidadId));
      setDetalles((prev) => [
        ...prev,
        {
          id,
          detalle_id: id,
          presentacion_id: null,
          presentacion_nombre: null,
          producto_id: null,
          nombre_producto: nuevoNombre.trim(),
          categoria: cat?.nombre_categoria ?? "",
          unidad_id: nuevaUnidadId === "" ? null : Number(nuevaUnidadId),
          unidad_nombre: uni?.nombre_unidad ?? "",
          cantidad,
          precio_unitario: nuevoPrecio || "0",
          subtotal: "0",
          personalizado: true,
          estado_revision: null,
          categoria_id: nuevaCategoriaId === "" ? null : Number(nuevaCategoriaId),
        },
      ]);
    }

    setNuevoProductoId("");
    setNuevaPresentacionId("");
    setNuevoNombre("");
    setNuevaCategoriaId("");
    setNuevaUnidadId("");
    setNuevaCantidad("1");
    setNuevoPrecio("0");
  }

  const total = detalles.reduce(
    (acc, d) => acc + (parseFloat(d.cantidad) || 0) * (parseFloat(d.precio_unitario) || 0),
    0
  );

  async function guardar() {
    if (detalles.length === 0) {
      setError("El pedido debe tener al menos un producto.");
      return;
    }
    for (const d of detalles) {
      if (d.personalizado && !d.nombre_producto.trim()) {
        setError("Todas las líneas personalizadas deben tener un nombre.");
        return;
      }
      if (!d.personalizado && d.presentacion_id == null) {
        setError("Selecciona una presentación para cada producto de catálogo.");
        return;
      }
      if (!(parseFloat(d.cantidad) > 0)) {
        setError("La cantidad de cada línea debe ser mayor a 0.");
        return;
      }
      if (!(parseFloat(d.precio_unitario) >= 0)) {
        setError("El precio de cada línea no puede ser negativo.");
        return;
      }
    }

    setGuardando(true);
    setError(null);
    try {
      await editarPedido(pedidoId, {
        detalles: detalles.map((d) => {
          const esNueva = d.id < 0;
          if (d.personalizado) {
            return {
              detalle_id: esNueva ? null : d.id,
              nombre_producto: d.nombre_producto,
              unidad_id: d.unidad_id ?? undefined,
              categoria_id: esNueva ? d.categoria_id ?? undefined : undefined,
              cantidad: d.cantidad,
              precio_unitario: d.precio_unitario,
            };
          }
          return {
            detalle_id: esNueva ? null : d.id,
            presentacion_id: d.presentacion_id ?? undefined,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
          };
        }),
        observaciones,
      });
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el pedido."));
    } finally {
      setGuardando(false);
    }
  }

  async function imprimir() {
    setImprimiendo(true);
    try {
      await descargarPdfPedido(pedidoId);
    } finally {
      setImprimiendo(false);
    }
  }

  const productoSeleccionado = productos.find((p) => p.id === nuevoProductoId);

  return (
    <Modal
      ancho
      lateral
      titulo={`Pedido #${pedidoId}`}
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="btn secundario" onClick={imprimir} disabled={imprimiendo}>
            {imprimiendo ? "Generando…" : "Imprimir factura"}
          </button>
          {!soloLectura && (
            <button className="btn primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
        </>
      }
    >
      {error && <div className="error-box">{error}</div>}
      {!pedido ? (
        <div className="vacio">Cargando…</div>
      ) : (
        <>
          <p style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              <strong>Cliente:</strong> {pedido.cliente_nombre || "—"} &nbsp;·&nbsp;
              <span className={`badge ${pedido.estado}`}>{pedido.estado}</span>
            </span>
            {historial.length > 0 && (
              <button
                type="button"
                className="btn-limpiar"
                onClick={() => setVerHistorial((v) => !v)}
              >
                <History size={14} /> {verHistorial ? "Ocultar historial" : `Historial (${historial.length})`}
              </button>
            )}
          </p>

          {verHistorial && historial.length > 0 && (
            <div className="historial-lista" style={{ marginBottom: "1rem" }}>
              {historial.map((h) => (
                <div className="historial-item" key={h.id}>
                  <span className="historial-icono editado">
                    <Pencil size={16} />
                  </span>
                  <div className="historial-detalle">
                    <div className="historial-presentacion">
                      {h.producto_nombre} · {h.campo_etiqueta}
                    </div>
                    <div className="historial-precios">
                      <span className="anterior">
                        {formatoValorHistorial(h.campo, h.valor_anterior)}
                      </span>
                      →
                      <span className="nuevo">
                        {formatoValorHistorial(h.campo, h.valor_nuevo)}
                      </span>
                    </div>
                    <div className="historial-meta">
                      {formatoFecha(h.fecha)} · {h.usuario_nombre}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación / Unidad</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Precio</th>
                  <th className="num">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.personalizado ? (
                        <>
                          <input
                            className="input"
                            value={d.nombre_producto}
                            disabled={soloLectura}
                            onChange={(e) =>
                              cambiar(d.id, "nombre_producto", e.target.value)
                            }
                          />
                          {d.estado_revision === "PENDIENTE" && (
                            <span className="badge PENDIENTE" style={{ marginTop: ".3rem", display: "inline-block" }}>
                              Pendiente de revisión
                            </span>
                          )}
                        </>
                      ) : soloLectura ? (
                        d.nombre_producto
                      ) : (
                        <select
                          className="input"
                          style={{ minWidth: 170 }}
                          value={d.producto_id ?? ""}
                          onChange={(e) => cambiarProducto(d.id, Number(e.target.value))}
                        >
                          <option value="">Selecciona…</option>
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre_producto}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      {d.personalizado ? (
                        soloLectura ? (
                          d.unidad_nombre || "—"
                        ) : (
                          <select
                            className="input"
                            style={{ minWidth: 170 }}
                            value={d.unidad_id ?? ""}
                            onChange={(e) => cambiarUnidadPersonalizada(d.id, Number(e.target.value))}
                          >
                            <option value="">Selecciona unidad…</option>
                            {unidades.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nombre_unidad}
                              </option>
                            ))}
                          </select>
                        )
                      ) : soloLectura ? (
                        d.presentacion_nombre ? `${d.presentacion_nombre} · ${d.unidad_nombre}` : "—"
                      ) : (
                        <select
                          className="input"
                          style={{ minWidth: 210 }}
                          value={d.presentacion_id ?? ""}
                          onChange={(e) => cambiarPresentacion(d.id, Number(e.target.value))}
                        >
                          <option value="">Selecciona…</option>
                          {(productos.find((p) => p.id === d.producto_id)?.presentaciones ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre_presentacion} · {p.unidad_venta_nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="num">
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        style={{ width: 80 }}
                        value={d.cantidad}
                        disabled={soloLectura}
                        onChange={(e) => cambiar(d.id, "cantidad", e.target.value)}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="input"
                        type="number"
                        style={{ width: 110 }}
                        value={d.precio_unitario}
                        disabled={soloLectura}
                        onChange={(e) =>
                          cambiar(d.id, "precio_unitario", e.target.value)
                        }
                      />
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatoPrecio(
                        (parseFloat(d.cantidad) || 0) *
                          (parseFloat(d.precio_unitario) || 0)
                      )}
                    </td>
                    <td>
                      {!soloLectura && (
                        <Tooltip label="Quitar producto">
                          <button
                            type="button"
                            className="btn-icon peligro"
                            onClick={() => quitar(d.id)}
                            aria-label="Quitar producto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!soloLectura && (
            <div style={{ marginTop: "0" }}>
              <div className="modal-seccion">
                <PackagePlus size={16} />
                <span>Agregar producto</span>
              </div>

              <div className="segmentado" style={{ marginBottom: ".7rem" }}>
                <button
                  type="button"
                  className={modoAgregar === "catalogo" ? "activo" : ""}
                  onClick={() => setModoAgregar("catalogo")}
                >
                  Del catálogo
                </button>
                <button
                  type="button"
                  className={modoAgregar === "personalizado" ? "activo" : ""}
                  onClick={() => setModoAgregar("personalizado")}
                >
                  Personalizado
                </button>
              </div>

              {errorAgregar && <div className="error-box">{errorAgregar}</div>}

              {modoAgregar === "catalogo" ? (
                <div className="pres-row">
                  <div className="pres-row-campo" style={{ flex: 1.6 }}>
                    <span>Producto</span>
                    <select
                      value={nuevoProductoId}
                      onChange={(e) => {
                        const pid = e.target.value === "" ? "" : Number(e.target.value);
                        setNuevoProductoId(pid);
                        const prod = productos.find((p) => p.id === pid);
                        const primera = prod?.presentaciones[0];
                        setNuevaPresentacionId(primera?.id ?? "");
                        setNuevoPrecio(primera?.precio_unitario ?? "0");
                      }}
                    >
                      <option value="">Selecciona…</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre_producto}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pres-row-campo" style={{ flex: 1.4 }}>
                    <span>Presentación</span>
                    <select
                      value={nuevaPresentacionId}
                      onChange={(e) => {
                        const pid = Number(e.target.value);
                        setNuevaPresentacionId(pid);
                        const pres = productoSeleccionado?.presentaciones.find((p) => p.id === pid);
                        if (pres) setNuevoPrecio(pres.precio_unitario);
                      }}
                    >
                      <option value="">Selecciona…</option>
                      {(productoSeleccionado?.presentaciones ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre_presentacion} · {p.unidad_venta_nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pres-row-campo" style={{ flex: .6 }}>
                    <span>Cantidad</span>
                    <input
                      type="number"
                      step="0.01"
                      value={nuevaCantidad}
                      onChange={(e) => setNuevaCantidad(e.target.value)}
                    />
                  </div>
                  <div className="pres-row-campo" style={{ flex: .7 }}>
                    <span>Precio</span>
                    <input
                      type="number"
                      value={nuevoPrecio}
                      onChange={(e) => setNuevoPrecio(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn primario sm"
                    onClick={agregarLinea}
                    style={{ marginBottom: ".1rem" }}
                    aria-label="Agregar producto"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ) : (
                <div className="pres-row">
                  <div className="pres-row-campo" style={{ flex: 2 }}>
                    <span>Nombre</span>
                    <input
                      placeholder="Nombre del producto"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                    />
                  </div>
                  <div className="pres-row-campo">
                    <span>Categoría</span>
                    <select
                      value={nuevaCategoriaId}
                      onChange={(e) =>
                        setNuevaCategoriaId(e.target.value === "" ? "" : Number(e.target.value))
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
                  <div className="pres-row-campo">
                    <span>Unidad</span>
                    <select
                      value={nuevaUnidadId}
                      onChange={(e) =>
                        setNuevaUnidadId(e.target.value === "" ? "" : Number(e.target.value))
                      }
                    >
                      <option value="">Selecciona…</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre_unidad}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pres-row-campo" style={{ flex: .6 }}>
                    <span>Cantidad</span>
                    <input
                      type="number"
                      step="0.01"
                      value={nuevaCantidad}
                      onChange={(e) => setNuevaCantidad(e.target.value)}
                    />
                  </div>
                  <div className="pres-row-campo" style={{ flex: .7 }}>
                    <span>Precio</span>
                    <input
                      type="number"
                      value={nuevoPrecio}
                      onChange={(e) => setNuevoPrecio(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn primario sm"
                    onClick={agregarLinea}
                    style={{ marginBottom: ".1rem" }}
                    aria-label="Agregar producto"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="campo" style={{ marginTop: "1rem" }}>
            <label>Observaciones</label>
            <textarea
              rows={2}
              value={observaciones}
              disabled={soloLectura}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="total-linea" style={{ textAlign: "right", fontWeight: 800 }}>
            Total: {formatoPrecio(total)}
          </div>
        </>
      )}
    </Modal>
  );
}
