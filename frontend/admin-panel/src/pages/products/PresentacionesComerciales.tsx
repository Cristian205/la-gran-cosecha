import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  actualizarPresentacion,
  crearPresentacion,
  obtenerPresentaciones,
  quitarImagenPresentacion,
  reordenarPresentaciones,
  subirImagenPresentacion,
} from "../../api/resources";
import { Tooltip } from "../../components/Tooltip";
import type { UnidadMedida } from "../../types";
import { formatoPrecio } from "../../utils";
import { alertaError, alertaExito, confirmarAccion } from "../../utils/alertas";
import { aDecimalApi, describirRegla } from "../../utils/cantidades";
import { PresentacionFormModal, type ModoFormulario } from "./PresentacionFormModal";
import {
  aPayload,
  borradorDesde,
  borradorVacio,
  duplicado,
  erroresDesdeServidor,
  textoPrecio,
  type BorradorPresentacion,
  type ErroresPresentacion,
} from "./presentaciones";

interface Props {
  /** Con id, cada cambio se guarda al momento; sin id (producto nuevo), son borradores. */
  productoId: number | null;
  productoNombre: string;
  presentaciones: BorradorPresentacion[];
  onCambiar: (siguiente: BorradorPresentacion[]) => void;
  cargando: boolean;
  errorCarga: string | null;
  onReintentar: () => void;
  unidades: UnidadMedida[];
  onUnidadCreada: (u: UnidadMedida) => void;
  unidadBase: UnidadMedida | null;
  puedeEditar: boolean;
  /** Se guardó algo en el servidor: el catálogo de detrás debe refrescarse. */
  onPersistido: () => void;
  /** Error de la sección al intentar guardar el producto (ej: ninguna activa). */
  error?: string | null;
}

interface Edicion {
  modo: ModoFormulario;
  borrador: BorradorPresentacion;
}

function errorDeRed(err: unknown): ErroresPresentacion {
  const e = err as { response?: { status?: number; data?: unknown } };
  if (!e?.response) {
    return {
      general:
        "No se pudo conectar con el servidor. Revisa tu conexión: los datos siguen en el formulario, vuelve a intentarlo.",
    };
  }
  if (e.response.status === 403) {
    return { general: "No tienes permiso para modificar las presentaciones de este producto." };
  }
  const errores = erroresDesdeServidor(e.response.data);
  if (e.response.status === 409) {
    return {
      general:
        errores.general ??
        "Otra persona modificó esta presentación mientras la editabas. Cierra y vuelve a abrirla para ver los cambios.",
    };
  }
  if (Object.keys(errores).length === 0) {
    errores.general = "El servidor no pudo guardar la presentación. Inténtalo de nuevo en un momento.";
  }
  return errores;
}

