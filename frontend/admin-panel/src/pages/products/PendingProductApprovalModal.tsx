import {
  ArrowRight,
  BookPlus,
  CalendarClock,
  Check,
  Info,
  Link2,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Store,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  aprobarProductoPendiente,
  obtenerProductos,
  rechazarProductoPendiente,
  vincularProductoPendiente,
  type ProductoPayload,
} from "../../api/resources";
import { Modal } from "../../components/Modal";
import type { Categoria, Presentacion, Producto, ProductoPendiente, UnidadMedida } from "../../types";
import { extraerMensajeError, formatoPrecio, normalizarTexto } from "../../utils";
import { alertaExito, confirmarDescartar, confirmarRechazo } from "../../utils/alertas";
import { cantidadValida, describirRegla, formatearCantidad, PRESETS_CANTIDAD } from "../../utils/cantidades";
import { aDecimalApi, aNumero, validarPrecio } from "../orders/gestion/modelo";
import { BotonAccion, Esqueleto, Miniatura } from "../orders/gestion/piezas";
import type { EstadoAccion } from "../orders/gestion/useGestionPedido";
import { fechaHoraLarga } from "../orders/gestion/CabeceraPedido";
import { EstadoPedido } from "../orders/pedidosUi";
import "../orders/gestion/gestionPedido.css";
import "./aprobacionProducto.css";

type Modo = "crear" | "vincular";
type IdPreset = (typeof PRESETS_CANTIDAD)[number]["id"];

/** `tipo_cantidad` del producto según el atajo elegido (ver `Producto.tipo_cantidad`). */
const TIPO_POR_PRESET: Record<IdPreset, string> = { entero: "entero", medio: "medio", cuarto: "cuarto" };

interface PresFila {
  clave: number;
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
  /** Tras aceptar, vincular o rechazar: la lista se recarga. */
  onAprobado: () => void;
}

// ---------- Parecidos en el catálogo ----------

const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "x", "por", "con", "en", "y", "a"]);

function palabras(texto: string): string[] {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9ñ ]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 1 && !VACIAS.has(p))
    // Plural sencillo: «papas» y «papa» son lo mismo para buscar.
    .map((p) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p));
}

/** 0 a 1: cuánto se parece lo que escribió el cliente a un producto del catálogo. */
function parecido(escrito: string, producto: string): number {
  const a = palabras(escrito);
  const b = palabras(producto);
  if (!a.length || !b.length) return 0;
  let coincidencias = 0;
  for (const p of a) if (b.some((q) => q === p || (p.length > 3 && (q.startsWith(p) || p.startsWith(q))))) coincidencias += 1;
  return coincidencias / Math.max(a.length, b.length);
}

