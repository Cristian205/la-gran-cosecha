import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageOff,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  PencilLine,
  Phone,
  Plus,
  Search,
  Store,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  obtenerClientes,
  obtenerProductos,
  obtenerUnidades,
  registrarPedido,
  type CanalPedido,
  type RegistrarPedidoPayload,
} from "../../api/resources";
import { Modal } from "../../components/Modal";
import { PasosModal, type PasoModal } from "../../components/PasosModal";
import { Tooltip } from "../../components/Tooltip";
import type { Cliente, Presentacion, Producto, UnidadMedida } from "../../types";
import { extraerMensajeError, formatoPrecio } from "../../utils";
import { alertaError, confirmarDescartar } from "../../utils/alertas";

/** Una línea de catálogo del pedido que se está apuntando. */
interface Linea {
  /** `producto-presentación`: dos veces el mismo artículo suma, no duplica. */
  clave: string;
  producto: Producto;
  presentacion: Presentacion;
  cantidad: string;
}

/** Un producto que no está en el catálogo, escrito a mano. */
interface Manual {
  id: number;
  nombre: string;
  cantidad: string;
  /** Vacío = sin precio todavía; se ajusta luego en el pedido. */
  precio: string;
  unidadId: number | null;
}

type ModoCliente = "existente" | "nuevo";
type Paso = "cliente" | "productos" | "confirmar";

const PASOS: Paso[] = ["cliente", "productos", "confirmar"];

const CANALES: { valor: CanalPedido; etiqueta: string; Icono: typeof Phone }[] = [
  { valor: "TELEFONO", etiqueta: "Teléfono", Icono: Phone },
  { valor: "WHATSAPP", etiqueta: "WhatsApp", Icono: MessageCircle },
  { valor: "MOSTRADOR", etiqueta: "Mostrador", Icono: Store },
];

const MANUAL_VACIO = { nombre: "", cantidad: "1", precio: "", unidadId: null as number | null };

const num = (v: string | number | null | undefined) => Number(v || 0);

/** Cómo se nombra un cliente: por su negocio si lo tiene; si no, por la persona. */
function tituloCliente(c: { nombre_cliente: string; negocio_cliente?: string }): string {
  return c.negocio_cliente?.trim() || c.nombre_cliente;
}

/** La persona de contacto, solo cuando el título ya es el negocio. */
function contactoCliente(c: { nombre_cliente: string; negocio_cliente?: string }): string {
  return c.negocio_cliente?.trim() ? c.nombre_cliente : "";
}

type ClienteNuevo = { negocio: string; nombre: string; telefono: string; direccion: string };

/** Iniciales para el avatar del cliente elegido. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Apuntar un pedido sin salir del panel, en tres pasos: de quién es, qué
 * pidió y confirmar.
 *
 * El pedido que entra por teléfono o WhatsApp antes había que meterlo desde la
 * tienda, haciéndose pasar por el cliente. Aquí lo apunta quien atiende, con su
 * nombre detrás: el pedido queda igual que cualquier otro —pendiente, con su
 * mercancía apartada— y se puede ajustar luego desde su detalle.
 *
 * El precio de catálogo no se edita aquí a propósito: el sitio donde se cambia
 * un precio con su rastro es el pedido ya creado, que registra quién lo tocó y
 * qué había antes. Los productos manuales sí llevan precio, porque no tienen
 * otro de dónde salir; vacío, se ajusta después igual que los demás.
 *
 * Cambiar de paso no borra nada: todo vive en el estado de este componente,
 * no en los campos de cada paso.
 */
