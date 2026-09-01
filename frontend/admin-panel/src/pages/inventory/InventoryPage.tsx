import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  History,
  PackagePlus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  obtenerExistencias,
  obtenerUbicaciones,
  type Existencia,
  type Ubicacion,
} from "../../api/inventario";
import { useAuth } from "../../auth/AuthContext";
import { Tooltip } from "../../components/Tooltip";
import { extraerMensajeError, tienePermiso } from "../../utils";
import { alertaError } from "../../utils/alertas";
import { KardexModal } from "./KardexModal";
import { MovimientoModal, type Operacion } from "./MovimientoModal";

const PUEDE_MOVER = "inventory.change_existencia";

/**
 * La pantalla de existencias.
 *
 * Muestra tres números por fila y no uno, porque los tres son distintos y
 * confundirlos es lo que hace que un negocio prometa lo que no puede entregar:
 *
 *   hay          lo que está físicamente en la estantería
 *   reservado    lo comprometido en pedidos que aún no han salido
 *   disponible   lo único que se puede prometer a un cliente nuevo
 *
 * El que manda es `disponible`, así que va destacado y es por el que se ordena
 * al buscar problemas.
 */
type Filtro = "todos" | "sin_stock" | "reservado";

const OPCIONES_FILTRO: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "sin_stock", etiqueta: "Sin disponible" },
  { valor: "reservado", etiqueta: "Con reservas" },
];

