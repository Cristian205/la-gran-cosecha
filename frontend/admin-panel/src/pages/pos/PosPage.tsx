import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, LockOpen, Receipt, ShoppingCart, Trash2, Wallet } from "lucide-react";
import {
  abrirTurno,
  abrirVenta,
  agregarLinea,
  anularVenta,
  cerrarTurno,
  obtenerArqueo,
  obtenerConfiguracion,
  quitarLinea,
  type ConfiguracionPOS,
  type Venta,
} from "../../api/pos";
import { obtenerCategorias, obtenerProductos } from "../../api/resources";
import { Modal } from "../../components/Modal";
import type { Categoria, Presentacion, Producto } from "../../types";
import { extraerMensajeError, formatoPrecio, tienePermiso } from "../../utils";
import { useAuth } from "../../auth/AuthContext";
import { alertaError, alertaExito, confirmarAccion } from "../../utils/alertas";
import { CobroModal } from "./CobroModal";
import { panelDelPerfil } from "./paneles/registro";
import { Selector } from "./Selector";

/**
 * La caja.
 *
 * Cuatro zonas, y quién decide cada una:
 *
 *   selector       `perfil.busqueda` y `muestra_imagenes`
 *   carrito        `pide_atributos_en_linea`, `permite_nota_por_linea`
 *   panel lateral  `perfil.panel_lateral` — lo aportan los módulos
 *   cobro          los medios de pago que el negocio dio de alta
 *
 * No hay una caja de boutique y otra de ferretería: hay esta, leyendo una
 * configuración distinta. Mejorarla las mejora todas a la vez, que es la razón
 * entera de que Crynex sea un sistema y no diez.
 */
