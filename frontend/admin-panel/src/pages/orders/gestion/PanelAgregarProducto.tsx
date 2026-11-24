import { ArrowLeft, Check, Info, Minus, PackagePlus, PenLine, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Presentacion, Producto } from "../../../types";
import { formatoPrecio, normalizarTexto } from "../../../utils";
import { cantidadValida, describirRegla, formatearCantidad } from "../../../utils/cantidades";
import { aDecimalApi, aNumero, validarCantidad, validarPrecio } from "./modelo";
import { Esqueleto, Miniatura } from "./piezas";
import type { GestionPedido } from "./useGestionPedido";

type Modo = "catalogo" | "personalizado";

/** Tope de resultados pintados: con un catálogo grande, buscar es más rápido que desplazarse. */
const MAX_RESULTADOS = 60;

export function PanelAgregarProducto({
  g,
  onCerrar,
  onAgregado,
}: {
  g: GestionPedido;
  onCerrar: () => void;
  onAgregado: (clave: string) => void;
}) {
  const [modo, setModo] = useState<Modo>("catalogo");
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  // Un doble clic no agrega dos veces: el MISMO envío repetido dentro de esta
  // ventana se ignora. Uno distinto (otro producto, otra cantidad) sí pasa.
  const ultimoAgregado = useRef({ firma: "", momento: 0 });

  useEffect(() => {
    if (!confirmacion) return;
    const t = window.setTimeout(() => setConfirmacion(null), 2600);
    return () => window.clearTimeout(t);
  }, [confirmacion]);

  function puedeAgregar(firma: string): boolean {
    const ahora = Date.now();
    const previo = ultimoAgregado.current;
    if (previo.firma === firma && ahora - previo.momento < 1500) return false;
    ultimoAgregado.current = { firma, momento: ahora };
    return true;
  }

  function registrar(clave: string, texto: string) {
    onAgregado(clave);
    setConfirmacion(texto);
  }

  return (
    <aside className="gp-panel" aria-label="Agregar producto al pedido">
      <header className="gp-panel-cabecera">
        <div>
          <h3>
            <PackagePlus size={17} aria-hidden="true" /> Agregar producto
          </h3>
          <p className="gp-tenue">Se suma a la tabla al instante y se guarda con el pedido.</p>
        </div>
        <button type="button" className="btn-icon" onClick={onCerrar} aria-label="Cerrar panel">
          <X size={16} />
        </button>
      </header>

      <div className="segmentado gp-panel-modos" role="tablist" aria-label="Tipo de producto">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "catalogo"}
          className={modo === "catalogo" ? "activo" : ""}
          onClick={() => setModo("catalogo")}
        >
          <Search size={14} aria-hidden="true" /> Desde catálogo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "personalizado"}
          className={modo === "personalizado" ? "activo" : ""}
          onClick={() => setModo("personalizado")}
        >
          <PenLine size={14} aria-hidden="true" /> Personalizado
        </button>
      </div>

      {confirmacion && (
        <p className="gp-panel-confirmacion" role="status">
          <Check size={15} aria-hidden="true" /> {confirmacion}
        </p>
      )}

      {/* Los dos se quedan montados: cambiar de modo no borra lo escrito. */}
      <div hidden={modo !== "catalogo"} className="gp-panel-cuerpo">
        <ModoCatalogo g={g} puedeAgregar={puedeAgregar} onAgregado={registrar} />
      </div>
      <div hidden={modo !== "personalizado"} className="gp-panel-cuerpo">
        <ModoPersonalizado g={g} puedeAgregar={puedeAgregar} onAgregado={registrar} />
      </div>
    </aside>
  );
}

