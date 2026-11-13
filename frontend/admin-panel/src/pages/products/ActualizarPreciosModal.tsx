import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDollarSign, Info } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { actualizarPreciosPresentaciones } from "../../api/resources";
import { Modal } from "../../components/Modal";
import { PasosModal } from "../../components/PasosModal";
import type { Presentacion, UnidadMedida } from "../../types";
import { extraerMensajeError, formatoPrecio } from "../../utils";
import { aDecimalApi } from "../../utils/cantidades";
import { textoPrecio, validarPrecio, type BorradorPresentacion } from "./presentaciones";

/**
 * «Actualizar precios»: varias presentaciones de un producto a la vez, cada
 * una con su precio escrito a mano (nada de subir un % a todo).
 *
 * 1 · Editar: tabla con el precio actual y un campo para el nuevo. Escribir
 *     un precio distinto marca la fila; la casilla decide si entra o no.
 *     Tab y Enter pasan al siguiente precio.
 * 2 · Confirmar: anterior → nuevo y la diferencia de cada uno. Se aplica
 *     todo junto o nada (una transacción en el servidor). Si falla, se dice
 *     y nada se muestra como guardado.
 *
 * Las inactivas no aparecen: no se cambian «de paso».
 */
interface Fila {
  b: BorradorPresentacion;
  actual: string;
  unidad: string;
}