export function RegistrarPedidoModal({
  onCerrar,
  onRegistrado,
}: {
  onCerrar: () => void;
  onRegistrado: (pedidoId: number, cliente: string) => void;
}) {
  const [paso, setPaso] = useState<Paso>("cliente");

  // ---- Cliente ----
  const [modoCliente, setModoCliente] = useState<ModoCliente>("existente");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [elegido, setElegido] = useState<Cliente | null>(null);
  const [nuevo, setNuevo] = useState<ClienteNuevo>({ negocio: "", nombre: "", telefono: "", direccion: "" });

  // ---- Productos ----
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [buscaProducto, setBuscaProducto] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [manuales, setManuales] = useState<Manual[]>([]);
  const [formManual, setFormManual] = useState<typeof MANUAL_VACIO | null>(null);
  const [unidades, setUnidades] = useState<UnidadMedida[] | null>(null);
  const siguienteManual = useRef(1);

  // ---- Confirmación ----
  const [canal, setCanal] = useState<CanalPedido | "">("");
  const [observaciones, setObservaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Se encienden al intentar avanzar: hasta entonces no se regaña a nadie.
  const [intento, setIntento] = useState<Record<Paso, boolean>>({
    cliente: false,
    productos: false,
    confirmar: false,
  });

  // El catálogo se pide una vez: la búsqueda de productos es local, que es lo
  // que hace que teclear no espere a la red.
  useEffect(() => {
    obtenerProductos()
      .then(setProductos)
      .catch((err) => setErrorCatalogo(extraerMensajeError(err, "No se pudo cargar el catálogo.")));
  }, []);

  // Las unidades solo hacen falta para un producto manual.
  useEffect(() => {
    if (!formManual || unidades) return;
    obtenerUnidades()
      .then((u) => setUnidades(u.filter((x) => x.estado_unidad)))
      .catch(() => setUnidades([]));
  }, [formManual, unidades]);

  // Los clientes sí se buscan en el servidor: pueden ser miles.
  const temporizador = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (modoCliente !== "existente" || elegido) return;
    setCargandoClientes(true);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => {
      obtenerClientes(buscaCliente.trim() || undefined)
        .then(setClientes)
        .catch(() => setClientes([]))
        .finally(() => setCargandoClientes(false));
    }, 300);
    return () => window.clearTimeout(temporizador.current);
  }, [buscaCliente, modoCliente, elegido]);

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

  // ---------------------------------------------------------------- líneas
  function agregar(producto: Producto, presentacion: Presentacion) {
    const clave = `${producto.id}-${presentacion.id}`;
    setLineas((prev) => {
      const ya = prev.find((l) => l.clave === clave);
      if (ya) {
        // Repetir el mismo artículo suma su mínimo en vez de crear otra línea.
        const paso = Number(presentacion.incremento_cantidad) || 1;
        return prev.map((l) => (l.clave === clave ? { ...l, cantidad: String(num(l.cantidad) + paso) } : l));
      }
      return [...prev, { clave, producto, presentacion, cantidad: presentacion.cantidad_minima || "1" }];
    });
    setBuscaProducto("");
  }

  function cambiarCantidad(clave: string, cantidad: string) {
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, cantidad } : l)));
  }

  /** Sube o baja una línea según el incremento de su presentación. */
  function pasoCantidad(l: Linea, signo: 1 | -1) {
    const paso = Number(l.presentacion.incremento_cantidad) || 1;
    const minimo = Number(l.presentacion.cantidad_minima) || paso;
    const siguiente = Math.max(minimo, Math.round((num(l.cantidad) + signo * paso) * 1000) / 1000);
    cambiarCantidad(l.clave, String(siguiente));
  }

  /** Otra presentación del mismo producto; si ya estaba en el pedido, se suman. */
  function cambiarPresentacion(l: Linea, presentacionId: number) {
    const presentacion = l.producto.presentaciones.find((p) => p.id === presentacionId);
    if (!presentacion) return;
    const clave = `${l.producto.id}-${presentacion.id}`;
    setLineas((prev) => {
      const existente = prev.find((x) => x.clave === clave);
      if (existente) {
        return prev
          .filter((x) => x.clave !== l.clave)
          .map((x) => (x.clave === clave ? { ...x, cantidad: String(num(x.cantidad) + num(l.cantidad)) } : x));
      }
      return prev.map((x) => (x.clave === l.clave ? { ...x, clave, presentacion } : x));
    });
  }

  function quitar(clave: string) {
    setLineas((prev) => prev.filter((l) => l.clave !== clave));
  }

  function guardarManual() {
    if (!formManual) return;
    if (!formManual.nombre.trim() || num(formManual.cantidad) <= 0) return;
    setManuales((prev) => [...prev, { id: siguienteManual.current++, ...formManual, nombre: formManual.nombre.trim() }]);
    setFormManual(null);
  }

  function cambiarManual(id: number, cambio: Partial<Manual>) {
    setManuales((prev) => prev.map((m) => (m.id === id ? { ...m, ...cambio } : m)));
  }

  // ---------------------------------------------------------------- derivados
  const subtotalLinea = (l: Linea) => num(l.cantidad) * num(l.presentacion.precio_unitario);
  const subtotalManual = (m: Manual) => num(m.cantidad) * num(m.precio);
  const total =
    lineas.reduce((s, l) => s + subtotalLinea(l), 0) + manuales.reduce((s, m) => s + subtotalManual(m), 0);
  const cantidadProductos = lineas.length + manuales.length;
  const nombreUnidad = (id: number | null) => unidades?.find((u) => u.id === id)?.abreviatura_unidad ?? "";

  const hayCliente = modoCliente === "existente" ? elegido !== null : nuevo.nombre.trim() !== "";
  const lineasInvalidas = new Set(lineas.filter((l) => !(num(l.cantidad) > 0)).map((l) => l.clave));
  const manualesInvalidos = new Set(
    manuales.filter((m) => !m.nombre.trim() || !(num(m.cantidad) > 0) || num(m.precio) < 0).map((m) => m.id)
  );
  const productosValidos = cantidadProductos > 0 && lineasInvalidas.size === 0 && manualesInvalidos.size === 0;

  // Lo que se muestra del cliente, venga de la lista o del formulario.
  const clienteVista =
    modoCliente === "existente"
      ? elegido
        ? {
            nombre_cliente: elegido.nombre_cliente,
            negocio_cliente: elegido.negocio_cliente,
            telefono: elegido.telefono_cliente,
            direccion: elegido.direccion_cliente,
          }
        : null
      : {
          nombre_cliente: nuevo.nombre.trim(),
          negocio_cliente: nuevo.negocio.trim(),
          telefono: nuevo.telefono.trim(),
          direccion: nuevo.direccion.trim(),
        };
  const nombreCliente = clienteVista && hayCliente ? tituloCliente(clienteVista) : "";
  const hayCambios =
    elegido !== null ||
    Object.values(nuevo).some((v) => v.trim()) ||
    cantidadProductos > 0 ||
    observaciones.trim() !== "" ||
    canal !== "";

  // ---------------------------------------------------------------- navegación
  const indice = PASOS.indexOf(paso);
  const pasos: PasoModal[] = [
    { clave: "cliente", titulo: "Cliente", detalle: nombreCliente || "Sin elegir", hecho: hayCliente && indice > 0 },
    {
      clave: "productos",
      titulo: "Productos",
      detalle: cantidadProductos ? `${cantidadProductos} producto${cantidadProductos === 1 ? "" : "s"}` : "Ninguno",
      bloqueado: !hayCliente,
      hecho: productosValidos && indice > 1,
    },
    { clave: "confirmar", titulo: "Confirmación", detalle: formatoPrecio(total), bloqueado: !hayCliente || !productosValidos },
  ];

  /** ¿Se puede salir de este paso hacia delante? Si no, muestra por qué. */
  function validar(desde: Paso): boolean {
    setIntento((v) => ({ ...v, [desde]: true }));
    if (desde === "cliente") return hayCliente;
    if (desde === "productos") return productosValidos;
    return true;
  }

  function irA(destino: Paso) {
    const d = PASOS.indexOf(destino);
    // Hacia atrás, siempre; hacia delante, solo si cada paso intermedio vale.
    for (let i = indice; i < d; i++) if (!validar(PASOS[i])) return setPaso(PASOS[i]);
    setError(null);
    setPaso(destino);
  }

  async function cerrar() {
    if (guardando) return;
    if (hayCambios && !(await confirmarDescartar("El pedido que estás apuntando se perderá."))) return;
    onCerrar();
  }

  async function registrar() {
    if (!validar("cliente")) return setPaso("cliente");
    if (!validar("productos")) return setPaso("productos");
    const payload: RegistrarPedidoPayload = {
      items: lineas.map((l) => ({ presentacion_id: l.presentacion.id, cantidad: l.cantidad })),
      personalizados: manuales.map((m) => ({
        nombre: m.nombre,
        cantidad: m.cantidad,
        ...(m.precio.trim() ? { precio_unitario: m.precio } : {}),
        unidad_id: m.unidadId,
      })),
      observaciones: observaciones.trim(),
      canal,
    };
    if (modoCliente === "existente" && elegido) payload.cliente_id = elegido.id;
    else
      payload.cliente_nuevo = {
        nombre: nuevo.nombre.trim(),
        negocio: nuevo.negocio.trim(),
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

  // ---------------------------------------------------------------- pie
  const pie = (
    <>
      <span className="rp-total">
        <span>
          Total <small>{cantidadProductos ? `· ${cantidadProductos} producto${cantidadProductos === 1 ? "" : "s"}` : ""}</small>
        </span>
        <strong>{formatoPrecio(total)}</strong>
      </span>
      {indice === 0 ? (
        <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
          Cancelar
        </button>
      ) : (
        <button type="button" className="btn secundario" onClick={() => irA(PASOS[indice - 1])} disabled={guardando}>
          <ArrowLeft size={16} /> Atrás
        </button>
      )}
      {paso !== "confirmar" ? (
        <button type="button" className="btn primario" onClick={() => irA(PASOS[indice + 1])}>
          Continuar <ArrowRight size={16} />
        </button>
      ) : (
        <button type="button" className="btn primario" onClick={registrar} disabled={guardando}>
          {guardando ? <Loader2 size={16} className="girando" /> : <Check size={16} />}
          {guardando ? "Registrando…" : "Registrar pedido"}
        </button>
      )}
    </>
  );

  return (
    <Modal
      titulo="Registrar pedido"
      subtitulo="Para el pedido que llegó por teléfono, WhatsApp o mostrador"
      onCerrar={cerrar}
      // `cerrar` ya pregunta antes de descartar: el modal no repite la pregunta.
      preguntaAlCerrar
      cerrarConEscape
      amplio
      ancho
      clase="rp-modal"
      subcabecera={
        <PasosModal
          etiqueta="Pasos para registrar el pedido"
          pasos={pasos}
          activo={paso}
          onCambiar={(c) => irA(c as Paso)}
          variante="progreso"
        />
      }
      footer={pie}
    >
      {error && (
        <p className="campo-error rp-error" role="alert">
          {error}
        </p>
      )}

      {paso === "cliente" && (
        <PasoCliente
          modo={modoCliente}
          onModo={setModoCliente}
          buscar={buscaCliente}
          onBuscar={setBuscaCliente}
          clientes={clientes}
          cargando={cargandoClientes}
          elegido={elegido}
          onElegir={(c) => {
            setElegido(c);
            setIntento((v) => ({ ...v, cliente: false }));
          }}
          nuevo={nuevo}
          onNuevo={setNuevo}
          mostrarError={intento.cliente && !hayCliente}
        />
      )}

      {paso === "productos" && (
        <section className="rp-paso" aria-labelledby="rp-titulo-productos">
          <h3 className="rp-titulo" id="rp-titulo-productos" tabIndex={-1}>
            ¿Qué pidió?
          </h3>

          <div className="rp-panel">
            <div className="buscador rp-buscador">
              <Search size={15} />
              <input
                type="text"
                autoFocus
                value={buscaProducto}
                onChange={(e) => setBuscaProducto(e.target.value)}
                onKeyDown={(e) => {
                  // Enter añade el primero: apuntar al dictado sin soltar el teclado.
                  if (e.key === "Enter" && coincidencias[0]) {
                    e.preventDefault();
                    agregar(coincidencias[0].producto, coincidencias[0].presentacion);
                  }
                }}
                placeholder={productos ? "Buscar producto por nombre o código…" : "Cargando catálogo…"}
                disabled={!productos}
                aria-label="Buscar producto"
                data-sin-cambios
              />
              {!productos && !errorCatalogo && <Loader2 size={15} className="girando rp-carga" aria-hidden />}
            </div>
            {errorCatalogo && (
              <p className="campo-error" role="alert">
                {errorCatalogo}
              </p>
            )}

            {buscaProducto.trim() !== "" && (
              <ul className="rp-resultados" role="listbox" aria-label="Productos encontrados">
                {coincidencias.length === 0 && <li className="rp-lista-vacia">Ningún producto activo coincide.</li>}
                {coincidencias.map(({ producto, presentacion }) => {
                  const imagen = presentacion.imagen_url || producto.imagen_url;
                  return (
                    <li key={`${producto.id}-${presentacion.id}`}>
                      <button type="button" className="rp-resultado" onClick={() => agregar(producto, presentacion)}>
                        <span className="rp-miniatura" aria-hidden>
                          {imagen ? <img src={imagen} alt="" loading="lazy" /> : <ImageOff size={16} />}
                        </span>
                        <span className="rp-resultado-texto">
                          <span className="rp-opcion-nombre">{producto.nombre_producto}</span>
                          <span className="rp-opcion-meta">
                            {presentacion.nombre_presentacion} ·{" "}
                            {presentacion.unidad_venta_abreviatura || presentacion.unidad_venta_nombre}
                          </span>
                        </span>
                        <span className="rp-resultado-precio">{formatoPrecio(presentacion.precio_unitario)}</span>
                        <span className="rp-resultado-mas" aria-hidden>
                          <Plus size={15} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {formManual ? (
              <div className="rp-manual-form" role="group" aria-label="Producto manual">
                <div className="campo">
                  <label htmlFor="rp-man-nombre">Producto *</label>
                  <input
                    id="rp-man-nombre"
                    type="text"
                    autoFocus
                    value={formManual.nombre}
                    onChange={(e) => setFormManual({ ...formManual, nombre: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), guardarManual())}
                    placeholder="Lo que no está en el catálogo"
                  />
                </div>
                <div className="campo">
                  <label htmlFor="rp-man-cant">Cantidad *</label>
                  <input
                    id="rp-man-cant"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={formManual.cantidad}
                    onChange={(e) => setFormManual({ ...formManual, cantidad: e.target.value })}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="rp-man-unidad">Unidad</label>
                  <select
                    id="rp-man-unidad"
                    value={formManual.unidadId ?? ""}
                    onChange={(e) => setFormManual({ ...formManual, unidadId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">{unidades ? "Sin unidad" : "Cargando…"}</option>
                    {unidades?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre_unidad}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="rp-man-precio">Precio unitario</label>
                  <input
                    id="rp-man-precio"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={formManual.precio}
                    onChange={(e) => setFormManual({ ...formManual, precio: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
                <div className="rp-manual-acciones">
                  <button type="button" className="btn secundario sm" onClick={() => setFormManual(null)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primario sm"
                    onClick={guardarManual}
                    disabled={!formManual.nombre.trim() || !(num(formManual.cantidad) > 0)}
                  >
                    <Plus size={15} /> Añadir
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="rp-boton-manual" onClick={() => setFormManual({ ...MANUAL_VACIO })}>
                <PencilLine size={15} /> Agregar producto manual
              </button>
            )}
          </div>

          <div className="rp-seleccion-cab">
            <h4>Productos del pedido</h4>
            {cantidadProductos > 0 && <span className="rp-contador">{cantidadProductos}</span>}
          </div>

          {cantidadProductos === 0 ? (
            <div className={`rp-vacio ${intento.productos ? "rp-vacio--error" : ""}`} role={intento.productos ? "alert" : undefined}>
              {intento.productos
                ? "Agrega al menos un producto para continuar."
                : "Busca un producto arriba o agrega uno manual."}
            </div>
          ) : (
            <ul className="rp-lineas">
              {lineas.map((l) => {
                const imagen = l.presentacion.imagen_url || l.producto.imagen_url;
                const otras = l.producto.presentaciones.filter((p) => p.estado_presentacion);
                const invalida = lineasInvalidas.has(l.clave);
                return (
                  <li key={l.clave} className="rp-linea">
                    <span className="rp-miniatura" aria-hidden>
                      {imagen ? <img src={imagen} alt="" loading="lazy" /> : <ImageOff size={16} />}
                    </span>
                    <div className="rp-linea-info">
                      <strong>{l.producto.nombre_producto}</strong>
                      {otras.length > 1 ? (
                        <select
                          className="rp-linea-pres-select"
                          value={l.presentacion.id}
                          onChange={(e) => cambiarPresentacion(l, Number(e.target.value))}
                          aria-label={`Presentación de ${l.producto.nombre_producto}`}
                        >
                          {otras.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre_presentacion} · {formatoPrecio(p.precio_unitario)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rp-linea-pres">{l.presentacion.nombre_presentacion}</span>
                      )}
                      <span className="rp-linea-unitario">
                        {formatoPrecio(l.presentacion.precio_unitario)} /{" "}
                        {l.presentacion.unidad_venta_abreviatura || l.presentacion.unidad_venta_nombre}
                      </span>
                    </div>
                    <div className={`rp-cantidad-control ${invalida ? "campo-invalido" : ""}`}>
                      <button type="button" onClick={() => pasoCantidad(l, -1)} aria-label={`Menos ${l.producto.nombre_producto}`}>
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={l.presentacion.cantidad_minima || "0"}
                        step={l.presentacion.incremento_cantidad || "1"}
                        value={l.cantidad}
                        onChange={(e) => cambiarCantidad(l.clave, e.target.value)}
                        aria-label={`Cantidad de ${l.producto.nombre_producto}`}
                        aria-invalid={invalida || undefined}
                      />
                      <button type="button" onClick={() => pasoCantidad(l, 1)} aria-label={`Más ${l.producto.nombre_producto}`}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="rp-linea-subtotal">{formatoPrecio(subtotalLinea(l))}</span>
                    <Tooltip label="Quitar del pedido">
                      <button
                        type="button"
                        className="btn-icon peligro"
                        onClick={() => quitar(l.clave)}
                        aria-label={`Quitar ${l.producto.nombre_producto}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </Tooltip>
                  </li>
                );
              })}
              {manuales.map((m) => {
                const invalido = manualesInvalidos.has(m.id);
                return (
                  <li key={`m-${m.id}`} className="rp-linea rp-linea--manual">
                    <span className="rp-miniatura rp-miniatura--manual" aria-hidden>
                      <PencilLine size={16} />
                    </span>
                    <div className="rp-linea-info">
                      <input
                        className="rp-linea-nombre-input"
                        value={m.nombre}
                        onChange={(e) => cambiarManual(m.id, { nombre: e.target.value })}
                        aria-label="Nombre del producto manual"
                      />
                      <span className="rp-etiqueta-manual">Manual{m.unidadId ? ` · ${nombreUnidad(m.unidadId)}` : ""}</span>
                      <label className="rp-linea-precio">
                        $
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={m.precio}
                          onChange={(e) => cambiarManual(m.id, { precio: e.target.value })}
                          placeholder="Sin precio"
                          aria-label={`Precio de ${m.nombre}`}
                        />
                      </label>
                    </div>
                    <div className={`rp-cantidad-control ${invalido ? "campo-invalido" : ""}`}>
                      <button
                        type="button"
                        onClick={() => cambiarManual(m.id, { cantidad: String(Math.max(1, num(m.cantidad) - 1)) })}
                        aria-label={`Menos ${m.nombre}`}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={m.cantidad}
                        onChange={(e) => cambiarManual(m.id, { cantidad: e.target.value })}
                        aria-label={`Cantidad de ${m.nombre}`}
                        aria-invalid={invalido || undefined}
                      />
                      <button
                        type="button"
                        onClick={() => cambiarManual(m.id, { cantidad: String(num(m.cantidad) + 1) })}
                        aria-label={`Más ${m.nombre}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="rp-linea-subtotal">{m.precio.trim() ? formatoPrecio(subtotalManual(m)) : "—"}</span>
                    <Tooltip label="Quitar del pedido">
                      <button
                        type="button"
                        className="btn-icon peligro"
                        onClick={() => setManuales((prev) => prev.filter((x) => x.id !== m.id))}
                        aria-label={`Quitar ${m.nombre}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          )}
          {intento.productos && cantidadProductos > 0 && !productosValidos && (
            <p className="campo-error" role="alert">
              Revisa las cantidades marcadas: deben ser mayores que cero.
            </p>
          )}
        </section>
      )}

      {paso === "confirmar" && (
        <section className="rp-paso rp-confirmar" aria-labelledby="rp-titulo-confirmar">
          <h3 className="rp-titulo" id="rp-titulo-confirmar" tabIndex={-1}>
            Revisa y confirma
          </h3>

          <div className="rp-panel rp-resumen-cliente">
            <span className="rp-avatar" aria-hidden>
              {iniciales(nombreCliente)}
            </span>
            <div className="rp-resumen-cliente-datos">
              <strong>{nombreCliente}</strong>
              {clienteVista && contactoCliente(clienteVista) && <span>Contacto: {contactoCliente(clienteVista)}</span>}
              <span>
                {clienteVista?.telefono || "Sin teléfono"}
                {" · "}
                {clienteVista?.direccion || "Sin dirección"}
              </span>
              {modoCliente === "nuevo" && <span className="rp-etiqueta-nuevo">Cliente nuevo</span>}
            </div>
            <button type="button" className="rp-editar" onClick={() => irA("cliente")}>
              Editar
            </button>
          </div>

          <div className="rp-panel rp-resumen-productos">
            <div className="rp-resumen-cab">
              <h4>Productos</h4>
              <button type="button" className="rp-editar" onClick={() => irA("productos")}>
                Editar
              </button>
            </div>
            <table className="rp-tabla-resumen">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.clave}>
                    <td>
                      {l.producto.nombre_producto}
                      <small> · {l.presentacion.nombre_presentacion}</small>
                    </td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num">{formatoPrecio(l.presentacion.precio_unitario)}</td>
                    <td className="num">{formatoPrecio(subtotalLinea(l))}</td>
                  </tr>
                ))}
                {manuales.map((m) => (
                  <tr key={`m-${m.id}`}>
                    <td>
                      {m.nombre}
                      <small> · manual{m.unidadId ? ` · ${nombreUnidad(m.unidadId)}` : ""}</small>
                    </td>
                    <td className="num">{m.cantidad}</td>
                    <td className="num">{m.precio.trim() ? formatoPrecio(m.precio) : "—"}</td>
                    <td className="num">{m.precio.trim() ? formatoPrecio(subtotalManual(m)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="num">{formatoPrecio(total)}</td>
                </tr>
              </tfoot>
            </table>
            {manuales.some((m) => !m.precio.trim()) && (
              <p className="rp-ayuda">Los productos manuales sin precio suman $0; se ajustan después en el pedido.</p>
            )}
          </div>

          <div className="rp-panel">
            <fieldset className="rp-canal">
              <legend>¿Por dónde llegó el pedido?</legend>
              <div className="rp-canal-opciones">
                {CANALES.map(({ valor, etiqueta, Icono }) => (
                  <button
                    key={valor}
                    type="button"
                    className={`rp-canal-opcion ${canal === valor ? "activo" : ""}`}
                    aria-pressed={canal === valor}
                    data-campo-valor={canal === valor ? valor : ""}
                    onClick={() => setCanal(canal === valor ? "" : valor)}
                  >
                    <Icono size={16} /> {etiqueta}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="campo rp-obs">
              <label htmlFor="rp-obs">Observaciones</label>
              <textarea
                id="rp-obs"
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="A qué hora lo quiere, quién lo recibe, algo a tener en cuenta…"
              />
            </div>
          </div>
        </section>
      )}
    </Modal>
  );
}

// ==================================================================== paso 1
function PasoCliente({
  modo,
  onModo,
  buscar,
  onBuscar,
  clientes,
  cargando,
  elegido,
  onElegir,
  nuevo,
  onNuevo,
  mostrarError,
}: {
  modo: ModoCliente;
  onModo: (m: ModoCliente) => void;
  buscar: string;
  onBuscar: (v: string) => void;
  clientes: Cliente[];
  cargando: boolean;
  elegido: Cliente | null;
  onElegir: (c: Cliente | null) => void;
  nuevo: ClienteNuevo;
  onNuevo: (v: ClienteNuevo) => void;
  mostrarError: boolean;
}) {
  return (
    <section className="rp-paso" aria-labelledby="rp-titulo-cliente">
      <h3 className="rp-titulo" id="rp-titulo-cliente" tabIndex={-1}>
        ¿De quién es el pedido?
      </h3>
      <div className="segmentado rp-segmentado">
        <button type="button" className={modo === "existente" ? "activo" : ""} onClick={() => onModo("existente")}>
          <Users size={14} /> Cliente existente
        </button>
        <button type="button" className={modo === "nuevo" ? "activo" : ""} onClick={() => onModo("nuevo")}>
          <UserPlus size={14} /> Cliente nuevo
        </button>
      </div>

      {modo === "existente" ? (
        elegido ? (
          <div className="rp-panel rp-cliente-tarjeta">
            <span className="rp-avatar" aria-hidden>
              {iniciales(tituloCliente(elegido))}
            </span>
            <div className="rp-cliente-datos">
              <strong>{tituloCliente(elegido)}</strong>
              {contactoCliente(elegido) && (
                <span>
                  <UserRound size={13} aria-hidden /> Contacto: {contactoCliente(elegido)}
                </span>
              )}
              <span>
                <Phone size={13} aria-hidden /> {elegido.telefono_cliente || "Sin teléfono"}
              </span>
              <span>
                <MapPin size={13} aria-hidden /> {elegido.direccion_cliente || "Sin dirección"}
              </span>
            </div>
            <button type="button" className="btn secundario sm" onClick={() => onElegir(null)}>
              <X size={14} /> Cambiar
            </button>
          </div>
        ) : (
          <div className="rp-panel">
            <div className={`buscador rp-buscador ${mostrarError ? "campo-invalido" : ""}`}>
              <Search size={15} />
              <input
                type="text"
                autoFocus
                value={buscar}
                onChange={(e) => onBuscar(e.target.value)}
                placeholder="Buscar por negocio, contacto o teléfono…"
                data-sin-cambios
                aria-label="Buscar cliente"
              />
              {cargando && <Loader2 size={15} className="girando rp-carga" aria-hidden />}
            </div>
            <ul className="rp-resultados rp-resultados--clientes" role="listbox" aria-label="Clientes">
              {cargando && clientes.length === 0 && <li className="rp-lista-vacia">Buscando…</li>}
              {!cargando && clientes.length === 0 && (
                <li className="rp-lista-vacia">
                  Ningún cliente coincide.{" "}
                  <button type="button" className="rp-enlace" onClick={() => onModo("nuevo")}>
                    Registrar uno nuevo
                  </button>
                </li>
              )}
              {clientes.slice(0, 30).map((c) => (
                <li key={c.id}>
                  <button type="button" className="rp-resultado" onClick={() => onElegir(c)}>
                    <span className="rp-avatar rp-avatar--sm" aria-hidden>
                      {iniciales(tituloCliente(c))}
                    </span>
                    <span className="rp-resultado-texto">
                      <span className="rp-opcion-nombre">{tituloCliente(c)}</span>
                      <span className="rp-opcion-meta">
                        {contactoCliente(c) ? `Contacto: ${contactoCliente(c)} · ` : ""}
                        {c.telefono_cliente || "sin teléfono"}
                        {c.direccion_cliente ? ` · ${c.direccion_cliente}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div className="rp-panel rp-nuevo">
          <div className="fila">
            <div className="campo">
              <label htmlFor="rp-negocio">Negocio</label>
              <input
                id="rp-negocio"
                type="text"
                autoFocus
                value={nuevo.negocio}
                onChange={(e) => onNuevo({ ...nuevo, negocio: e.target.value })}
                placeholder="Restaurante El Fogón"
              />
            </div>
            <div className="campo">
              <label htmlFor="rp-nombre">Persona de contacto *</label>
              <input
                id="rp-nombre"
                type="text"
                value={nuevo.nombre}
                onChange={(e) => onNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Quien hace el pedido"
                className={mostrarError ? "campo-invalido" : undefined}
                aria-invalid={mostrarError || undefined}
              />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label htmlFor="rp-telefono">Teléfono</label>
              <input
                id="rp-telefono"
                type="tel"
                value={nuevo.telefono}
                onChange={(e) => onNuevo({ ...nuevo, telefono: e.target.value })}
                placeholder="300 123 4567"
              />
            </div>
            <div className="campo">
              <label htmlFor="rp-direccion">Dirección de entrega</label>
              <input
                id="rp-direccion"
                type="text"
                value={nuevo.direccion}
                onChange={(e) => onNuevo({ ...nuevo, direccion: e.target.value })}
                placeholder="Calle 1 # 2-3"
              />
            </div>
          </div>
          <p className="rp-ayuda">
            Con la persona de contacto basta para apuntar el pedido; el resto se completa después en la ficha del cliente.
          </p>
        </div>
      )}

      {mostrarError && (
        <p className="campo-error" role="alert">
          {modo === "existente"
            ? "Elige un cliente de la lista para continuar."
            : "Escribe el nombre de la persona de contacto para continuar."}
        </p>
      )}
    </section>
  );
}
