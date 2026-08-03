import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  History,
  ImageOff,
  Layers,
  PackageX,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  X,
} from "lucide-react";
import {
  actualizarProducto,
  desactivarProducto,
  obtenerCategorias,
  obtenerProductos,
  obtenerUnidades,
} from "../../api/resources";
import type { Categoria, Producto, UnidadMedida } from "../../types";
import { extraerMensajeError, formatoPrecio, tienePermiso } from "../../utils";
import { alertaError, confirmarAccion } from "../../utils/alertas";
import { Tooltip } from "../../components/Tooltip";
import { useAuth } from "../../auth/AuthContext";
import { ProductFormModal } from "./ProductFormModal";
import { PriceHistoryModal } from "./PriceHistoryModal";

type EstadoFiltro = "todos" | "activos" | "inactivos";

const OPCIONES_ESTADO: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
];

// Paleta con más tonos que categorías esperadas, para que nunca se repita un color
// entre dos categorías (antes usaba id % 6 con solo 6 colores, y con más de 6
// categorías dos terminaban con el mismo — p.ej. Tubérculos y Jabones).
const PALETA_CATEGORIA = [
  "linear-gradient(135deg, #059669, #047857)",
  "linear-gradient(135deg, #2563eb, #1d4ed8)",
  "linear-gradient(135deg, #d97706, #b45309)",
  "linear-gradient(135deg, #db2777, #be185d)",
  "linear-gradient(135deg, #7c3aed, #6d28d9)",
  "linear-gradient(135deg, #0891b2, #0e7490)",
  "linear-gradient(135deg, #dc2626, #b91c1c)",
  "linear-gradient(135deg, #0d9488, #0f766e)",
  "linear-gradient(135deg, #65a30d, #4d7c0f)",
  "linear-gradient(135deg, #e11d48, #be123c)",
  "linear-gradient(135deg, #0284c7, #0369a1)",
  "linear-gradient(135deg, #a855f7, #9333ea)",
];

/**
 * Asigna un color único por categoría según su posición ordenada (no el id
 * crudo): así, aunque haya huecos en los ids por categorías borradas, dos
 * categorías nunca terminan compartiendo color por una coincidencia de módulo.
 */
function coloresPorCategoria(categorias: { id: number }[]): Map<number, string> {
  const ordenadas = [...categorias].sort((a, b) => a.id - b.id);
  return new Map(ordenadas.map((c, i) => [c.id, PALETA_CATEGORIA[i % PALETA_CATEGORIA.length]]));
}

