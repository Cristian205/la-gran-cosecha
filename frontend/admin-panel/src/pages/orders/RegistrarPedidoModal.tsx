import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import {
  obtenerClientes,
  obtenerProductos,
  registrarPedido,
  type RegistrarPedidoPayload,
} from "../../api/resources";
import { Modal } from "../../components/Modal";
import { Tooltip } from "../../components/Tooltip";
import type { Cliente, Presentacion, Producto } from "../../types";
import { extraerMensajeError, formatoPrecio } from "../../utils";
import { alertaError } from "../../utils/alertas";

/** Una línea del pedido que se está apuntando. */
interface Linea {
  /** `producto-presentación`: dos veces el mismo artículo suma, no duplica. */
  clave: string;
  presentacion: Presentacion;
  producto: string;
  cantidad: string;
}

type ModoCliente = "existente" | "nuevo";

/**
 * Apuntar un pedido sin salir del panel.
 *
 * El pedido que entra por teléfono o WhatsApp antes había que meterlo desde la
 * tienda, haciéndose pasar por el cliente. Aquí lo apunta quien atiende, con su
 * nombre detrás: el pedido queda igual que cualquier otro —pendiente, con su
 * mercancía apartada— y se puede ajustar luego desde su detalle.
 *
 * El precio es el del catálogo y no se edita aquí a propósito: el sitio donde
 * se cambia un precio con su rastro es el pedido ya creado, que registra quién
 * lo tocó y qué había antes. Esta pantalla solo apunta lo que el cliente pidió.
 */