export function ActualizarPreciosModal({
  productoId,
  productoNombre,
  presentaciones,
  unidades,
  onCerrar,
  onAplicado,
}: {
  productoId: number;
  productoNombre: string;
  presentaciones: BorradorPresentacion[];
  unidades: UnidadMedida[];
  onCerrar: () => void;
  onAplicado: (lista: Presentacion[], cambiadas: number) => void;
}) {
  const unidadPorId = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades]);
  const filas: Fila[] = useMemo(
    () =>
      presentaciones
        .filter((p) => p.estado_presentacion && p.id)
        .map((b) => ({
          b,
          actual: aDecimalApi(textoPrecio(b.precio_unitario)) ?? "0",
          unidad: (b.unidad_venta !== "" && unidadPorId.get(b.unidad_venta)?.abreviatura_unidad) || "u",
        })),
    [presentaciones, unidadPorId]
  );
  const inactivas = presentaciones.filter((p) => !p.estado_presentacion).length;

  const [paso, setPaso] = useState<"editar" | "confirmar">("editar");
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  // Cada fila: su precio nuevo validado y si de verdad cambia.
  const estado = filas.map((f) => {
    const texto = textos[f.b.clave] ?? "";
    const v = texto.trim() ? validarPrecio(texto) : { valor: null };
    const cambia = Boolean(v.valor) && Number(v.valor) !== Number(f.actual);
    return { ...f, texto, valor: v.valor, error: v.error, cambia, elegida: elegidas.has(f.b.clave) };
  });
  const aplicar = estado.filter((e) => e.elegida && e.cambia);
  const conError = estado.filter((e) => e.elegida && (e.error || !e.texto.trim()));
  const sinCambio = estado.filter((e) => e.elegida && !e.error && e.texto.trim() && !e.cambia);

  function escribir(clave: string, texto: string) {
    setTextos((t) => ({ ...t, [clave]: texto }));
    setError(null);
    // Escribir un precio selecciona la fila; borrarlo la deselecciona.
    setElegidas((s) => {
      const n = new Set(s);
      if (texto.trim()) n.add(clave);
      else n.delete(clave);
      return n;
    });
  }

  function alternar(clave: string) {
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  }

  const todas = filas.length > 0 && filas.every((f) => elegidas.has(f.b.clave));
  function alternarTodas() {
    setElegidas(todas ? new Set() : new Set(filas.map((f) => f.b.clave)));
  }

  function revisar() {
    setIntento(true);
    if (conError.length > 0) {
      const i = estado.findIndex((e) => e.elegida && (e.error || !e.texto.trim()));
      campos.current[i]?.focus();
      return;
    }
    if (aplicar.length === 0) {
      setError("Escribe al menos un precio nuevo distinto del actual.");
      return;
    }
    setError(null);
    setPaso("confirmar");
  }

  async function confirmar() {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await actualizarPreciosPresentaciones(
        productoId,
        aplicar.map((e) => ({ id: e.b.id!, precio: e.valor!, version: e.b.version }))
      );
      onAplicado(r.presentaciones, r.cambiadas);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? extraerMensajeError(err, "Otra persona cambió estos precios mientras editabas. Cierra y vuelve a abrir para ver los actuales.")
          : status === 403
            ? "No tienes permiso para cambiar precios de este producto."
            : extraerMensajeError(err, "No se pudieron guardar los precios. No se aplicó ningún cambio; inténtalo de nuevo.")
      );
    } finally {
      setGuardando(false);
    }
  }

  const diferencia = (e: (typeof estado)[number]) => Number(e.valor) - Number(e.actual);
  const porcentaje = (e: (typeof estado)[number]) =>
    Number(e.actual) > 0 ? (diferencia(e) / Number(e.actual)) * 100 : null;

  return (
    <Modal
      amplio
      ancho
      expandible
      cerrarConEscape={!guardando}
      titulo="Actualizar precios"
      subtitulo={productoNombre}
      clase="modal-precios"
      onCerrar={() => !guardando && onCerrar()}
      subcabecera={
        <PasosModal
          etiqueta="Pasos para actualizar precios"
          activo={paso}
          onCambiar={(c) => (c === "confirmar" ? revisar() : setPaso("editar"))}
          pasos={[
            { clave: "editar", titulo: "Nuevos precios", detalle: `${aplicar.length} con cambio`, hecho: paso === "confirmar" },
            { clave: "confirmar", titulo: "Confirmar", detalle: "Revisa antes de aplicar", bloqueado: aplicar.length === 0 },
          ]}
        />
      }
      footer={
        paso === "editar" ? (
          <>
            {aplicar.length > 0 && (
              <span className="pie-aviso pp-pie-aviso">
                {aplicar.length} {aplicar.length === 1 ? "precio por cambiar" : "precios por cambiar"}
              </span>
            )}
            <button type="button" className="btn secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="btn primario btn-con-icono" onClick={revisar}>
              Revisar cambios <ArrowRight size={16} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn secundario btn-con-icono" onClick={() => setPaso("editar")} disabled={guardando}>
              <ArrowLeft size={16} aria-hidden /> Atrás
            </button>
            <button type="button" className="btn primario btn-con-icono" onClick={confirmar} disabled={guardando} aria-busy={guardando}>
              <Check size={16} aria-hidden />
              {guardando ? "Aplicando…" : `Aplicar ${aplicar.length} ${aplicar.length === 1 ? "cambio" : "cambios"}`}
            </button>
          </>
        )
      }
    >
      {error && (
        <div className="error-box pp-error" role="alert">
          <AlertTriangle size={15} aria-hidden /> {error}
        </div>
      )}

      {paso === "editar" ? (
        filas.length === 0 ? (
          <div className="vacio">No hay presentaciones activas. Activa una para cambiar su precio.</div>
        ) : (
          <>
            <p className="pp-intro">
              Escribe el precio nuevo de cada presentación que quieras cambiar. Cada una conserva su propio precio: cambiar
              una no toca las demás. <kbd>Tab</kbd> o <kbd>Enter</kbd> pasan a la siguiente.
            </p>
            <div className="pp-tabla-scroll">
              <table className="pp-tabla">
                <thead>
                  <tr>
                    <th className="pp-col-check">
                      <input
                        type="checkbox"
                        checked={todas}
                        onChange={alternarTodas}
                        aria-label={todas ? "Quitar todas" : "Seleccionar todas"}
                      />
                    </th>
                    <th>Presentación</th>
                    <th className="pp-num">Precio actual</th>
                    <th className="pp-col-nuevo">Nuevo precio</th>
                    <th className="pp-num">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.map((e, i) => {
                    const mostrarError = intento && e.elegida && (e.error || !e.texto.trim());
                    return (
                      <tr key={e.b.clave} className={`${e.elegida ? "elegida" : ""} ${e.cambia ? "modificada" : ""}`}>
                        <td className="pp-col-check">
                          <input
                            type="checkbox"
                            checked={e.elegida}
                            onChange={() => alternar(e.b.clave)}
                            aria-label={`Incluir ${e.b.nombre_presentacion}`}
                          />
                        </td>
                        <td>
                          <span className="pp-nombre">
                            {e.cambia && <span className="pp-marca" title="Modificado" aria-label="Modificado" />}
                            {e.b.nombre_presentacion}
                          </span>
                          <span className="pp-unidad">
                            {(e.b.unidad_venta !== "" && unidadPorId.get(e.b.unidad_venta)?.nombre_unidad) || "Sin unidad"}
                          </span>
                        </td>
                        <td className="pp-num pp-actual">
                          {formatoPrecio(e.actual)}
                          <small> / {e.unidad}</small>
                        </td>
                        <td className="pp-col-nuevo">
                          <div className={`pp-input ${mostrarError ? "con-error" : ""} ${e.cambia ? "con-cambio" : ""}`}>
                            <span aria-hidden>$</span>
                            <input
                              ref={(el) => {
                                campos.current[i] = el;
                              }}
                              value={e.texto}
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder={String(Number(e.actual)).replace(".", ",")}
                              aria-label={`Nuevo precio de ${e.b.nombre_presentacion}`}
                              aria-invalid={Boolean(mostrarError)}
                              onChange={(ev) => escribir(e.b.clave, ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") {
                                  ev.preventDefault();
                                  const siguiente = campos.current[i + 1];
                                  if (siguiente) siguiente.focus();
                                  else revisar();
                                }
                              }}
                            />
                          </div>
                          {mostrarError && (
                            <span className="pp-campo-error">{e.error ?? "Escribe el precio nuevo o desmarca la fila."}</span>
                          )}
                        </td>
                        <td className="pp-num">
                          {e.cambia ? (
                            <span className={`pp-dif ${diferencia(e) > 0 ? "sube" : "baja"}`}>
                              {diferencia(e) > 0 ? "+" : "−"}
                              {formatoPrecio(Math.abs(diferencia(e)))}
                            </span>
                          ) : (
                            <span className="pp-sin">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(inactivas > 0 || sinCambio.length > 0) && (
              <p className="pp-nota">
                <Info size={14} aria-hidden />
                <span>
                  {inactivas > 0 &&
                    `${inactivas} ${inactivas === 1 ? "presentación inactiva no aparece" : "presentaciones inactivas no aparecen"}: actívala para cambiar su precio. `}
                  {sinCambio.length > 0 &&
                    `${sinCambio.length} ${sinCambio.length === 1 ? "seleccionada tiene" : "seleccionadas tienen"} el mismo precio actual y no se cambiará.`}
                </span>
              </p>
            )}
          </>
        )
      ) : (
        <>
          <p className="pp-intro">
            <CircleDollarSign size={15} aria-hidden /> Se aplicarán <strong>{aplicar.length}</strong>{" "}
            {aplicar.length === 1 ? "cambio" : "cambios"} juntos. Si uno falla, no se guarda ninguno. Cada cambio queda en el
            historial con tu usuario y la hora. Los pedidos ya hechos conservan su precio.
          </p>
          <div className="pp-tabla-scroll">
            <table className="pp-tabla pp-tabla-resumen">
              <thead>
                <tr>
                  <th>Presentación</th>
                  <th className="pp-num">Anterior</th>
                  <th className="pp-num">Nuevo</th>
                  <th className="pp-num">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {aplicar.map((e) => {
                  const pct = porcentaje(e);
                  return (
                    <tr key={e.b.clave}>
                      <td>
                        <span className="pp-nombre">{e.b.nombre_presentacion}</span>
                        <span className="pp-unidad">por {e.unidad}</span>
                      </td>
                      <td className="pp-num pp-tachado">{formatoPrecio(e.actual)}</td>
                      <td className="pp-num pp-nuevo">{formatoPrecio(e.valor!)}</td>
                      <td className="pp-num">
                        <span className={`pp-dif ${diferencia(e) > 0 ? "sube" : "baja"}`}>
                          {diferencia(e) > 0 ? "+" : "−"}
                          {formatoPrecio(Math.abs(diferencia(e)))}
                          {pct !== null && (
                            <small>
                              {" "}
                              ({diferencia(e) > 0 ? "+" : "−"}
                              {Math.abs(pct).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %)
                            </small>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