export function ProductsPage() {
  const { usuario: actual } = useAuth();
  const [searchParams] = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [busqueda, setBusqueda] = useState(() => searchParams.get("q") ?? "");
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | "">("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [historialDe, setHistorialDe] = useState<Producto | null>(null);

  const coloresCategoria = useMemo(() => coloresPorCategoria(categorias), [categorias]);

  const hayFiltrosActivos =
    busqueda !== "" || categoriaFiltro !== "" || estadoFiltro !== "todos";

  function cargar() {
    setCargando(true);
    obtenerProductos({
      search: busqueda || undefined,
      categoria: categoriaFiltro === "" ? undefined : categoriaFiltro,
      estado: estadoFiltro,
    })
      .then(setProductos)
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    obtenerCategorias().then(setCategorias);
    obtenerUnidades().then(setUnidades);
  }, []);

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, categoriaFiltro, estadoFiltro]);

  function limpiarFiltros() {
    setBusqueda("");
    setCategoriaFiltro("");
    setEstadoFiltro("todos");
  }

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }
  function abrirEdicion(p: Producto) {
    setEditando(p);
    setModalAbierto(true);
  }

  async function alternarEstado(p: Producto) {
    if (p.estado_producto) {
      if (!(await confirmarAccion(`¿Desactivar "${p.nombre_producto}" del catálogo?`, undefined, "Desactivar")))
        return;
    }
    try {
      if (p.estado_producto) {
        await desactivarProducto(p.id);
      } else {
        await actualizarProducto(p.id, {
          nombre_producto: p.nombre_producto,
          categoria: p.categoria,
          unidad_base: p.unidad_base,
          tipo_cantidad: p.tipo_cantidad,
          permite_fraccion: p.permite_fraccion,
          estado_producto: true,
          presentaciones: p.presentaciones.map((x) => ({
            id: x.id,
            nombre_presentacion: x.nombre_presentacion,
            unidad_venta: x.unidad_venta,
            factor_conversion: x.factor_conversion,
            precio_unitario: x.precio_unitario,
          })),
        });
      }
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo actualizar el estado del producto."));
    }
  }

  function precioDesde(p: Producto): string {
    const activas = p.presentaciones.filter((x) => x.estado_presentacion);
    if (activas.length === 0) return "—";
    const min = Math.min(...activas.map((x) => parseFloat(x.precio_unitario)));
    return formatoPrecio(min);
  }

  return (
    <>
      <div className="topbar">
        <h1>Catálogo</h1>
        <button className="btn primario" onClick={abrirNuevo}>
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      <div className="contenido">
        <div className="panel">
          <div className="cabecera">
            <h2>
              Productos{" "}
              <span style={{ color: "var(--gris)", fontWeight: 500 }}>
                ({productos.length})
              </span>
            </h2>
          </div>

          <div className="filtros-bar">
            <div className="buscador">
              <Search size={16} />
              <input
                placeholder="Buscar por nombre o categoría…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <select
              className="select-filtro"
              value={categoriaFiltro}
              onChange={(e) =>
                setCategoriaFiltro(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>

            <div className="segmentado">
              {OPCIONES_ESTADO.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={estadoFiltro === o.valor ? "activo" : ""}
                  onClick={() => setEstadoFiltro(o.valor)}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>

            {hayFiltrosActivos && (
              <button type="button" className="btn-limpiar" onClick={limpiarFiltros}>
                <X size={14} /> Limpiar filtros
              </button>
            )}
          </div>

          {cargando ? (
            <div className="catalogo-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="skeleton-card" key={i}>
                  <div className="skeleton-img skeleton-shimmer" />
                  <div className="skeleton-line skeleton-shimmer" />
                  <div
                    className="skeleton-line skeleton-shimmer corta"
                    style={{ marginBottom: "1rem" }}
                  />
                </div>
              ))}
            </div>
          ) : productos.length === 0 ? (
            <div className="vacio">
              <PackageX size={34} style={{ opacity: 0.5, marginBottom: ".5rem" }} />
              <div>Sin productos que coincidan con los filtros</div>
            </div>
          ) : (
            <div className="catalogo-grid">
              {productos.map((p, i) => {
                const activas = p.presentaciones.filter((x) => x.estado_presentacion);
                return (
                  <div
                    className={`producto-card ${
                      !p.estado_producto ? "card-inactiva" : ""
                    }`}
                    style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}
                    key={p.id}
                  >
                    <div className="producto-img">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre_producto} />
                      ) : (
                        <ImageOff size={26} />
                      )}
                      <span
                        className="categoria-pill"
                        style={{ background: coloresCategoria.get(p.categoria) ?? PALETA_CATEGORIA[0] }}
                      >
                        {p.categoria_nombre}
                      </span>
                      <span
                        className={`estado-dot ${
                          p.estado_producto ? "" : "inactivo"
                        }`}
                      />
                    </div>

                    <div className="producto-body">
                      <span className="codigo">{p.codigo_producto}</span>
                      <span className="nombre">{p.nombre_producto}</span>

                      <div className="precio-desde">
                        <span className="precio-label">Desde</span>
                        <span className="precio-valor">{precioDesde(p)}</span>
                      </div>

                      <div className="producto-presentaciones">
                        <div className="pres-header">
                          <Layers size={12} /> Presentaciones
                        </div>
                        {activas.length === 0 ? (
                          <span className="pres-vacio">Sin presentaciones activas</span>
                        ) : (
                          <>
                            {activas.slice(0, 3).map((pr) => (
                              <div className="pres-chip" key={pr.id}>
                                <span className="pres-nombre">
                                  {pr.nombre_presentacion} - {pr.unidad_venta_nombre}
                                </span>
                                <span className="pres-precio">
                                  {formatoPrecio(pr.precio_unitario)}
                                </span>
                              </div>
                            ))}
                            {activas.length > 3 && (
                              <span className="pres-mas">
                                +{activas.length - 3} más
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="producto-footer">
                      <span
                        className={`badge ${p.estado_producto ? "activo" : "inactivo"}`}
                      >
                        {p.estado_producto ? "Activo" : "Inactivo"}
                      </span>
                      <div className="acciones">
                        <Tooltip label="Historial de precios">
                          <button
                            type="button"
                            className="btn-icon info"
                            onClick={() => setHistorialDe(p)}
                            aria-label="Historial de precios"
                          >
                            <History size={16} />
                          </button>
                        </Tooltip>
                        {tienePermiso(actual, "catalog.change_producto") && (
                          <Tooltip label="Editar producto">
                            <button
                              type="button"
                              className="btn-icon editar"
                              onClick={() => abrirEdicion(p)}
                              aria-label="Editar producto"
                            >
                              <Pencil size={16} />
                            </button>
                          </Tooltip>
                        )}
                        {tienePermiso(
                          actual,
                          p.estado_producto ? "catalog.delete_producto" : "catalog.change_producto"
                        ) && (
                          <Tooltip label={p.estado_producto ? "Desactivar" : "Activar"}>
                            <button
                              type="button"
                              className={`btn-icon ${
                                p.estado_producto ? "peligro" : "exito"
                              }`}
                              onClick={() => alternarEstado(p)}
                              aria-label={p.estado_producto ? "Desactivar" : "Activar"}
                            >
                              {p.estado_producto ? (
                                <PowerOff size={16} />
                              ) : (
                                <Power size={16} />
                              )}
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modalAbierto && (
        <ProductFormModal
          producto={editando}
          categorias={categorias}
          unidades={unidades}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}

      {historialDe && (
        <PriceHistoryModal
          producto={historialDe}
          onCerrar={() => setHistorialDe(null)}
        />
      )}
    </>
  );
}