export function InventoryPage() {
  const { usuario } = useAuth();
  const puedeMover = tienePermiso(usuario, PUEDE_MOVER);

  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [ubicacionActiva, setUbicacionActiva] = useState<number | "">("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cargando, setCargando] = useState(true);

  const [operando, setOperando] = useState<{ op: Operacion; fila: Existencia } | null>(null);
  const [viendoKardex, setViendoKardex] = useState<Existencia | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const [filas, sitios] = await Promise.all([
        obtenerExistencias(
          ubicacionActiva === "" ? undefined : { ubicacion: ubicacionActiva }
        ),
        obtenerUbicaciones(),
      ]);
      setExistencias(filas);
      setUbicaciones(sitios);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo cargar el inventario."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionActiva]);

  const vista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return existencias.filter((e) => {
      if (
        texto &&
        !e.producto_nombre.toLowerCase().includes(texto) &&
        !e.producto_codigo.toLowerCase().includes(texto)
      ) {
        return false;
      }
      if (filtro === "sin_stock") return Number(e.disponible) <= 0;
      if (filtro === "reservado") return Number(e.reservada) > 0;
      return true;
    });
  }, [existencias, busqueda, filtro]);

  const kpis = useMemo(() => {
    const agotados = existencias.filter((e) => Number(e.disponible) <= 0).length;
    const reservadas = existencias.reduce((suma, e) => suma + Number(e.reservada), 0);
    return { referencias: existencias.length, agotados, reservadas };
  }, [existencias]);

  const hayFiltros = busqueda.trim() !== "" || filtro !== "todos" || ubicacionActiva !== "";

  function limpiar() {
    setBusqueda("");
    setFiltro("todos");
    setUbicacionActiva("");
  }

  function alTerminar() {
    setOperando(null);
    void cargar();
  }

  return (
    <>
      <div className="topbar">
        <h1>Inventario</h1>
      </div>

      <div className="contenido">
        <div className="stats-grid">
          <div className="stat dark">
            <div
              className="stat-icono"
              style={{ background: "var(--gris-claro)", color: "var(--dark)" }}
            >
              <Boxes size={18} />
            </div>
            <div className="label">Referencias con existencias</div>
            <div className="valor">{kpis.referencias}</div>
          </div>
          <div className="stat amber">
            <div
              className="stat-icono"
              style={{ background: "var(--ambar-claro)", color: "var(--ambar-texto)" }}
            >
              <TriangleAlert size={18} />
            </div>
            <div className="label">Sin disponible</div>
            <div className="valor">{kpis.agotados}</div>
            <div className="pie">No se pueden prometer a un cliente nuevo</div>
          </div>
          <div className="stat azul">
            <div
              className="stat-icono"
              style={{ background: "var(--azul-claro)", color: "var(--azul-texto)" }}
            >
              <ClipboardCheck size={18} />
            </div>
            <div className="label">Unidades reservadas</div>
            <div className="valor">{kpis.reservadas.toLocaleString("es-CO")}</div>
            <div className="pie">Apartadas en pedidos sin entregar</div>
          </div>
        </div>

        <div className="panel">
          <div className="filtros-bar">
            <div className="buscador">
              <Search size={16} />
              <input
                placeholder="Buscar por nombre o código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {ubicaciones.length > 1 && (
              <select
                value={ubicacionActiva}
                onChange={(e) =>
                  setUbicacionActiva(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Todas las ubicaciones</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            )}

            <div className="segmentado">
              {OPCIONES_FILTRO.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={filtro === o.valor ? "activo" : ""}
                  onClick={() => setFiltro(o.valor)}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>

            {hayFiltros && (
              <button type="button" className="btn-limpiar" onClick={limpiar}>
                <X size={14} /> Limpiar filtros
              </button>
            )}
          </div>

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Ubicación</th>
                  <th style={{ textAlign: "right" }}>Hay</th>
                  <th style={{ textAlign: "right" }}>Reservado</th>
                  <th style={{ textAlign: "right" }}>Disponible</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <div
                          className="skeleton-line skeleton-shimmer en-celda"
                          style={{ width: `${72 - i * 6}%` }}
                        />
                      </td>
                    </tr>
                  ))
                ) : vista.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="vacio">
                      {existencias.length === 0
                        ? "Todavía no hay existencias. Activa «controla stock» en un producto y registra su entrada."
                        : "Sin existencias que coincidan con los filtros"}
                    </td>
                  </tr>
                ) : (
                  vista.map((e) => {
                    const disponible = Number(e.disponible);
                    return (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.producto_nombre}</strong>
                          <br />
                          <span className="pres-mas">{e.producto_codigo}</span>
                        </td>
                        <td>{e.ubicacion_nombre}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {e.cantidad}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {Number(e.reservada) > 0 ? e.reservada : "—"}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                            color: disponible <= 0 ? "var(--rojo-texto)" : undefined,
                          }}
                        >
                          {e.disponible}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: ".25rem" }}>
                            {puedeMover && (
                              <>
                                <Tooltip label="Registrar entrada">
                                  <button
                                    className="btn-icon"
                                    onClick={() => setOperando({ op: "entrada", fila: e })}
                                  >
                                    <PackagePlus size={15} />
                                  </button>
                                </Tooltip>
                                <Tooltip label="Ajustar por conteo">
                                  <button
                                    className="btn-icon"
                                    onClick={() => setOperando({ op: "ajuste", fila: e })}
                                  >
                                    <ClipboardCheck size={15} />
                                  </button>
                                </Tooltip>
                                {ubicaciones.filter((u) => u.activa).length > 1 && (
                                  <Tooltip label="Trasladar a otra ubicación">
                                    <button
                                      className="btn-icon"
                                      onClick={() => setOperando({ op: "traslado", fila: e })}
                                    >
                                      <ArrowLeftRight size={15} />
                                    </button>
                                  </Tooltip>
                                )}
                              </>
                            )}
                            <Tooltip label="Ver historial">
                              <button className="btn-icon" onClick={() => setViendoKardex(e)}>
                                <History size={15} />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {operando && (
        <MovimientoModal
          operacion={operando.op}
          existencia={operando.fila}
          ubicaciones={ubicaciones}
          onCerrar={() => setOperando(null)}
          onHecho={alTerminar}
        />
      )}

      {viendoKardex && (
        <KardexModal existencia={viendoKardex} onCerrar={() => setViendoKardex(null)} />
      )}
    </>
  );
}