export function PosPage() {
  const { usuario } = useAuth();
  const puedeCerrarCaja = tienePermiso(usuario, "pos.change_turno");
  const puedeAnular = tienePermiso(usuario, "pos.delete_venta");

  const [config, setConfig] = useState<ConfiguracionPOS | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [venta, setVenta] = useState<Venta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

  const [fondo, setFondo] = useState("");
  const [cobrando, setCobrando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [arqueo, setArqueo] = useState<{ efectivo_esperado: string; ventas: number } | null>(null);
  const [contado, setContado] = useState("");
  const [notaCierre, setNotaCierre] = useState("");
  /** Lo que el panel lateral aporta a la venta. Se elige ANTES de la primera
   *  línea: la venta nace con ello dentro, y así no hace falta un endpoint
   *  para cambiarlo después. La caja NO lo interpreta — ver paneles/registro. */
  const [aporte, setAporte] = useState<Record<string, unknown>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cfg, prods, cats] = await Promise.all([
        obtenerConfiguracion(),
        obtenerProductos(),
        obtenerCategorias(),
      ]);
      setConfig(cfg);
      setProductos(prods.filter((p) => p.estado_producto));
      setCategorias(cats);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo abrir la caja."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const turno = config?.turno ?? null;
  const perfil = config?.perfil_pos;
  const panel = panelDelPerfil(perfil?.panel_lateral);
  // El aspecto viaja como variables CSS y un atributo, no como condiciones:
  // esta pantalla no sabe si el negocio es una boutique o una ferreteria, solo
  // aplica lo que el servidor resolvio. Ver `pos/aspecto.py`.
  const aspecto = config?.aspecto;

  async function conError(accion: () => Promise<void>) {
    setTrabajando(true);
    try {
      await accion();
    } catch (err) {
      // Los mensajes del servidor están escritos para un cajero —«solo hay 3
      // disponibles»—, así que se muestran tal cual.
      alertaError(extraerMensajeError(err, "No se pudo completar la operación."));
    } finally {
      setTrabajando(false);
    }
  }

  async function asegurarVenta(): Promise<Venta> {
    if (venta && venta.estado === "ABIERTA") return venta;
    const nueva = await abrirVenta(aporte);
    // Lo que el módulo tenga que hacer con su venta recién abierta lo hace él.
    // La caja no sabe qué es: solo que este panel declaró un gancho.
    await panel?.alAbrirVenta?.(nueva, aporte);
    setVenta(nueva);
    return nueva;
  }

  async function agregar(_producto: Producto, presentacion: Presentacion) {
    await conError(async () => {
      const actual = await asegurarVenta();
      setVenta(
        await agregarLinea(actual.id, {
          presentacion_id: presentacion.id,
          cantidad: "1",
        })
      );
    });
  }

  async function quitar(lineaId: number) {
    if (!venta) return;
    await conError(async () => setVenta(await quitarLinea(venta.id, lineaId)));
  }

  async function anular() {
    if (!venta) return;
    if (!(await confirmarAccion("¿Anular esta venta?", undefined, "Anular"))) return;
    await conError(async () => {
      await anularVenta(venta.id, "Anulada desde la caja");
      setVenta(null);
      setAporte({});
    });
  }

  async function abrir() {
    await conError(async () => {
      const nuevo = await abrirTurno(fondo || "0");
      setConfig((prev) => (prev ? { ...prev, turno: nuevo } : prev));
      setFondo("");
    });
  }

  async function prepararCierre() {
    if (!turno) return;
    const datos = await obtenerArqueo(turno.id);
    setArqueo(datos);
    setContado(datos.efectivo_esperado);
    setCerrando(true);
  }

  async function cerrar() {
    if (!turno) return;
    await conError(async () => {
      const cerrado = await cerrarTurno(turno.id, contado, notaCierre);
      setCerrando(false);
      setVenta(null);
      setConfig((prev) => (prev ? { ...prev, turno: null } : prev));
      const dif = Number(cerrado.diferencia);
      alertaExito(
        dif === 0
          ? "Caja cerrada y cuadrada."
          : `Caja cerrada con una diferencia de ${formatoPrecio(dif)}.`
      );
    });
  }

  const total = useMemo(() => Number(venta?.total ?? 0), [venta]);

  if (cargando) {
    return (
      <>
        <div className="topbar">
          <h1>Caja</h1>
        </div>
        <div className="contenido">
          <div className="panel">Abriendo la caja…</div>
        </div>
      </>
    );
  }

  // ---------- sin turno: lo único que se puede hacer es abrirlo ----------
  if (!turno) {
    return (
      <>
        <div className="topbar">
          <h1>Caja</h1>
        </div>
        <div className="contenido">
          <div className="panel" style={{ maxWidth: "26rem" }}>
            <div className="modal-seccion">
              <LockOpen size={16} />
              <span>Abrir la caja</span>
            </div>
            <p className="form-nota">
              Con cuánto empiezas el día. Se usa al cerrar para saber si el
              cajón cuadra.
            </p>
            <div className="campo">
              <label>Fondo inicial</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fondo}
                onChange={(e) => setFondo(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <button className="btn primario" onClick={abrir} disabled={trabajando}>
              {trabajando ? "Abriendo…" : "Abrir caja"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---------- con turno: la caja ----------
  return (
    <>
      <div className="topbar">
        <h1>Caja</h1>
        <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <span className="pres-mas">
            {turno.ubicacion_nombre} · abierta por {turno.abierto_por}
          </span>
          {puedeCerrarCaja && (
            <button className="btn secundario" onClick={prepararCierre}>
              <Wallet size={15} /> Cerrar caja
            </button>
          )}
        </div>
      </div>

      <div
        className="contenido caja-reparto"
        data-caja={aspecto?.disposicion ?? "derecha"}
        style={aspecto?.variables as React.CSSProperties | undefined}
      >
        {perfil && (
          <Selector
            perfil={perfil}
            productos={productos}
            categorias={categorias}
            onElegir={agregar}
          />
        )}

        <div className="panel caja-carrito">
          <div className="modal-seccion">
            <ShoppingCart size={16} />
            <span>{venta ? `Venta ${venta.numero}` : "Venta nueva"}</span>
          </div>

          {/* El panel lateral lo aporta un módulo. El servidor NOMBRA la
              clave y `paneles/registro` dice qué componente la PINTA: añadir
              el tercero es una fila allí, no una condición aquí. */}
          {panel && (
            <panel.Componente venta={venta} aporte={aporte} onAporte={setAporte} />
          )}

          {!venta || venta.lineas.length === 0 ? (
            <p className="vacio">Elige un producto para empezar</p>
          ) : (
            <>
              <div className="tabla-scroll" style={{ maxHeight: "22rem" }}>
                <table>
                  <tbody>
                    {venta.lineas.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.nombre_congelado}
                          {perfil?.pide_atributos_en_linea &&
                            Object.keys(l.atributos ?? {}).length > 0 && (
                              <span className="pres-mas">
                                {" · "}
                                {Object.values(l.atributos).join(" · ")}
                              </span>
                            )}
                          {perfil?.permite_nota_por_linea && l.nota && (
                            <span className="pres-mas"> · {l.nota}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {l.cantidad} × {formatoPrecio(Number(l.precio_unitario))}
                          <br />
                          <strong>{formatoPrecio(Number(l.subtotal))}</strong>
                        </td>
                        <td style={{ width: "2rem" }}>
                          <button
                            className="btn-icon"
                            onClick={() => quitar(l.id)}
                            disabled={trabajando}
                            aria-label="Quitar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  margin: "1rem 0",
                  fontSize: "1.35rem",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span>Total</span>
                <strong>{formatoPrecio(total)}</strong>
              </div>

              <div style={{ display: "flex", gap: ".5rem" }}>
                <button
                  className="btn primario"
                  style={{ flex: 1 }}
                  onClick={() => setCobrando(true)}
                  disabled={trabajando || total <= 0}
                >
                  <Receipt size={16} /> Cobrar
                </button>
                {puedeAnular && (
                  <button className="btn secundario" onClick={anular} disabled={trabajando}>
                    <Ban size={15} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {cobrando && venta && config && (
        <CobroModal
          venta={venta}
          medios={config.medios_pago.filter((m) => m.activo)}
          onCerrar={() => setCobrando(false)}
          onCobrada={() => {
            setCobrando(false);
            setVenta(null);
            setAporte({});
            alertaExito("Venta cobrada.");
          }}
        />
      )}

      {cerrando && arqueo && (
        <Modal
          titulo="Cerrar caja"
          onCerrar={() => setCerrando(false)}
          footer={
            <>
              <button className="btn secundario" onClick={() => setCerrando(false)}>
                Cancelar
              </button>
              <button className="btn primario" onClick={cerrar} disabled={trabajando}>
                {trabajando ? "Cerrando…" : "Cerrar caja"}
              </button>
            </>
          }
        >
          <p className="form-nota">
            Cuenta el dinero del cajón y escribe lo que hay. Se guarda lo que
            contaste y lo esperado: si no cuadra, mañana se puede mirar por qué.
          </p>
          <div className="campo">
            <label>Efectivo contado</label>
            <input
              type="number"
              step="0.01"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              autoFocus
            />
            <small className="campo-ayuda">
              El sistema esperaba {formatoPrecio(Number(arqueo.efectivo_esperado))} en{" "}
              {arqueo.ventas} venta(s). Solo cuenta el efectivo: lo de tarjeta
              llega al banco.
            </small>
          </div>
          <div className="campo">
            <label>Nota</label>
            <input
              value={notaCierre}
              onChange={(e) => setNotaCierre(e.target.value)}
              placeholder="Faltó vuelto, se pagó un domicilio…"
            />
          </div>
        </Modal>
      )}
    </>
  );
}
