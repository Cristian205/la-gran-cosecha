import { PackageOpen, Plus, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EstadoVacio } from "../../../components/gestion/Gestion";
import { Tooltip } from "../../../components/Tooltip";
import { formatoPrecio, normalizarTexto } from "../../../utils";
import { confirmarEliminar } from "../../../utils/alertas";
import { formatearCantidad } from "../../../utils/cantidades";
import { aNumero, lineaCambio, subtotalDe, type LineaEditable } from "./modelo";
import { PanelAgregarProducto } from "./PanelAgregarProducto";
import { MarcasOrigen, Miniatura } from "./piezas";
import type { GestionPedido } from "./useGestionPedido";

export function ProductosPedido({ g, soloLectura }: { g: GestionPedido; soloLectura: boolean }) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [resaltada, setResaltada] = useState<string | null>(null);

  useEffect(() => {
    if (!resaltada) return;
    const t = window.setTimeout(() => setResaltada(null), 1800);
    return () => window.clearTimeout(t);
  }, [resaltada]);

  const visibles = useMemo(() => {
    const q = normalizarTexto(filtro.trim());
    if (!q) return g.lineas;
    return g.lineas.filter((l) =>
      normalizarTexto(`${l.nombre_producto} ${l.presentacion_nombre ?? ""} ${l.categoria}`).includes(q)
    );
  }, [g.lineas, filtro]);

  async function quitar(l: LineaEditable) {
    const detalle =
      l.id === null
        ? "Aún no está guardado: simplemente desaparece de la lista."
        : l.origen === "CLIENTE"
          ? "Lo pidió el cliente. Al guardar se quita del pedido y queda registrado en el historial."
          : "Al guardar se quita del pedido y queda registrado en el historial.";
    if (await confirmarEliminar(`¿Quitar «${l.nombre_producto}» del pedido?`, detalle)) g.quitarLinea(l.clave);
  }

  const totalActivas = g.activas.length;

  return (
    <div className={`gp-productos ${panelAbierto ? "con-panel" : ""}`}>
      <div className="gp-productos-principal">
        <div className="gp-barra">
          <div className="gp-barra-titulo">
            <h3>Productos del pedido</h3>
            <span className="gp-tenue">
              {totalActivas} producto{totalActivas === 1 ? "" : "s"}
            </span>
          </div>
          <div className="gp-leyenda" aria-label="Leyenda de origen">
            <span className="gp-marca original">Original</span>
            <span className="gp-marca agregado">Agregado</span>
            <span className="gp-marca personalizado">Personalizado</span>
          </div>
          {g.lineas.length > 6 && (
            <label className="gp-buscador-mini">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                placeholder="Filtrar productos…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                aria-label="Filtrar productos del pedido"
              />
            </label>
          )}
          {!soloLectura && (
            <button
              type="button"
              className="btn primario gp-boton-agregar"
              onClick={() => setPanelAbierto(true)}
              aria-expanded={panelAbierto}
            >
              <Plus size={16} aria-hidden="true" /> Agregar producto
            </button>
          )}
        </div>

        {g.lineas.length === 0 ? (
          <EstadoVacio
            icono={<PackageOpen size={22} />}
            titulo="El pedido no tiene productos"
            texto={soloLectura ? "No hay productos que mostrar." : "Agrega al menos un producto antes de guardar."}
            accion={
              !soloLectura ? (
                <button type="button" className="btn primario sm" onClick={() => setPanelAbierto(true)}>
                  <Plus size={14} /> Agregar producto
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="gp-tabla-marco">
            <table className="gp-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación / Unidad</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Precio unitario</th>
                  <th className="num">Subtotal</th>
                  <th className="acc">
                    <span className="gp-sr">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => (
                  <FilaProducto
                    key={l.clave}
                    l={l}
                    g={g}
                    soloLectura={soloLectura}
                    resaltada={resaltada === l.clave}
                    onQuitar={() => quitar(l)}
                  />
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="gp-tabla-vacia">
                      Ningún producto coincide con «{filtro}».
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    {g.cambios.eliminadas > 0 && (
                      <span className="gp-tenue">
                        {g.cambios.eliminadas} producto(s) se quitarán al guardar
                      </span>
                    )}
                  </td>
                  <td className="num gp-tabla-total">
                    <span>Total</span>
                    {formatoPrecio(g.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {panelAbierto && !soloLectura && (
        <PanelAgregarProducto
          g={g}
          onCerrar={() => setPanelAbierto(false)}
          onAgregado={(clave) => setResaltada(clave)}
        />
      )}
    </div>
  );
}

function FilaProducto({
  l,
  g,
  soloLectura,
  resaltada,
  onQuitar,
}: {
  l: LineaEditable;
  g: GestionPedido;
  soloLectura: boolean;
  resaltada: boolean;
  onQuitar: () => void;
}) {
  const errores = g.errores.get(l.clave) ?? {};
  const original = l.id !== null ? g.base.get(l.id) : undefined;
  const modificada = l.id !== null && !l.eliminada && lineaCambio(l, original);
  const producto = l.producto_id != null ? g.productoPorId.get(l.producto_id) : undefined;
  const presentaciones = producto?.presentaciones ?? [];
  const deshabilitado = soloLectura || l.eliminada;

  // Lo que pidió el cliente, si ya no coincide con lo que hay ahora.
  const cantidadPedida =
    l.cantidad_original !== null && aNumero(l.cantidad_original) !== aNumero(l.cantidad) ? l.cantidad_original : null;
  const precioPedido =
    l.precio_original !== null && aNumero(l.precio_original) !== aNumero(l.precio_unitario) ? l.precio_original : null;

  const clases = [
    "gp-fila",
    l.eliminada && "eliminada",
    l.id === null && "nueva",
    modificada && "modificada",
    resaltada && "resaltada",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr className={clases}>
      <td data-etiqueta="Producto" className="gp-celda-producto">
        <Miniatura src={producto?.imagen_url} nombre={l.nombre_producto} />
        <div className="gp-producto-texto">
          {l.personalizado && !deshabilitado ? (
            <input
              className={`gp-en-linea gp-nombre ${errores.nombre_producto ? "invalido" : ""}`}
              value={l.nombre_producto}
              onChange={(e) => g.cambiarLinea(l.clave, { nombre_producto: e.target.value })}
              aria-label="Nombre del producto personalizado"
              aria-invalid={Boolean(errores.nombre_producto)}
              title={errores.nombre_producto}
            />
          ) : (
            <span className="gp-nombre">{l.nombre_producto || "—"}</span>
          )}
          <span className="gp-producto-meta">
            <MarcasOrigen linea={l} />
            {l.categoria && <span className="gp-tenue">{l.categoria}</span>}
            {l.estado_revision === "PENDIENTE" && <span className="gp-marca revision">En revisión</span>}
            {l.eliminada && <span className="gp-marca quitado">Se quitará</span>}
          </span>
          {l.nota && <span className="gp-nota">“{l.nota}”</span>}
          {l.origen === "ADMIN" && l.agregado_por_nombre && (
            <span className="gp-tenue gp-pequeno">Agregado por {l.agregado_por_nombre}</span>
          )}
        </div>
      </td>

      <td data-etiqueta="Presentación">
        {l.personalizado ? (
          deshabilitado || g.unidades.length === 0 ? (
            <span>{l.unidad_nombre || <span className="gp-tenue">Sin unidad</span>}</span>
          ) : (
            <select
              className="gp-en-linea gp-select"
              value={l.unidad_id ?? ""}
              onChange={(e) => {
                const u = g.unidades.find((x) => x.id === Number(e.target.value));
                g.cambiarLinea(l.clave, { unidad_id: u?.id ?? null, unidad_nombre: u?.nombre_unidad ?? "" });
              }}
              aria-label="Unidad de medida"
            >
              <option value="">Sin unidad</option>
              {g.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_unidad}
                </option>
              ))}
            </select>
          )
        ) : deshabilitado || presentaciones.length <= 1 ? (
          <span className="gp-presentacion">
            {l.presentacion_nombre ?? "—"}
            <small>{l.unidad_nombre}</small>
          </span>
        ) : (
          <select
            className={`gp-en-linea gp-select ${errores.presentacion_id ? "invalido" : ""}`}
            value={l.presentacion_id ?? ""}
            onChange={(e) => g.cambiarPresentacion(l.clave, Number(e.target.value))}
            aria-label={`Presentación de ${l.nombre_producto}`}
          >
            {/* La actual, aunque ya no esté activa: no se cambia sola. */}
            {!presentaciones.some((p) => p.id === l.presentacion_id) && l.presentacion_id != null && (
              <option value={l.presentacion_id}>
                {l.presentacion_nombre} · {l.unidad_nombre} (inactiva)
              </option>
            )}
            {presentaciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_presentacion} · {p.unidad_venta_nombre}
              </option>
            ))}
          </select>
        )}
      </td>

      <td data-etiqueta="Cantidad" className="num">
        {deshabilitado ? (
          <span className="gp-valor">{formatearCantidad(l.cantidad || "0")}</span>
        ) : (
          <input
            className={`gp-en-linea gp-num ${errores.cantidad ? "invalido" : ""}`}
            inputMode="decimal"
            value={l.cantidad}
            onChange={(e) => g.cambiarLinea(l.clave, { cantidad: e.target.value })}
            onFocus={(e) => e.target.select()}
            aria-label={`Cantidad de ${l.nombre_producto}`}
            aria-invalid={Boolean(errores.cantidad)}
            title={errores.cantidad}
          />
        )}
        {cantidadPedida !== null && (
          <span className="gp-antes" title="Cantidad que pidió el cliente">
            Pidió {formatearCantidad(cantidadPedida)}
          </span>
        )}
        {errores.cantidad && <span className="gp-error-celda">{errores.cantidad}</span>}
      </td>

      <td data-etiqueta="Precio unitario" className="num">
        {deshabilitado ? (
          <span className="gp-valor">{formatoPrecio(l.precio_unitario)}</span>
        ) : (
          <span className={`gp-en-linea gp-precio ${errores.precio_unitario ? "invalido" : ""}`}>
            <span aria-hidden="true">$</span>
            <input
              inputMode="decimal"
              value={l.precio_unitario}
              onChange={(e) => g.cambiarLinea(l.clave, { precio_unitario: e.target.value })}
              onFocus={(e) => e.target.select()}
              aria-label={`Precio unitario de ${l.nombre_producto}`}
              aria-invalid={Boolean(errores.precio_unitario)}
              title={errores.precio_unitario}
            />
          </span>
        )}
        {precioPedido !== null && (
          <span className="gp-antes" title="Precio con el que llegó el pedido">
            Antes {formatoPrecio(precioPedido)}
          </span>
        )}
        {errores.precio_unitario && <span className="gp-error-celda">{errores.precio_unitario}</span>}
      </td>

      <td data-etiqueta="Subtotal" className="num gp-subtotal">
        {formatoPrecio(subtotalDe(l))}
      </td>

      <td className="acc">
        {!soloLectura && (
          <div className="gp-acciones-fila">
            {l.eliminada ? (
              <Tooltip label="Restaurar producto">
                <button
                  type="button"
                  className="btn-icon exito"
                  onClick={() => g.restaurarLinea(l.clave)}
                  aria-label={`Restaurar ${l.nombre_producto}`}
                >
                  <Undo2 size={15} />
                </button>
              </Tooltip>
            ) : (
              <>
                {modificada && (
                  <Tooltip label="Deshacer cambios de esta línea">
                    <button
                      type="button"
                      className="btn-icon editar"
                      onClick={() => g.revertirLinea(l.clave)}
                      aria-label={`Deshacer cambios de ${l.nombre_producto}`}
                    >
                      <RotateCcw size={15} />
                    </button>
                  </Tooltip>
                )}
                <Tooltip label="Quitar del pedido">
                  <button
                    type="button"
                    className="btn-icon peligro"
                    onClick={onQuitar}
                    aria-label={`Quitar ${l.nombre_producto} del pedido`}
                  >
                    <Trash2 size={15} />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