// ==========================================================================
// DESDE CATÁLOGO
// ==========================================================================
function ModoCatalogo({
  g,
  puedeAgregar,
  onAgregado,
}: {
  g: GestionPedido;
  puedeAgregar: (firma: string) => boolean;
  onAgregado: (clave: string, texto: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [presentacion, setPresentacion] = useState<Presentacion | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");
  const [intento, setIntento] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);

  useEffect(() => {
    buscador.current?.focus();
  }, []);

  // Solo productos con algo que vender: una presentación activa como mínimo.
  const vendibles = useMemo(() => g.productos.filter((p) => p.presentaciones.length > 0), [g.productos]);

  const categoriasConProductos = useMemo(() => {
    const ids = new Set(vendibles.map((p) => p.categoria));
    return g.categorias.filter((c) => ids.has(c.id));
  }, [vendibles, g.categorias]);

  const resultados = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    return vendibles.filter(
      (p) =>
        (categoriaId === "" || p.categoria === categoriaId) &&
        (!q || normalizarTexto(`${p.nombre_producto} ${p.codigo_producto ?? ""}`).includes(q))
    );
  }, [vendibles, busqueda, categoriaId]);

  const enPedido = useMemo(() => {
    const mapa = new Map<number, number>();
    g.activas.forEach((l) => {
      if (l.presentacion_id != null) mapa.set(l.presentacion_id, (mapa.get(l.presentacion_id) ?? 0) + aNumero(l.cantidad));
    });
    return mapa;
  }, [g.activas]);

  function elegirProducto(p: Producto) {
    setProducto(p);
    const primera = p.presentaciones[0] ?? null;
    elegirPresentacion(primera);
    setIntento(false);
  }

  function elegirPresentacion(p: Presentacion | null) {
    setPresentacion(p);
    setPrecio(p ? String(Number(p.precio_unitario)) : "");
    if (p) setCantidad(formatearCantidad(p.cantidad_minima || "1"));
  }

  function volver() {
    setProducto(null);
    setPresentacion(null);
    setNota("");
    setIntento(false);
    window.setTimeout(() => buscador.current?.focus(), 0);
  }

  const errorCantidad = validarCantidad(cantidad);
  const errorPrecio = validarPrecio(precio);
  const fueraDeRegla =
    presentacion && !errorCantidad
      ? !cantidadValida(
          aDecimalApi(cantidad) ?? cantidad,
          presentacion.cantidad_minima,
          presentacion.incremento_cantidad,
          presentacion.decimales_cantidad
        )
      : false;
  const subtotal = !errorCantidad && !errorPrecio ? aNumero(cantidad) * aNumero(precio) : 0;
  const precioLista = presentacion ? Number(presentacion.precio_unitario) : 0;

  function paso(direccion: 1 | -1) {
    const inc = presentacion ? Number(presentacion.incremento_cantidad) || 1 : 1;
    const min = presentacion ? Number(presentacion.cantidad_minima) || inc : 1;
    const actual = aNumero(cantidad);
    const base = Number.isFinite(actual) ? actual : min;
    const siguiente = Math.max(min, Math.round((base + direccion * inc) * 100) / 100);
    setCantidad(formatearCantidad(String(siguiente)));
  }

  function agregar(e?: FormEvent) {
    e?.preventDefault();
    setIntento(true);
    if (!producto || !presentacion || errorCantidad || errorPrecio) return;
    if (!puedeAgregar(`c|${presentacion.id}|${cantidad}|${precio}`)) return;
    const clave = g.agregarLinea({
      presentacion_id: presentacion.id,
      producto_id: producto.id,
      nombre_producto: producto.nombre_producto,
      presentacion_nombre: presentacion.nombre_presentacion,
      categoria: producto.categoria_nombre,
      categoria_id: producto.categoria,
      unidad_id: presentacion.unidad_venta,
      unidad_nombre: presentacion.unidad_venta_nombre,
      cantidad: aDecimalApi(cantidad) ?? cantidad,
      precio_unitario: aDecimalApi(precio) ?? precio,
      nota: nota.trim(),
      personalizado: false,
    });
    onAgregado(clave, `${producto.nombre_producto} (${presentacion.nombre_presentacion}) agregado al pedido`);
    setBusqueda("");
    setCategoriaId("");
    volver();
  }

  if (!g.catalogoCargado) {
    return (
      <div className="gp-panel-lista" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="gp-resultado esqueleto">
            <Esqueleto ancho={40} alto={40} radio={10} />
            <span style={{ flex: 1, display: "grid", gap: 6 }}>
              <Esqueleto ancho="70%" />
              <Esqueleto ancho="40%" alto={11} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!producto) {
    return (
      <>
        <div className="gp-panel-filtros">
          <label className="gp-buscador">
            <Search size={15} aria-hidden="true" />
            <input
              ref={buscador}
              type="search"
              placeholder="Buscar producto por nombre…"
              data-sin-cambios
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resultados.length === 1) {
                  e.preventDefault();
                  elegirProducto(resultados[0]);
                }
              }}
              aria-label="Buscar producto"
            />
          </label>
          <div className="gp-chips" role="group" aria-label="Filtrar por categoría">
            <button
              type="button"
              className={`gp-chip ${categoriaId === "" ? "activo" : ""}`}
              onClick={() => setCategoriaId("")}
            >
              Todas
            </button>
            {categoriasConProductos.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`gp-chip ${categoriaId === c.id ? "activo" : ""}`}
                onClick={() => setCategoriaId(c.id)}
              >
                {c.nombre_categoria}
              </button>
            ))}
          </div>
        </div>

        <div className="gp-panel-lista" role="list">
          {resultados.length === 0 ? (
            <p className="gp-panel-vacio">
              {vendibles.length === 0
                ? "El catálogo no tiene productos activos con presentaciones."
                : "Ningún producto coincide con la búsqueda."}
            </p>
          ) : (
            resultados.slice(0, MAX_RESULTADOS).map((p) => {
              const yaEsta = p.presentaciones.some((pr) => enPedido.has(pr.id));
              return (
                <button key={p.id} type="button" role="listitem" className="gp-resultado" onClick={() => elegirProducto(p)}>
                  <Miniatura src={p.imagen_url} nombre={p.nombre_producto} grande />
                  <span className="gp-resultado-texto">
                    <strong>{p.nombre_producto}</strong>
                    <small>
                      {p.categoria_nombre} · {p.presentaciones.length} presentación
                      {p.presentaciones.length === 1 ? "" : "es"}
                    </small>
                  </span>
                  <span className="gp-resultado-precio">
                    {p.precio_desde && (
                      <>
                        <small>desde</small>
                        {formatoPrecio(p.precio_desde)}
                      </>
                    )}
                    {yaEsta && <span className="gp-marca original">En el pedido</span>}
                  </span>
                </button>
              );
            })
          )}
          {resultados.length > MAX_RESULTADOS && (
            <p className="gp-panel-vacio">
              Mostrando {MAX_RESULTADOS} de {resultados.length}. Escribe para afinar la búsqueda.
            </p>
          )}
        </div>
      </>
    );
  }

  const cantidadEnPedido = presentacion ? enPedido.get(presentacion.id) : undefined;

  return (
    <form className="gp-panel-formulario" onSubmit={agregar} noValidate>
      <button type="button" className="gp-enlace gp-volver" onClick={volver}>
        <ArrowLeft size={14} /> Volver a resultados
      </button>

      <div className="gp-producto-elegido">
        <Miniatura src={presentacion?.imagen_url || producto.imagen_url} nombre={producto.nombre_producto} grande />
        <div>
          <strong>{producto.nombre_producto}</strong>
          <small className="gp-tenue">{producto.categoria_nombre}</small>
        </div>
      </div>

      <fieldset className="gp-campo">
        <legend>Presentación</legend>
        <div className="gp-opciones" role="radiogroup">
          {producto.presentaciones.map((p) => (
            <label key={p.id} className={`gp-opcion ${presentacion?.id === p.id ? "activa" : ""}`}>
              <input
                type="radio"
                name="presentacion"
                checked={presentacion?.id === p.id}
                onChange={() => elegirPresentacion(p)}
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
      </fieldset>

      {cantidadEnPedido !== undefined && (
        <p className="gp-aviso-suave">
          <Info size={14} aria-hidden="true" /> Ya hay {formatearCantidad(String(cantidadEnPedido))}{" "}
          {presentacion?.unidad_venta_nombre} de esta presentación en el pedido. Se agregará como una línea aparte.
        </p>
      )}

      <div className="gp-fila-campos">
        <div className="gp-campo">
          <label htmlFor="gp-cat-cantidad">Cantidad</label>
          <div className={`gp-paso ${intento && errorCantidad ? "invalido" : ""}`}>
            <button type="button" onClick={() => paso(-1)} aria-label="Disminuir cantidad">
              <Minus size={14} />
            </button>
            <input
              id="gp-cat-cantidad"
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-invalid={intento && Boolean(errorCantidad)}
            />
            <button type="button" onClick={() => paso(1)} aria-label="Aumentar cantidad">
              <Plus size={14} />
            </button>
          </div>
          {intento && errorCantidad ? (
            <small className="gp-error-campo">{errorCantidad}</small>
          ) : fueraDeRegla && presentacion ? (
            <small className="gp-ayuda aviso">
              Fuera de la regla de venta ({describirRegla(presentacion.cantidad_minima, presentacion.incremento_cantidad)}).
            </small>
          ) : (
            <small className="gp-ayuda">{presentacion?.unidad_venta_nombre}</small>
          )}
        </div>
        <div className="gp-campo">
          <label htmlFor="gp-cat-precio">Precio unitario</label>
          <div className={`gp-precio-campo ${intento && errorPrecio ? "invalido" : ""}`}>
            <span aria-hidden="true">$</span>
            <input
              id="gp-cat-precio"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-invalid={intento && Boolean(errorPrecio)}
            />
          </div>
          {intento && errorPrecio ? (
            <small className="gp-error-campo">{errorPrecio}</small>
          ) : presentacion && aNumero(precio) !== precioLista ? (
            <small className="gp-ayuda">
              Lista: {formatoPrecio(precioLista)} ·{" "}
              <button type="button" className="gp-enlace" onClick={() => setPrecio(String(precioLista))}>
                restablecer
              </button>
            </small>
          ) : (
            <small className="gp-ayuda">Precio de lista</small>
          )}
        </div>
      </div>

      <div className="gp-campo">
        <label htmlFor="gp-cat-nota">
          Observación <span className="gp-tenue">(opcional)</span>
        </label>
        <input
          id="gp-cat-nota"
          className="gp-input"
          value={nota}
          maxLength={500}
          placeholder="Ej.: bien maduros"
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      <div className="gp-subtotal-previo" aria-live="polite">
        <span>
          {formatearCantidad(aDecimalApi(cantidad) ?? "0")} × {formatoPrecio(aNumero(precio) || 0)}
        </span>
        <strong>{formatoPrecio(subtotal)}</strong>
      </div>

      <button type="submit" className="btn primario gp-boton-bloque">
        <Plus size={16} aria-hidden="true" /> Agregar al pedido
      </button>
    </form>
  );
}

// ==========================================================================
// PERSONALIZADO
// ==========================================================================
function ModoPersonalizado({
  g,
  puedeAgregar,
  onAgregado,
}: {
  g: GestionPedido;
  puedeAgregar: (firma: string) => boolean;
  onAgregado: (clave: string, texto: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [unidadId, setUnidadId] = useState<number | "">("");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");
  const [intento, setIntento] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  const errores = {
    nombre: !nombre.trim() ? "Escribe el nombre del producto." : undefined,
    unidad: unidadId === "" ? "Elige la unidad de medida." : undefined,
    cantidad: validarCantidad(cantidad),
    precio: validarPrecio(precio),
  };
  const valido = !Object.values(errores).some(Boolean);
  const subtotal = !errores.cantidad && !errores.precio ? aNumero(cantidad) * aNumero(precio) : 0;

  function agregar(e: FormEvent) {
    e.preventDefault();
    setIntento(true);
    if (!valido || !puedeAgregar(`p|${nombre.trim()}|${cantidad}|${precio}`)) return;
    const categoria = g.categorias.find((c) => c.id === categoriaId);
    const unidad = g.unidades.find((u) => u.id === unidadId);
    const clave = g.agregarLinea({
      presentacion_id: null,
      producto_id: null,
      nombre_producto: nombre.trim(),
      presentacion_nombre: null,
      categoria: categoria?.nombre_categoria ?? "",
      categoria_id: categoria?.id ?? null,
      unidad_id: unidad?.id ?? null,
      unidad_nombre: unidad?.nombre_unidad ?? "",
      cantidad: aDecimalApi(cantidad) ?? cantidad,
      precio_unitario: aDecimalApi(precio) ?? precio,
      nota: nota.trim(),
      personalizado: true,
    });
    onAgregado(clave, `${nombre.trim()} agregado al pedido`);
    setNombre("");
    setCantidad("1");
    setPrecio("");
    setNota("");
    setIntento(false);
    nombreRef.current?.focus();
  }

  const mostrar = (campo: keyof typeof errores) => (intento ? errores[campo] : undefined);

  return (
    <form className="gp-panel-formulario" onSubmit={agregar} noValidate>
      <p className="gp-aviso-suave">
        <Info size={14} aria-hidden="true" /> Queda solo en este pedido: no se crea ningún producto en el catálogo.
      </p>

      <div className="gp-campo">
        <label htmlFor="gp-per-nombre">Nombre del producto</label>
        <input
          id="gp-per-nombre"
          ref={nombreRef}
          className={`gp-input ${mostrar("nombre") ? "invalido" : ""}`}
          value={nombre}
          maxLength={255}
          placeholder="Ej.: Canasta de frutas de temporada"
          onChange={(e) => setNombre(e.target.value)}
          aria-invalid={Boolean(mostrar("nombre"))}
        />
        {mostrar("nombre") && <small className="gp-error-campo">{errores.nombre}</small>}
      </div>

      <div className="gp-fila-campos">
        <div className="gp-campo">
          <label htmlFor="gp-per-categoria">
            Categoría <span className="gp-tenue">(opcional)</span>
          </label>
          <select
            id="gp-per-categoria"
            className="gp-input"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Otros productos</option>
            {g.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_categoria}
              </option>
            ))}
          </select>
        </div>
        <div className="gp-campo">
          <label htmlFor="gp-per-unidad">Unidad de medida</label>
          <select
            id="gp-per-unidad"
            className={`gp-input ${mostrar("unidad") ? "invalido" : ""}`}
            value={unidadId}
            onChange={(e) => setUnidadId(e.target.value === "" ? "" : Number(e.target.value))}
            aria-invalid={Boolean(mostrar("unidad"))}
          >
            <option value="">Selecciona…</option>
            {g.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre_unidad}
              </option>
            ))}
          </select>
          {mostrar("unidad") && <small className="gp-error-campo">{errores.unidad}</small>}
        </div>
      </div>

      <div className="gp-fila-campos">
        <div className="gp-campo">
          <label htmlFor="gp-per-cantidad">Cantidad</label>
          <input
            id="gp-per-cantidad"
            className={`gp-input num ${mostrar("cantidad") ? "invalido" : ""}`}
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-invalid={Boolean(mostrar("cantidad"))}
          />
          {mostrar("cantidad") && <small className="gp-error-campo">{errores.cantidad}</small>}
        </div>
        <div className="gp-campo">
          <label htmlFor="gp-per-precio">Precio unitario</label>
          <div className={`gp-precio-campo ${mostrar("precio") ? "invalido" : ""}`}>
            <span aria-hidden="true">$</span>
            <input
              id="gp-per-precio"
              inputMode="decimal"
              value={precio}
              placeholder="0"
              onChange={(e) => setPrecio(e.target.value)}
              aria-invalid={Boolean(mostrar("precio"))}
            />
          </div>
          {mostrar("precio") && <small className="gp-error-campo">{errores.precio}</small>}
        </div>
      </div>

      <div className="gp-campo">
        <label htmlFor="gp-per-nota">
          Observaciones <span className="gp-tenue">(opcional)</span>
        </label>
        <textarea
          id="gp-per-nota"
          className="gp-input"
          rows={2}
          maxLength={500}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      <div className="gp-subtotal-previo" aria-live="polite">
        <span>
          {formatearCantidad(aDecimalApi(cantidad) ?? "0")} × {formatoPrecio(aNumero(precio) || 0)}
        </span>
        <strong>{formatoPrecio(subtotal)}</strong>
      </div>

      <button type="submit" className="btn primario gp-boton-bloque">
        <Plus size={16} aria-hidden="true" /> Agregar al pedido
      </button>
    </form>
  );
}