export function RegistrarPedidoModal({
  onCerrar,
  onRegistrado,
}: {
  onCerrar: () => void;
  onRegistrado: (pedidoId: number, cliente: string) => void;
}) {
  const [modoCliente, setModoCliente] = useState<ModoCliente>("existente");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [elegido, setElegido] = useState<Cliente | null>(null);
  const [nuevo, setNuevo] = useState({ nombre: "", telefono: "", direccion: "" });

  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [buscaProducto, setBuscaProducto] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El catálogo se pide una vez: la búsqueda de productos es local, que es lo
  // que hace que teclear no espere a la red.
  useEffect(() => {
    obtenerProductos()
      .then(setProductos)
      .catch((err) => setError(extraerMensajeError(err, "No se pudo cargar el catálogo.")));
  }, []);

  // Los clientes sí se buscan en el servidor: pueden ser miles.
  const temporizador = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (modoCliente !== "existente") return;
    setCargandoClientes(true);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => {
      obtenerClientes(buscaCliente.trim() || undefined)
        .then(setClientes)
        .catch(() => setClientes([]))
        .finally(() => setCargandoClientes(false));
    }, 300);
    return () => window.clearTimeout(temporizador.current);
  }, [buscaCliente, modoCliente]);

  /** Presentaciones activas que coinciden con lo tecleado. */
  const coincidencias = useMemo(() => {
    if (!productos) return [];
    const q = buscaProducto.trim().toLowerCase();
    if (!q) return [];
    const salida: { producto: Producto; presentacion: Presentacion }[] = [];
    for (const p of productos) {
      if (!p.estado_producto) continue;
      const enProducto =
        p.nombre_producto.toLowerCase().includes(q) ||
        p.codigo_producto.toLowerCase().includes(q) ||
        p.codigo_barras?.toLowerCase().includes(q);
      for (const pres of p.presentaciones) {
        if (!pres.estado_presentacion) continue;
        if (enProducto || pres.nombre_presentacion.toLowerCase().includes(q)) {
          salida.push({ producto: p, presentacion: pres });
        }
      }
      if (salida.length >= 40) break;
    }
    return salida;
  }, [productos, buscaProducto]);

  function agregar(producto: Producto, presentacion: Presentacion) {
    const clave = `${producto.id}-${presentacion.id}`;
    setLineas((prev) => {
      const ya = prev.find((l) => l.clave === clave);
      if (ya) {
        // Repetir el mismo artículo suma su mínimo en vez de crear otra línea.
        const paso = Number(presentacion.incremento_cantidad) || 1;
        return prev.map((l) =>
          l.clave === clave ? { ...l, cantidad: String(Number(l.cantidad) + paso) } : l
        );
      }
      return [
        ...prev,
        {
          clave,
          presentacion,
          producto: producto.nombre_producto,
          cantidad: presentacion.cantidad_minima || "1",
        },
      ];
    });
    setBuscaProducto("");
  }

  function cambiarCantidad(clave: string, cantidad: string) {
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, cantidad } : l)));
  }

  function quitar(clave: string) {
    setLineas((prev) => prev.filter((l) => l.clave !== clave));
  }

  const total = lineas.reduce(
    (suma, l) => suma + Number(l.cantidad || 0) * Number(l.presentacion.precio_unitario),
    0
  );
  const hayCliente = modoCliente === "existente" ? elegido !== null : nuevo.nombre.trim() !== "";
  const cantidadesValidas = lineas.every((l) => Number(l.cantidad) > 0);
  const puedeGuardar = hayCliente && lineas.length > 0 && cantidadesValidas && !guardando;

  async function guardar() {
    if (!puedeGuardar) return;
    const payload: RegistrarPedidoPayload = {
      items: lineas.map((l) => ({
        presentacion_id: l.presentacion.id,
        cantidad: l.cantidad,
      })),
      observaciones: observaciones.trim(),
    };
    if (modoCliente === "existente" && elegido) payload.cliente_id = elegido.id;
    else
      payload.cliente_nuevo = {
        nombre: nuevo.nombre.trim(),
        telefono: nuevo.telefono.trim(),
        direccion: nuevo.direccion.trim(),
      };

    setGuardando(true);
    setError(null);
    try {
      const res = await registrarPedido(payload);
      onRegistrado(res.pedido_id, res.cliente_nombre);
    } catch (err) {
      const mensaje = extraerMensajeError(err, "No se pudo registrar el pedido.");
      setError(mensaje);
      alertaError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Registrar pedido"
      subtitulo="Para el pedido que llegó por teléfono, WhatsApp o mostrador"
      onCerrar={onCerrar}
      amplio
      footer={
        <>
          <span className="rp-total">
            Total <strong>{formatoPrecio(total)}</strong>
          </span>
          <button type="button" className="btn secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="btn primario" onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? <Loader2 size={16} className="girando" /> : <Plus size={16} />}
            {guardando ? "Registrando…" : "Registrar pedido"}
          </button>
        </>
      }
    >
      {error && (
        <p className="campo-error rp-error" role="alert">
          {error}
        </p>
      )}

      {/* ---------- De quién es ---------- */}
      <section className="rp-bloque">
        <h4 className="rp-titulo">¿De quién es el pedido?</h4>
        <div className="segmentado rp-segmentado">
          <button
            type="button"
            className={modoCliente === "existente" ? "activo" : ""}
            onClick={() => setModoCliente("existente")}
          >
            <Users size={14} /> Cliente de la lista
          </button>
          <button
            type="button"
            className={modoCliente === "nuevo" ? "activo" : ""}
            onClick={() => setModoCliente("nuevo")}
          >
            <UserPlus size={14} /> Cliente nuevo
          </button>
        </div>

        {modoCliente === "existente" ? (
          elegido ? (
            <div className="rp-elegido">
              <div>
                <strong>{elegido.nombre_cliente}</strong>
                {elegido.telefono_cliente && <span> · {elegido.telefono_cliente}</span>}
                {elegido.direccion_cliente && (
                  <small className="rp-elegido-dir">{elegido.direccion_cliente}</small>
                )}
              </div>
              <Tooltip label="Elegir otro cliente">
                <button
                  type="button"
                  className="btn-icon peligro"
                  onClick={() => setElegido(null)}
                  aria-label="Elegir otro cliente"
                >
                  <X size={15} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="buscador rp-buscador">
                <Search size={15} />
                <input
                  type="text"
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Buscar por nombre o teléfono…"
                  aria-label="Buscar cliente"
                />
              </div>
              <ul className="rp-lista" role="listbox" aria-label="Clientes">
                {cargandoClientes && clientes.length === 0 && (
                  <li className="rp-lista-vacia">Buscando…</li>
                )}
                {!cargandoClientes && clientes.length === 0 && (
                  <li className="rp-lista-vacia">
                    Ningún cliente coincide. Puedes darlo de alta en «Cliente nuevo».
                  </li>
                )}
                {clientes.slice(0, 30).map((c) => (
                  <li key={c.id}>
                    <button type="button" className="rp-opcion" onClick={() => setElegido(c)}>
                      <span className="rp-opcion-nombre">{c.nombre_cliente}</span>
                      <span className="rp-opcion-meta">
                        {c.telefono_cliente || "sin teléfono"}
                        {c.direccion_cliente ? ` · ${c.direccion_cliente}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : (
          <div className="rp-nuevo">
            <div className="campo">
              <label htmlFor="rp-nombre">Nombre o negocio *</label>
              <input
                id="rp-nombre"
                type="text"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Tienda del barrio"
              />
            </div>
            <div className="fila">
              <div className="campo">
                <label htmlFor="rp-telefono">Teléfono</label>
                <input
                  id="rp-telefono"
                  type="tel"
                  value={nuevo.telefono}
                  onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
                  placeholder="300 123 4567"
                />
              </div>
              <div className="campo">
                <label htmlFor="rp-direccion">Dirección de entrega</label>
                <input
                  id="rp-direccion"
                  type="text"
                  value={nuevo.direccion}
                  onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })}
                  placeholder="Calle 1 # 2-3"
                />
              </div>
            </div>
            <p className="rp-ayuda">
              Con el nombre basta para apuntar el pedido; el resto se puede completar después en la
              ficha del cliente.
            </p>
          </div>
        )}
      </section>

      {/* ---------- Qué pidió ---------- */}
      <section className="rp-bloque">
        <h4 className="rp-titulo">¿Qué pidió?</h4>
        <div className="buscador rp-buscador">
          <Search size={15} />
          <input
            type="text"
            value={buscaProducto}
            onChange={(e) => setBuscaProducto(e.target.value)}
            placeholder={productos ? "Buscar producto por nombre o código…" : "Cargando catálogo…"}
            disabled={!productos}
            aria-label="Buscar producto"
          />
        </div>
        {buscaProducto.trim() !== "" && (
          <ul className="rp-lista" role="listbox" aria-label="Productos">
            {coincidencias.length === 0 && (
              <li className="rp-lista-vacia">Ningún producto activo coincide.</li>
            )}
            {coincidencias.map(({ producto, presentacion }) => (
              <li key={`${producto.id}-${presentacion.id}`}>
                <button
                  type="button"
                  className="rp-opcion"
                  onClick={() => agregar(producto, presentacion)}
                >
                  <span className="rp-opcion-nombre">
                    {producto.nombre_producto}
                    <small> · {presentacion.nombre_presentacion}</small>
                  </span>
                  <span className="rp-opcion-meta">
                    {formatoPrecio(presentacion.precio_unitario)} /{" "}
                    {presentacion.unidad_venta_abreviatura || presentacion.unidad_venta_nombre}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {lineas.length === 0 ? (
          <p className="rp-ayuda">Busca un producto arriba para añadirlo al pedido.</p>
        ) : (
          <div className="tabla-scroll">
            <table className="rp-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Precio</th>
                  <th className="num">Subtotal</th>
                  <th className="col-acciones">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.clave}>
                    <td>
                      {l.producto}
                      <small className="rp-linea-pres"> · {l.presentacion.nombre_presentacion}</small>
                    </td>
                    <td className="num">
                      <input
                        className="input rp-cantidad"
                        type="number"
                        inputMode="decimal"
                        min={l.presentacion.cantidad_minima || "0"}
                        step={l.presentacion.incremento_cantidad || "1"}
                        value={l.cantidad}
                        onChange={(e) => cambiarCantidad(l.clave, e.target.value)}
                        aria-label={`Cantidad de ${l.producto}`}
                      />
                    </td>
                    <td className="num">{formatoPrecio(l.presentacion.precio_unitario)}</td>
                    <td className="num">
                      {formatoPrecio(
                        Number(l.cantidad || 0) * Number(l.presentacion.precio_unitario)
                      )}
                    </td>
                    <td className="col-acciones">
                      <div className="acciones">
                        <Tooltip label="Quitar del pedido">
                          <button
                            type="button"
                            className="btn-icon peligro"
                            onClick={() => quitar(l.clave)}
                            aria-label={`Quitar ${l.producto}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Nota ---------- */}
      <section className="rp-bloque">
        <div className="campo">
          <label htmlFor="rp-obs">Observaciones</label>
          <textarea
            id="rp-obs"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Cómo llegó el pedido, a qué hora lo quiere, quién lo recibe…"
          />
        </div>
      </section>
    </Modal>
  );
}