export function PendingProductApprovalModal({ pendiente, categorias, unidades, onCerrar, onAprobado }: Props) {
  const [modo, setModo] = useState<Modo>("crear");
  const [catalogo, setCatalogo] = useState<Producto[] | null>(null);
  const [estado, setEstado] = useState<EstadoAccion>("inactivo");
  const [estadoRechazo, setEstadoRechazo] = useState<EstadoAccion>("inactivo");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(false);
  const enviando = useRef(false);

  // ---- Crear
  const [nombre, setNombre] = useState(() => {
    const t = pendiente.nombre_personalizado.trim();
    return t ? t[0].toUpperCase() + t.slice(1) : "";
  });
  const [categoria, setCategoria] = useState<number | "">(pendiente.categoria_id ?? "");
  const [unidadBase, setUnidadBase] = useState<number | "">(pendiente.unidad_id ?? "");
  const [preset, setPreset] = useState<IdPreset>("entero");
  const contador = useRef(1);
  const [presentaciones, setPresentaciones] = useState<PresFila[]>([
    {
      clave: 0,
      nombre_presentacion: pendiente.unidad_nombre ? `Por ${pendiente.unidad_nombre.toLowerCase()}` : "",
      unidad_venta: pendiente.unidad_id ?? "",
      factor_conversion: "1",
      precio_unitario: Number(pendiente.precio_unitario) > 0 ? String(Number(pendiente.precio_unitario)) : "",
    },
  ]);
  const [delPedido, setDelPedido] = useState(0);

  // ---- Vincular
  const [busqueda, setBusqueda] = useState("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [presentacion, setPresentacion] = useState<Presentacion | null>(null);

  // ---- Efecto en el pedido
  const precioLinea = Number(pendiente.precio_unitario) || 0;
  const [conservarPrecio, setConservarPrecio] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerProductos({ estado: "activos" })
      .then((p) => vivo && setCatalogo(p.filter((x) => x.presentaciones.length > 0)))
      .catch(() => vivo && setCatalogo([]));
    return () => {
      vivo = false;
    };
  }, []);

  // Corregir algo después de un error devuelve el botón a su estado normal y
  // retira el aviso: la persona ya está en ello (igual que en el modal de pedidos).
  useEffect(() => {
    setEstado((e) => (e === "error" ? "inactivo" : e));
    setError(null);
  }, [nombre, categoria, unidadBase, preset, presentaciones, delPedido, modo, producto, presentacion]);

  const parecidos = useMemo(
    () =>
      (catalogo ?? [])
        .map((p) => ({ p, puntaje: parecido(pendiente.nombre_personalizado, p.nombre_producto) }))
        .filter((x) => x.puntaje >= 0.5)
        .sort((a, b) => b.puntaje - a.puntaje)
        .slice(0, 4),
    [catalogo, pendiente.nombre_personalizado]
  );

  // Si el catálogo ya tiene algo casi idéntico, se propone vincular de entrada.
  const yaPropuesto = useRef(false);
  useEffect(() => {
    if (yaPropuesto.current || !parecidos.length) return;
    yaPropuesto.current = true;
    if (parecidos[0].puntaje >= 0.99) elegirParaVincular(parecidos[0].p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parecidos]);

  const resultados = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    const lista = catalogo ?? [];
    if (!q) return parecidos.length ? parecidos.map((x) => x.p) : lista.slice(0, 30);
    return lista.filter((p) => normalizarTexto(p.nombre_producto).includes(q)).slice(0, 40);
  }, [busqueda, catalogo, parecidos]);

  const duplicadoExacto = useMemo(
    () => (catalogo ?? []).find((p) => normalizarTexto(p.nombre_producto.trim()) === normalizarTexto(nombre.trim())),
    [catalogo, nombre]
  );

  function elegirParaVincular(p: Producto) {
    setModo("vincular");
    setProducto(p);
    const coincideUnidad = p.presentaciones.find((x) => x.unidad_venta === pendiente.unidad_id);
    setPresentacion(coincideUnidad ?? p.presentaciones[0] ?? null);
    setError(null);
  }

  // ---------- Validación (crear) ----------

  const regla = PRESETS_CANTIDAD.find((p) => p.id === preset)!;
  const erroresCrear = useMemo(() => {
    const e: { nombre?: string; categoria?: string; pres: Record<number, Partial<Record<keyof PresFila, string>>> } = {
      pres: {},
    };
    if (!nombre.trim()) e.nombre = "Escribe el nombre del producto.";
    else if (duplicadoExacto) e.nombre = `Ya existe «${duplicadoExacto.nombre_producto}» en el catálogo: vincúlalo en vez de duplicarlo.`;
    if (categoria === "") e.categoria = "Elige la categoría.";
    const vistas = new Set<string>();
    presentaciones.forEach((p) => {
      const f: Partial<Record<keyof PresFila, string>> = {};
      if (!p.nombre_presentacion.trim()) f.nombre_presentacion = "Escribe el nombre.";
      if (p.unidad_venta === "") f.unidad_venta = "Elige la unidad.";
      const factor = aNumero(p.factor_conversion);
      if (!(factor > 0)) f.factor_conversion = "Debe ser mayor que 0.";
      const precio = validarPrecio(p.precio_unitario);
      if (precio) f.precio_unitario = precio;
      const clave = `${normalizarTexto(p.nombre_presentacion.trim())}|${p.unidad_venta}`;
      if (!f.nombre_presentacion && vistas.has(clave)) f.nombre_presentacion = "Repite otra presentación.";
      vistas.add(clave);
      if (Object.keys(f).length) e.pres[p.clave] = f;
    });
    return e;
  }, [nombre, duplicadoExacto, categoria, presentaciones]);
  const crearValido = !erroresCrear.nombre && !erroresCrear.categoria && Object.keys(erroresCrear.pres).length === 0;

  // ---------- Efecto en el pedido ----------

  const presDelPedido = presentaciones[delPedido] ?? presentaciones[0];
  const precioCatalogo =
    modo === "vincular" ? (presentacion ? Number(presentacion.precio_unitario) : null) : aNumero(presDelPedido?.precio_unitario);
  const precioFinal = conservarPrecio ? precioLinea : Number.isFinite(precioCatalogo ?? NaN) ? (precioCatalogo as number) : 0;
  const cantidad = Number(pendiente.cantidad) || 0;
  const unidadFinal =
    modo === "vincular"
      ? presentacion?.unidad_venta_nombre
      : unidades.find((u) => u.id === presDelPedido?.unidad_venta)?.nombre_unidad;
  const unidadCambia = Boolean(unidadFinal && pendiente.unidad_nombre && unidadFinal !== pendiente.unidad_nombre);

  const sucio =
    modo === "vincular" ||
    nombre.trim() !== pendiente.nombre_personalizado.trim() ||
    presentaciones.length > 1 ||
    presentaciones.some((p) => p.nombre_presentacion.trim() && p.precio_unitario.trim());

  // ---------- Acciones ----------

  async function cerrar() {
    if (estado === "cargando") return;
    if (sucio && estado !== "exito" && !(await confirmarDescartar("Lo que completaste para este producto se perderá."))) return;
    onCerrar();
  }

  async function confirmar(e?: FormEvent) {
    e?.preventDefault();
    if (enviando.current) return;
    setIntento(true);
    setError(null);
    if (modo === "crear" && !crearValido) {
      setError("Revisa los campos marcados antes de crear el producto.");
      setEstado("error");
      // Lleva a la persona al primer campo por corregir, aunque esté más abajo.
      window.requestAnimationFrame(() => {
        const campo = document.querySelector<HTMLElement>(".modal-aprobacion .invalido");
        campo?.scrollIntoView({ block: "center", behavior: "smooth" });
        (campo?.matches("input, select") ? campo : campo?.querySelector<HTMLElement>("input"))?.focus({ preventScroll: true });
      });
      return;
    }
    if (modo === "vincular" && !presentacion) {
      setError("Elige el producto y la presentación del catálogo.");
      setEstado("error");
      return;
    }
    enviando.current = true;
    setEstado("cargando");
    try {
      if (modo === "crear") {
        const payload: ProductoPayload = {
          nombre_producto: nombre.trim(),
          categoria: Number(categoria),
          unidad_base: unidadBase === "" ? null : Number(unidadBase),
          tipo_cantidad: TIPO_POR_PRESET[preset],
          permite_fraccion: preset !== "entero",
          // Nace sin control de existencias: nadie ha contado todavía cuántas
          // hay de un producto que acaba de existir.
          controla_stock: false,
          codigo_barras: "",
          estado_producto: true,
          presentaciones: presentaciones.map((p) => ({
            nombre_presentacion: p.nombre_presentacion.trim(),
            unidad_venta: Number(p.unidad_venta),
            factor_conversion: aDecimalApi(p.factor_conversion) ?? "1",
            precio_unitario: aDecimalApi(p.precio_unitario) ?? "0",
            cantidad_minima: aDecimalApi(regla.minima) ?? "1",
            incremento_cantidad: aDecimalApi(regla.incremento) ?? "1",
            decimales_cantidad: regla.decimales,
          })),
        };
        await aprobarProductoPendiente(
          pendiente.id,
          payload,
          presentaciones.length > 1 ? delPedido : undefined,
          conservarPrecio
        );
        void alertaExito(`«${nombre.trim()}» ya está en el catálogo`);
      } else {
        await vincularProductoPendiente(pendiente.id, presentacion!.id, conservarPrecio);
        void alertaExito(`Vinculado a ${producto!.nombre_producto}`);
      }
      setEstado("exito");
      window.setTimeout(onAprobado, 650);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo completar la revisión."));
      setEstado("error");
      enviando.current = false;
    }
  }

  async function rechazar() {
    if (enviando.current) return;
    const ok = await confirmarRechazo(
      `¿Rechazar «${pendiente.nombre_personalizado}»?`,
      `Seguirá en el pedido #${pendiente.pedido} tal como lo escribió el cliente, pero no se agregará al catálogo.`
    );
    if (!ok) return;
    enviando.current = true;
    setEstadoRechazo("cargando");
    try {
      await rechazarProductoPendiente(pendiente.id);
      setEstadoRechazo("exito");
      window.setTimeout(onAprobado, 500);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo rechazar el producto."));
      setEstadoRechazo("error");
      enviando.current = false;
    }
  }

  function cambiarPres(clave: number, cambio: Partial<PresFila>) {
    setPresentaciones((prev) => prev.map((p) => (p.clave === clave ? { ...p, ...cambio } : p)));
  }

  const ver = (texto: string | undefined) => (intento ? texto : undefined);

  // ---------- Render ----------

  return (
    <Modal
      amplio
      ancho
      expandible
      cerrarConEscape
      clase="modal-pedido modal-aprobacion"
      titulo="Revisar producto sugerido"
      onCerrar={cerrar}
      // `cerrar` ya pregunta antes de descartar: el modal no repite la pregunta.
      preguntaAlCerrar
      subtitulo={
        <span className="gp-meta">
          <span className="gp-meta-origen">
            <Sparkles size={13} aria-hidden="true" /> Sugerido por un cliente
          </span>
          <span className="gp-meta-dato">
            <UserRound size={13} aria-hidden="true" />
            <strong>{pendiente.cliente_nombre || "Cliente"}</strong>
          </span>
          <span className="gp-meta-dato">
            <Store size={13} aria-hidden="true" /> Pedido #{pendiente.pedido}
          </span>
          {pendiente.pedido_fecha && (
            <span className="gp-meta-dato">
              <CalendarClock size={13} aria-hidden="true" /> {fechaHoraLarga(pendiente.pedido_fecha)}
            </span>
          )}
        </span>
      }
      subcabecera={
        <div className="gp-pestanas" role="tablist" aria-label="Cómo aceptar el producto">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "crear"}
            className={`gp-pestana ${modo === "crear" ? "activa" : ""}`}
            onClick={() => setModo("crear")}
          >
            <BookPlus size={15} /> Crear producto nuevo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "vincular"}
            className={`gp-pestana ${modo === "vincular" ? "activa" : ""}`}
            onClick={() => setModo("vincular")}
          >
            <Link2 size={15} /> Vincular a uno existente
            {parecidos.length > 0 && <span className="gp-pestana-contador">{parecidos.length}</span>}
          </button>
        </div>
      }
      footer={
        <div className="gp-pie">
          <BotonAccion
            estado={estadoRechazo}
            clase="peligro"
            onClick={rechazar}
            icono={<XCircle size={16} aria-hidden="true" />}
            texto="Rechazar sugerencia"
            textoCargando="Rechazando…"
            textoExito="Rechazado"
            textoError="Reintentar"
            disabled={estado === "cargando" || estado === "exito"}
          />
          <div className="gp-pie-acciones">
            <button type="button" className="btn secundario" onClick={cerrar}>
              Cancelar
            </button>
            <BotonAccion
              estado={estado}
              clase="primario"
              onClick={() => void confirmar()}
              icono={modo === "crear" ? <BookPlus size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              texto={modo === "crear" ? "Crear y aceptar" : "Vincular y aceptar"}
              textoCargando="Guardando…"
              textoExito="Aceptado"
              textoError="Reintentar"
              disabled={estadoRechazo === "cargando" || estadoRechazo === "exito"}
            />
          </div>
        </div>
      }
    >
      {error && (
        <div className="gp-banner" role="alert">
          <XCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="ap-cuerpo">
        {/* ---------- Contexto: lo que pidió el cliente ---------- */}
        <aside className="ap-contexto">
          <section className="gp-superficie ap-pedido">
            <span className="gp-kpi-etiqueta">El cliente escribió</span>
            <p className="ap-escrito">«{pendiente.nombre_personalizado}»</p>
            <dl className="gp-ficha">
              <div>
                <dt>Cantidad</dt>
                <dd>
                  {formatearCantidad(pendiente.cantidad)} {pendiente.unidad_nombre || "unid."}
                </dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{pendiente.categoria_nombre || <span className="gp-tenue">Sin categoría</span>}</dd>
              </div>
              <div>
                <dt>Precio en el pedido</dt>
                <dd>{precioLinea > 0 ? formatoPrecio(precioLinea) : <span className="gp-tenue">Sin precio</span>}</dd>
              </div>
              <div>
                <dt>Pedido</dt>
                <dd>
                  #{pendiente.pedido} {pendiente.pedido_estado && <EstadoPedido estado={pendiente.pedido_estado} />}
                </dd>
              </div>
            </dl>
            {pendiente.nota && (
              <p className="ap-nota">
                <MessageSquareText size={14} aria-hidden="true" /> {pendiente.nota}
              </p>
            )}
          </section>

          <section className="gp-superficie">
            <header className="gp-superficie-cabecera">
              <h3>
                <Search size={15} /> Parecidos en el catálogo
              </h3>
            </header>
            {catalogo === null ? (
              <div style={{ display: "grid", gap: 8 }}>
                <Esqueleto />
                <Esqueleto ancho="70%" />
              </div>
            ) : parecidos.length === 0 ? (
              <p className="gp-tenue gp-sin-dato">
                No hay productos parecidos: puedes crearlo sin riesgo de duplicarlo.
              </p>
            ) : (
              <ul className="ap-parecidos">
                {parecidos.map(({ p, puntaje }) => (
                  <li key={p.id}>
                    <Miniatura src={p.imagen_url} nombre={p.nombre_producto} />
                    <span className="gp-lista-nombre">
                      {p.nombre_producto}
                      <small>
                        {p.categoria_nombre} · {puntaje >= 0.99 ? "mismo nombre" : `${Math.round(puntaje * 100)} % parecido`}
                      </small>
                    </span>
                    <button type="button" className="gp-enlace" onClick={() => elegirParaVincular(p)}>
                      Vincular <ArrowRight size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* ---------- Decisión ---------- */}
        <div className="ap-principal">
          {modo === "crear" ? (
            <form className="ap-formulario" onSubmit={confirmar} noValidate>
              <section className="gp-superficie ap-seccion">
                <header className="gp-superficie-cabecera">
                  <h3>
                    <span className="ap-paso">1</span> Identidad del producto
                  </h3>
                </header>
                <div className="gp-campo">
                  <label htmlFor="ap-nombre">Nombre en el catálogo</label>
                  <input
                    id="ap-nombre"
                    className={`gp-input ${ver(erroresCrear.nombre) ? "invalido" : ""}`}
                    value={nombre}
                    maxLength={200}
                    onChange={(e) => setNombre(e.target.value)}
                    aria-invalid={Boolean(ver(erroresCrear.nombre))}
                  />
                  {duplicadoExacto ? (
                    <small className="gp-ayuda aviso">
                      Ya existe «{duplicadoExacto.nombre_producto}».{" "}
                      <button type="button" className="gp-enlace" onClick={() => elegirParaVincular(duplicadoExacto)}>
                        Vincular a ese
                      </button>
                    </small>
                  ) : ver(erroresCrear.nombre) ? (
                    <small className="gp-error-campo">{erroresCrear.nombre}</small>
                  ) : (
                    <small className="gp-ayuda">Corrige mayúsculas o tildes: así lo verán todos los clientes.</small>
                  )}
                </div>
                <div className="gp-fila-campos">
                  <div className="gp-campo">
                    <label htmlFor="ap-categoria">Categoría</label>
                    <select
                      id="ap-categoria"
                      className={`gp-input ${ver(erroresCrear.categoria) ? "invalido" : ""}`}
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value === "" ? "" : Number(e.target.value))}
                    >
                      <option value="">Selecciona…</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre_categoria}
                        </option>
                      ))}
                    </select>
                    {ver(erroresCrear.categoria) && <small className="gp-error-campo">{erroresCrear.categoria}</small>}
                  </div>
                  <div className="gp-campo">
                    <label htmlFor="ap-unidad-base">
                      Unidad base <span className="gp-tenue">(opcional)</span>
                    </label>
                    <select
                      id="ap-unidad-base"
                      className="gp-input"
                      value={unidadBase}
                      onChange={(e) => setUnidadBase(e.target.value === "" ? "" : Number(e.target.value))}
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
              </section>

              <section className="gp-superficie ap-seccion">
                <header className="gp-superficie-cabecera">
                  <h3>
                    <span className="ap-paso">2</span> Cómo se vende
                  </h3>
                </header>
                <div className="ap-presets" role="radiogroup" aria-label="Regla de cantidad">
                  {PRESETS_CANTIDAD.map((p) => (
                    <label key={p.id} className={`gp-opcion ${preset === p.id ? "activa" : ""}`}>
                      <input type="radio" name="ap-preset" checked={preset === p.id} onChange={() => setPreset(p.id)} />
                      <span className="gp-opcion-texto">
                        <strong>{p.titulo}</strong>
                        <small>{p.ejemplo}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {!cantidadValida(pendiente.cantidad, regla.minima, regla.incremento, regla.decimales) && (
                    <p className="gp-aviso-suave">
                      <Info size={14} aria-hidden="true" /> El cliente pidió {formatearCantidad(pendiente.cantidad)}: con
                      esta regla ({describirRegla(regla.minima, regla.incremento)}) no podría volver a pedirlo igual.
                    </p>
                  )}
              </section>

              <section className="gp-superficie ap-seccion">
                <header className="gp-superficie-cabecera">
                  <h3>
                    <span className="ap-paso">3</span> Presentaciones
                  </h3>
                  <button
                    type="button"
                    className="gp-enlace"
                    onClick={() =>
                      setPresentaciones((prev) => [
                        ...prev,
                        {
                          clave: contador.current++,
                          nombre_presentacion: "",
                          unidad_venta: "",
                          factor_conversion: "1",
                          precio_unitario: "",
                        },
                      ])
                    }
                  >
                    <Plus size={14} /> Agregar presentación
                  </button>
                </header>
                <div className="ap-presentaciones">
                  {presentaciones.map((p, i) => {
                    const f = erroresCrear.pres[p.clave] ?? {};
                    return (
                      <div key={p.clave} className={`ap-pres ${delPedido === i ? "del-pedido" : ""}`}>
                        <div className="ap-pres-cabecera">
                          <span className="ap-pres-num">{i + 1}</span>
                          {presentaciones.length > 1 ? (
                            <label className="ap-pres-pedido">
                              <input
                                type="radio"
                                name="ap-del-pedido"
                                checked={delPedido === i}
                                onChange={() => setDelPedido(i)}
                              />
                              La que pidió el cliente
                            </label>
                          ) : (
                            <span className="gp-marca original">Se enlaza al pedido</span>
                          )}
                          {presentaciones.length > 1 && (
                            <button
                              type="button"
                              className="btn-icon peligro"
                              aria-label={`Quitar la presentación ${i + 1}`}
                              onClick={() => {
                                setPresentaciones((prev) => prev.filter((x) => x.clave !== p.clave));
                                setDelPedido((d) => (d === i ? 0 : d > i ? d - 1 : d));
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="ap-pres-campos">
                          <div className="gp-campo">
                            <label htmlFor={`ap-pn-${p.clave}`}>Nombre</label>
                            <input
                              id={`ap-pn-${p.clave}`}
                              className={`gp-input ${ver(f.nombre_presentacion) ? "invalido" : ""}`}
                              placeholder="Ej.: Por kilo, Bulto 25 kg"
                              value={p.nombre_presentacion}
                              onChange={(e) => cambiarPres(p.clave, { nombre_presentacion: e.target.value })}
                            />
                            {ver(f.nombre_presentacion) && <small className="gp-error-campo">{f.nombre_presentacion}</small>}
                          </div>
                          <div className="gp-campo">
                            <label htmlFor={`ap-pu-${p.clave}`}>Unidad de venta</label>
                            <select
                              id={`ap-pu-${p.clave}`}
                              className={`gp-input ${ver(f.unidad_venta) ? "invalido" : ""}`}
                              value={p.unidad_venta}
                              onChange={(e) =>
                                cambiarPres(p.clave, { unidad_venta: e.target.value === "" ? "" : Number(e.target.value) })
                              }
                            >
                              <option value="">Selecciona…</option>
                              {unidades.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nombre_unidad}
                                </option>
                              ))}
                            </select>
                            {ver(f.unidad_venta) && <small className="gp-error-campo">{f.unidad_venta}</small>}
                          </div>
                          <div className="gp-campo">
                            <label htmlFor={`ap-pf-${p.clave}`}>Factor</label>
                            <input
                              id={`ap-pf-${p.clave}`}
                              className={`gp-input num ${ver(f.factor_conversion) ? "invalido" : ""}`}
                              inputMode="decimal"
                              value={p.factor_conversion}
                              onChange={(e) => cambiarPres(p.clave, { factor_conversion: e.target.value })}
                              title="Cuántas unidades base contiene (1 si es la misma)"
                            />
                            {ver(f.factor_conversion) && <small className="gp-error-campo">{f.factor_conversion}</small>}
                          </div>
                          <div className="gp-campo">
                            <label htmlFor={`ap-pp-${p.clave}`}>Precio</label>
                            <div className={`gp-precio-campo ${ver(f.precio_unitario) ? "invalido" : ""}`}>
                              <span aria-hidden="true">$</span>
                              <input
                                id={`ap-pp-${p.clave}`}
                                inputMode="decimal"
                                placeholder="0"
                                value={p.precio_unitario}
                                onChange={(e) => cambiarPres(p.clave, { precio_unitario: e.target.value })}
                              />
                            </div>
                            {ver(f.precio_unitario) && <small className="gp-error-campo">{f.precio_unitario}</small>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <button type="submit" hidden aria-hidden="true" />
            </form>
          ) : (
            <div className="ap-formulario">
              <section className="gp-superficie ap-seccion">
                <header className="gp-superficie-cabecera">
                  <h3>
                    <span className="ap-paso">1</span> Producto del catálogo
                  </h3>
                </header>
                <label className="gp-buscador">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Buscar en el catálogo…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    aria-label="Buscar en el catálogo"
                  />
                </label>
                <div className="ap-resultados" role="listbox" aria-label="Productos del catálogo">
                  {catalogo === null ? (
                    <Esqueleto alto={40} />
                  ) : resultados.length === 0 ? (
                    <p className="gp-panel-vacio">Ningún producto coincide.</p>
                  ) : (
                    resultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={producto?.id === p.id}
                        className={`gp-resultado ${producto?.id === p.id ? "elegido" : ""}`}
                        onClick={() => elegirParaVincular(p)}
                      >
                        <Miniatura src={p.imagen_url} nombre={p.nombre_producto} />
                        <span className="gp-resultado-texto">
                          <strong>{p.nombre_producto}</strong>
                          <small>
                            {p.categoria_nombre} · {p.presentaciones.length} presentación
                            {p.presentaciones.length === 1 ? "" : "es"}
                          </small>
                        </span>
                        {producto?.id === p.id && <Check size={16} className="ap-check" aria-hidden="true" />}
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="gp-superficie ap-seccion">
                <header className="gp-superficie-cabecera">
                  <h3>
                    <span className="ap-paso">2</span> Presentación que pidió el cliente
                  </h3>
                </header>
                {!producto ? (
                  <p className="gp-tenue gp-sin-dato">Elige primero un producto.</p>
                ) : (
                  <div className="gp-opciones" role="radiogroup">
                    {producto.presentaciones.map((p) => (
                      <label key={p.id} className={`gp-opcion ${presentacion?.id === p.id ? "activa" : ""}`}>
                        <input
                          type="radio"
                          name="ap-vincular-pres"
                          checked={presentacion?.id === p.id}
                          onChange={() => setPresentacion(p)}
                        />
                        <span className="gp-opcion-texto">
                          <strong>{p.nombre_presentacion}</strong>
                          <small>
                            {p.unidad_venta_nombre} · {describirRegla(p.cantidad_minima, p.incremento_cantidad)}
                          </small>
                        </span>
                        <span className="gp-opcion-precio">{formatoPrecio(p.precio_unitario)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ---------- Efecto en el pedido ---------- */}
          <section className="gp-superficie ap-efecto" aria-live="polite">
            <header className="gp-superficie-cabecera">
              <h3>Así queda la línea del pedido #{pendiente.pedido}</h3>
            </header>
            <div className="ap-efecto-filas">
              <div className="ap-efecto-antes">
                <span className="gp-kpi-etiqueta">Ahora</span>
                <strong>{pendiente.nombre_personalizado}</strong>
                <span>
                  {formatearCantidad(pendiente.cantidad)} {pendiente.unidad_nombre} × {formatoPrecio(precioLinea)} ={" "}
                  {formatoPrecio(Number(pendiente.subtotal) || cantidad * precioLinea)}
                </span>
              </div>
              <ArrowRight size={18} className="ap-flecha" aria-hidden="true" />
              <div className="ap-efecto-despues">
                <span className="gp-kpi-etiqueta">Después</span>
                <strong>
                  {modo === "crear"
                    ? `${nombre.trim() || "—"} · ${presDelPedido?.nombre_presentacion.trim() || "—"}`
                    : producto
                      ? `${producto.nombre_producto} · ${presentacion?.nombre_presentacion ?? "—"}`
                      : "—"}
                </strong>
                <span>
                  {formatearCantidad(pendiente.cantidad)} {unidadFinal ?? ""} × {formatoPrecio(precioFinal)} ={" "}
                  <b>{formatoPrecio(cantidad * precioFinal)}</b>
                </span>
              </div>
            </div>
            {unidadCambia && (
              <p className="gp-aviso-suave">
                <Info size={14} aria-hidden="true" /> La unidad cambia de {pendiente.unidad_nombre} a {unidadFinal}: revisa
                que la cantidad siga teniendo sentido en el pedido.
              </p>
            )}
            <label className="ap-conservar">
              <input type="checkbox" checked={conservarPrecio} onChange={(e) => setConservarPrecio(e.target.checked)} />
              <span>
                Conservar el precio que tiene en el pedido ({precioLinea > 0 ? formatoPrecio(precioLinea) : "sin precio"})
                <small>Si no, la línea toma el precio del catálogo. Queda registrado en el historial del pedido.</small>
              </span>
            </label>
          </section>
        </div>
      </div>
    </Modal>
  );
}