export function PresentacionesComerciales({
  productoId,
  productoNombre,
  presentaciones,
  onCambiar,
  cargando,
  errorCarga,
  onReintentar,
  unidades,
  onUnidadCreada,
  unidadBase,
  puedeEditar,
  onPersistido,
  error,
}: Props) {
  const persistido = productoId !== null;
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  /** Filas con una operación en curso: sus botones se bloquean (doble clic). */
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const ultimo = useRef(presentaciones);
  ultimo.current = presentaciones;

  const activas = presentaciones.filter((p) => p.estado_presentacion).length;
  const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));

  function marcar(clave: string, ocupada: boolean) {
    setOcupadas((prev) => {
      const s = new Set(prev);
      if (ocupada) s.add(clave);
      else s.delete(clave);
      return s;
    });
  }

  /** Relee del servidor (fotos recién subidas, versiones nuevas). */
  async function recargar(): Promise<BorradorPresentacion[] | null> {
    if (!productoId) return null;
    try {
      const frescas = (await obtenerPresentaciones(productoId)).map(borradorDesde);
      onCambiar(frescas);
      return frescas;
    } catch {
      return null;
    }
  }

  async function guardar(b: BorradorPresentacion): Promise<ErroresPresentacion | null> {
    const modo = edicion?.modo ?? "crear";
    if (!persistido) {
      // Producto nuevo: la presentación queda en el borrador y nace con él.
      const limpio = { ...b, erroresServidor: undefined };
      const existe = ultimo.current.some((p) => p.clave === b.clave);
      onCambiar(existe ? ultimo.current.map((p) => (p.clave === b.clave ? limpio : p)) : [...ultimo.current, limpio]);
      setEdicion(null);
      alertaExito(existe ? "Presentación actualizada" : "Presentación agregada. Se guardará con el producto.");
      return null;
    }

    let guardada;
    try {
      const datos = aPayload(b, productoId);
      guardada = b.id ? await actualizarPresentacion(b.id, datos) : await crearPresentacion(datos);
    } catch (err) {
      return errorDeRed(err);
    }

    // La presentación ya existe: un fallo con la foto no la deshace, se avisa.
    let fotoFallida = false;
    try {
      if (b.archivo) await subirImagenPresentacion(guardada.id, b.archivo);
      else if (b.quitarImagen) await quitarImagenPresentacion(guardada.id);
    } catch {
      fotoFallida = true;
    }

    const nueva = borradorDesde(guardada);
    const lista = b.id
      ? ultimo.current.map((p) => (p.id === b.id ? nueva : p))
      : [...ultimo.current, nueva];
    onCambiar(lista);
    if (b.archivo || b.quitarImagen) await recargar();
    onPersistido();
    setEdicion(null);
    if (fotoFallida) {
      alertaError("La presentación se guardó, pero no se pudo actualizar la foto. Edítala para intentarlo de nuevo.");
    } else {
      alertaExito(
        modo === "editar" ? "Presentación actualizada" : modo === "duplicar" ? "Presentación duplicada" : "Presentación creada"
      );
    }
    return null;
  }

  async function alternarEstado(b: BorradorPresentacion) {
    const activar = !b.estado_presentacion;
    if (!activar && activas === 1 && persistido) {
      if (
        !(await confirmarAccion(
          `¿Desactivar "${b.nombre_presentacion}"?`,
          "Es la única presentación activa: el producto quedará sin precio en la tienda y no se podrá pedir.",
          "Desactivar"
        ))
      )
        return;
    } else if (!activar && persistido) {
      if (
        !(await confirmarAccion(
          `¿Desactivar "${b.nombre_presentacion}"?`,
          "Dejará de ofrecerse en nuevos pedidos. Los pedidos y facturas anteriores no cambian.",
          "Desactivar"
        ))
      )
        return;
    }
    if (!persistido) {
      onCambiar(ultimo.current.map((p) => (p.clave === b.clave ? { ...p, estado_presentacion: activar } : p)));
      return;
    }
    marcar(b.clave, true);
    try {
      const r = await actualizarPresentacion(b.id!, { estado_presentacion: activar, version: b.version });
      onCambiar(ultimo.current.map((p) => (p.clave === b.clave ? borradorDesde(r) : p)));
      onPersistido();
      alertaExito(activar ? "Presentación activada" : "Presentación desactivada");
    } catch (err) {
      const e = errorDeRed(err);
      alertaError(e.general ?? Object.values(e)[0] ?? "No se pudo cambiar el estado.");
      if ((err as { response?: { status?: number } })?.response?.status === 409) await recargar();
    } finally {
      marcar(b.clave, false);
    }
  }

  async function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta;
    if (destino < 0 || destino >= presentaciones.length) return;
    const anterior = presentaciones;
    const siguiente = [...presentaciones];
    [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
    onCambiar(siguiente); // optimista: se ve al instante
    if (!persistido) return;
    const clave = anterior[indice].clave;
    marcar(clave, true);
    try {
      const r = await reordenarPresentaciones(productoId, siguiente.map((p) => p.id!));
      onCambiar(r.map(borradorDesde));
      onPersistido();
    } catch (err) {
      onCambiar(anterior);
      alertaError(errorDeRed(err).general ?? "No se pudo cambiar el orden.");
      if ((err as { response?: { status?: number } })?.response?.status === 409) await recargar();
    } finally {
      marcar(clave, false);
    }
  }

  function quitarBorrador(b: BorradorPresentacion) {
    onCambiar(ultimo.current.filter((p) => p.clave !== b.clave));
  }

  return (
    <section className="pc" aria-labelledby="pc-titulo">
      <div className="pc-cabecera">
        <div>
          <h3 id="pc-titulo" className="pc-titulo">
            <Layers size={16} aria-hidden /> Presentaciones comerciales
            {presentaciones.length > 0 && (
              <span className="pc-contador">
                {activas} activa{activas === 1 ? "" : "s"}
                {presentaciones.length > activas && ` · ${presentaciones.length - activas} inactiva${presentaciones.length - activas === 1 ? "" : "s"}`}
              </span>
            )}
          </h3>
          <p className="pc-descripcion">
            Las formas de comprar este producto, cada una con su precio y su regla de cantidad.
            {!persistido && " Se guardan junto con el producto."}
          </p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            className="btn primario sm pc-agregar"
            onClick={() => setEdicion({ modo: "crear", borrador: borradorVacio() })}
            disabled={cargando || Boolean(errorCarga)}
          >
            <Plus size={14} aria-hidden /> Agregar presentación
          </button>
        )}
      </div>

      {error && (
        <p className="campo-error pc-error" role="alert">
          <AlertTriangle size={13} aria-hidden /> {error}
        </p>
      )}

      {cargando ? (
        <div className="pc-lista" aria-busy="true" aria-label="Cargando presentaciones">
          {[0, 1].map((i) => (
            <div key={i} className="pc-fila pc-fila-esqueleto">
              <div className="skeleton-line skeleton-shimmer" />
              <div className="skeleton-line skeleton-shimmer corta" />
            </div>
          ))}
        </div>
      ) : errorCarga ? (
        <div className="pc-vacio pc-vacio-error" role="alert">
          <AlertTriangle size={20} aria-hidden />
          <span>{errorCarga}</span>
          <button type="button" className="btn secundario sm" onClick={onReintentar}>
            <RefreshCw size={13} aria-hidden /> Reintentar
          </button>
        </div>
      ) : presentaciones.length === 0 ? (
        <div className="pc-vacio">
          <Layers size={22} aria-hidden />
          <strong>Aún no hay presentaciones</strong>
          <span>Agrega al menos una (por ejemplo «Kilo» o «Caja x 12») para que el producto tenga precio y se pueda pedir.</span>
        </div>
      ) : (
        <ol className="pc-lista">
          {presentaciones.map((p, i) => {
            const unidad = p.unidad_venta === "" ? undefined : unidadesPorId.get(p.unidad_venta);
            const ocupada = ocupadas.has(p.clave);
            const conErrores = p.erroresServidor && Object.keys(p.erroresServidor).length > 0;
            const precio = aDecimalApi(textoPrecio(p.precio_unitario));
            return (
              <li
                key={p.clave}
                className={`pc-fila ${p.estado_presentacion ? "" : "inactiva"} ${conErrores ? "con-error" : ""}`}
              >
                {puedeEditar && presentaciones.length > 1 && (
                  <div className="pc-orden">
                    <button
                      type="button"
                      className="pc-orden-btn"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0 || ocupada}
                      aria-label={`Subir ${p.nombre_presentacion}`}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="pc-orden-btn"
                      onClick={() => mover(i, 1)}
                      disabled={i === presentaciones.length - 1 || ocupada}
                      aria-label={`Bajar ${p.nombre_presentacion}`}
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                )}
                {p.imagen_url ? (
                  <img className="pc-foto" src={p.imagen_url} alt="" />
                ) : (
                  <span className="pc-foto pc-foto-vacia" aria-hidden>
                    {(p.nombre_presentacion.trim()[0] ?? "?").toUpperCase()}
                  </span>
                )}
                <div className="pc-info">
                  <div className="pc-nombre">
                    {p.nombre_presentacion}
                    {!p.id && persistido === false && <span className="pc-etiqueta">Nueva</span>}
                  </div>
                  <div className="pc-meta">
                    <span>{unidad?.nombre_unidad ?? "Sin unidad"}</span>
                    <span aria-hidden>·</span>
                    <span title="Regla de cantidad">{describirRegla(p.cantidad_minima, p.incremento_cantidad)}</span>
                  </div>
                  {conErrores && (
                    <div className="pc-alerta">
                      <AlertTriangle size={12} aria-hidden /> Revisa esta presentación antes de guardar
                    </div>
                  )}
                </div>
                <div className="pc-precio">
                  <span className="pc-precio-valor">{precio ? formatoPrecio(precio) : "—"}</span>
                  <span className="pc-precio-unidad">/ {unidad?.abreviatura_unidad ?? "u"}</span>
                </div>
                <span className={`badge ${p.estado_presentacion ? "activo" : "inactivo"} pc-estado`}>
                  {p.estado_presentacion ? "Activa" : "Inactiva"}
                </span>
                {puedeEditar && (
                  <div className="acciones pc-acciones">
                    <Tooltip label="Editar">
                      <button
                        type="button"
                        className="btn-icon editar"
                        onClick={() => setEdicion({ modo: "editar", borrador: p })}
                        disabled={ocupada}
                        aria-label={`Editar ${p.nombre_presentacion}`}
                      >
                        <Pencil size={15} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Duplicar">
                      <button
                        type="button"
                        className="btn-icon info"
                        onClick={() => setEdicion({ modo: "duplicar", borrador: duplicado(p) })}
                        disabled={ocupada}
                        aria-label={`Duplicar ${p.nombre_presentacion}`}
                      >
                        <Copy size={15} />
                      </button>
                    </Tooltip>
                    <Tooltip label={p.estado_presentacion ? "Desactivar" : "Activar"}>
                      <button
                        type="button"
                        className={`btn-icon ${p.estado_presentacion ? "peligro" : "exito"}`}
                        onClick={() => alternarEstado(p)}
                        disabled={ocupada}
                        aria-label={`${p.estado_presentacion ? "Desactivar" : "Activar"} ${p.nombre_presentacion}`}
                      >
                        {p.estado_presentacion ? <PowerOff size={15} /> : <Power size={15} />}
                      </button>
                    </Tooltip>
                    {!persistido && (
                      <Tooltip label="Quitar">
                        <button
                          type="button"
                          className="btn-icon peligro"
                          onClick={() => quitarBorrador(p)}
                          aria-label={`Quitar ${p.nombre_presentacion}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {edicion && (
        <PresentacionFormModal
          // Una instancia por apertura: el formulario nace con los datos de esa fila.
          key={edicion.borrador.clave + edicion.modo}
          modo={edicion.modo}
          inicial={edicion.borrador}
          productoNombre={productoNombre}
          unidadBase={unidadBase}
          unidades={unidades}
          hermanas={presentaciones}
          puedeCrearUnidad={puedeEditar}
          onUnidadCreada={onUnidadCreada}
          onGuardar={guardar}
          onCerrar={() => setEdicion(null)}
        />
      )}
    </section>
  );
}
