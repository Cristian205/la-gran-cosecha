import { CheckCircle2, PackagePlus, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  obtenerCategorias,
  obtenerProductosPendientes,
  obtenerUnidades,
  rechazarProductoPendiente,
} from "../api/resources";
import { PendingProductApprovalModal } from "./products/PendingProductApprovalModal";
import { Tooltip } from "../components/Tooltip";
import { ColumnPickerButton } from "../components/ColumnPickerButton";
import { ThOrdenable } from "../components/ThOrdenable";
import { useColumnas } from "../hooks/useColumnas";
import { useOrdenTabla, type ExtractoresOrden } from "../hooks/useOrdenTabla";
import type { Categoria, ProductoPendiente, UnidadMedida } from "../types";
import { extraerMensajeError, formatoFecha } from "../utils";
import { alertaError, confirmarRechazo } from "../utils/alertas";

const DEFINICIONES_PENDIENTES: Record<string, { etiqueta: string; render: (p: ProductoPendiente) => ReactNode }> = {
  producto: { etiqueta: "Producto", render: (p) => p.nombre_personalizado },
  cantidad: { etiqueta: "Cantidad", render: (p) => `${p.cantidad} ${p.unidad_nombre || "unid."}` },
  categoria: { etiqueta: "Categoría", render: (p) => p.categoria_nombre || "—" },
  pedido: { etiqueta: "Pedido", render: (p) => `#${p.pedido}` },
  cliente: { etiqueta: "Cliente", render: (p) => p.cliente_nombre || "—" },
  fecha: { etiqueta: "Fecha", render: (p) => formatoFecha(p.fecha_modificacion) },
};
const CLAVES_PENDIENTES = Object.keys(DEFINICIONES_PENDIENTES);
const ETIQUETAS_PENDIENTES = Object.fromEntries(
  Object.entries(DEFINICIONES_PENDIENTES).map(([clave, def]) => [clave, def.etiqueta])
);

const EXTRACTORES_PENDIENTES: ExtractoresOrden<ProductoPendiente> = {
  producto: (p) => p.nombre_personalizado,
  cantidad: (p) => parseFloat(p.cantidad),
  categoria: (p) => p.categoria_nombre,
  pedido: (p) => p.pedido,
  cliente: (p) => p.cliente_nombre,
  fecha: (p) => p.fecha_modificacion,
};

export function PendingProductsPage() {
  const [pendientes, setPendientes] = useState<ProductoPendiente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aprobando, setAprobando] = useState<ProductoPendiente | null>(null);
  const [rechazandoId, setRechazandoId] = useState<number | null>(null);
  const {
    estado: columnasEstado,
    visibles: columnasVisibles,
    alternar: alternarColumna,
    mover: moverColumna,
    restablecer: restablecerColumnas,
  } = useColumnas("productos-pendientes", CLAVES_PENDIENTES);
  const { columna: columnaOrden, direccion: direccionOrden, alternarColumna: ordenarPorColumna, ordenar } =
    useOrdenTabla<ProductoPendiente>();

  function cargar() {
    setCargando(true);
    obtenerProductosPendientes()
      .then(setPendientes)
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    obtenerCategorias().then(setCategorias);
    obtenerUnidades().then(setUnidades);
  }, []);

  async function rechazar(p: ProductoPendiente) {
    const confirmado = await confirmarRechazo(
      `¿Rechazar "${p.nombre_personalizado}"?`,
      `Seguirá apareciendo en el pedido #${p.pedido}, pero no se agregará al catálogo.`
    );
    if (!confirmado) return;
    setRechazandoId(p.id);
    try {
      await rechazarProductoPendiente(p.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo rechazar el producto."));
    } finally {
      setRechazandoId(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Productos pendientes</h1>
      </div>

      <div className="contenido">
        <div className="panel">
          <div className="cabecera">
            <h2>Sugeridos por clientes ({pendientes.length})</h2>
            <ColumnPickerButton
              estado={columnasEstado}
              etiquetas={ETIQUETAS_PENDIENTES}
              onAlternar={alternarColumna}
              onRestablecer={restablecerColumnas}
            />
          </div>

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  {columnasVisibles.map((clave) => (
                    <ThOrdenable
                      key={clave}
                      clave={clave}
                      etiqueta={ETIQUETAS_PENDIENTES[clave]}
                      columnaActiva={columnaOrden}
                      direccion={direccionOrden}
                      onClick={ordenarPorColumna}
                      onMover={moverColumna}
                    />
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={1 + columnasVisibles.length}>
                        <div
                          className="skeleton-line skeleton-shimmer en-celda"
                          style={{ width: `${72 - i * 6}%` }}
                        />
                      </td>
                    </tr>
                  ))
                ) : pendientes.length === 0 ? (
                  <tr>
                    <td colSpan={1 + columnasVisibles.length} className="vacio">
                      <PackagePlus size={20} style={{ opacity: 0.5, marginRight: ".4rem" }} />
                      No hay productos personalizados esperando revisión.
                    </td>
                  </tr>
                ) : (
                  ordenar(pendientes, EXTRACTORES_PENDIENTES).map((p) => (
                    <tr key={p.id}>
                      {columnasVisibles.map((clave) => (
                        <td key={clave}>{DEFINICIONES_PENDIENTES[clave].render(p)}</td>
                      ))}
                      <td>
                        <div className="acciones">
                          <Tooltip label="Aceptar y guardar en catálogo">
                            <button
                              type="button"
                              className="btn-icon editar"
                              onClick={() => setAprobando(p)}
                              aria-label="Aceptar"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Rechazar (queda solo en el pedido)">
                            <button
                              type="button"
                              className="btn-icon peligro"
                              disabled={rechazandoId === p.id}
                              onClick={() => rechazar(p)}
                              aria-label="Rechazar"
                            >
                              <XCircle size={16} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {aprobando && (
        <PendingProductApprovalModal
          pendiente={aprobando}
          categorias={categorias}
          unidades={unidades}
          onCerrar={() => setAprobando(null)}
          onAprobado={() => {
            setAprobando(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
