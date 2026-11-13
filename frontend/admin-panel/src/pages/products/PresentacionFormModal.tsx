import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Calculator, Check, Info, Ruler, Save, Scale } from "lucide-react";
import { Combobox } from "../../components/Combobox";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import { PasosModal, type PasoModal } from "../../components/PasosModal";
import { crearUnidad } from "../../api/resources";
import type { UnidadMedida } from "../../types";
import { extraerMensajeError, formatoPrecio } from "../../utils";
import { confirmarDescartar } from "../../utils/alertas";
import {
  MAX_DECIMALES,
  PRESETS_CANTIDAD,
  ejemplosCantidad,
  aDecimalApi,
  formatearCantidad,
  leerNumero,
} from "../../utils/cantidades";
import {
  ORDEN_CAMPOS,
  textoPrecio,
  validarBorrador,
  type BorradorPresentacion,
  type CampoPresentacion,
  type ErroresPresentacion,
} from "./presentaciones";
import "./producto-modal.css";

export type ModoFormulario = "crear" | "editar" | "duplicar";

/**
 * Los pasos del asistente, igual que «Nuevo producto»: crear y duplicar van
 * en orden; editar usa las mismas secciones como pestañas libres.
 */
type Paso = "identificacion" | "precio" | "revision";
const ORDEN: Paso[] = ["identificacion", "precio", "revision"];
const CAMPOS_DE: Record<Exclude<Paso, "revision">, CampoPresentacion[]> = {
  identificacion: ["nombre_presentacion", "unidad_venta", "factor_conversion"],
  precio: ["precio_unitario", "cantidad_minima", "incremento_cantidad", "decimales_cantidad"],
};
/** En qué paso está un campo (para volver a él si tiene un error). */
function pasoDe(campo: CampoPresentacion): Paso {
  return CAMPOS_DE.identificacion.includes(campo) ? "identificacion" : "precio";
}

interface Props {
  modo: ModoFormulario;
  inicial: BorradorPresentacion;
  productoNombre: string;
  /** Unidad de referencia del producto, para la equivalencia. */
  unidadBase: UnidadMedida | null;
  unidades: UnidadMedida[];
  /** Las demás presentaciones del producto (para detectar duplicados). */
  hermanas: BorradorPresentacion[];
  puedeCrearUnidad: boolean;
  onUnidadCreada: (u: UnidadMedida) => void;
  /**
   * Guarda (en el servidor o en el borrador del producto nuevo). Devuelve los
   * errores por campo si el servidor la rechazó, o `null` si se guardó.
   */
  onGuardar: (b: BorradorPresentacion) => Promise<ErroresPresentacion | null>;
  onCerrar: () => void;
}

const TITULOS: Record<ModoFormulario, string> = {
  crear: "Nueva presentación",
  editar: "Editar presentación",
  duplicar: "Duplicar presentación",
};

/** Lo que cuenta como "cambio sin guardar" (la foto elegida también). */
function huella(b: BorradorPresentacion): string {
  const { erroresServidor: _e, archivo, ...resto } = b;
  return JSON.stringify({ ...resto, archivo: archivo ? archivo.name + archivo.size : null });
}

/** min × precio, exacto (BigInt): "un pedido de 0,5 kg cuesta $1.000". */
function costoDe(cantidad: string, precio: string): string | null {
  const c = leerNumero(cantidad);
  const p = leerNumero(textoPrecio(precio));
  if (!c || !p) return null;
  const total = (BigInt(c.escalado) * BigInt(p.escalado)) / BigInt(1_000_000);
  return formatoPrecio(Number(total) / 1_000_000);
}

export function PresentacionFormModal({
  modo,
  inicial,
  productoNombre,
  unidadBase,
  unidades,
  hermanas,
  puedeCrearUnidad,
  onUnidadCreada,
  onGuardar,
  onCerrar,
}: Props) {
  const [b, setB] = useState<BorradorPresentacion>(inicial);
  const [errores, setErrores] = useState<ErroresPresentacion>(inicial.erroresServidor ?? {});
  const [intento, setIntento] = useState(Boolean(inicial.erroresServidor));
  const [guardando, setGuardando] = useState(false);
  const [paso, setPaso] = useState<Paso>(() => {
    // Si vuelve con errores del servidor, abre en el paso del primero.
    const primero = ORDEN_CAMPOS.find((c) => inicial.erroresServidor?.[c]);
    return primero ? pasoDe(primero) : "identificacion";
  });
  const enOrden = modo !== "editar";
  const huellaInicial = useRef(modo === "duplicar" ? "" : huella(inicial));
  const refs = useRef<Partial<Record<CampoPresentacion, HTMLElement | null>>>({});

  // Unidad nueva sin salir del formulario.
  const [creandoUnidad, setCreandoUnidad] = useState(false);
  const [unidadNueva, setUnidadNueva] = useState({ nombre: "", abreviatura: "" });
  const [errorUnidad, setErrorUnidad] = useState<string | null>(null);
  const [guardandoUnidad, setGuardandoUnidad] = useState(false);

  const unidad = useMemo(
    () => (b.unidad_venta === "" ? null : unidades.find((u) => u.id === b.unidad_venta) ?? null),
    [b.unidad_venta, unidades]
  );
  // Las unidades desactivadas no se ofrecen, salvo la que ya tenía.
  const unidadesVisibles = unidades.filter((u) => u.estado_unidad || u.id === inicial.unidad_venta);

  /** Errores en vivo una vez que se intentó guardar; antes, solo los del servidor. */
  const erroresVisibles: ErroresPresentacion = intento
    ? { ...validarBorrador(b, hermanas), ...errores }
    : {};

  function cambiar<K extends keyof BorradorPresentacion>(campo: K, valor: BorradorPresentacion[K]) {
    setB((prev) => ({ ...prev, [campo]: valor }));
    // El error del servidor de ese campo deja de valer en cuanto se corrige.
    setErrores((prev) => {
      if (!(campo in prev)) return prev;
      const { [campo as CampoPresentacion]: _quitado, ...resto } = prev;
      return resto;
    });
  }

  const regla = { minima: b.cantidad_minima, incremento: b.incremento_cantidad };
  const presetActivo =
    PRESETS_CANTIDAD.find(
      (p) =>
        formatearCantidad(regla.minima) === p.minima &&
        formatearCantidad(regla.incremento) === p.incremento &&
        b.decimales_cantidad === p.decimales
    )?.id ?? "personalizado";

  // Los errores "del momento" (aunque aún no se haya intentado guardar):
  // deciden si se puede pintar la vista previa y la ayuda del precio.
  const erroresRegla = validarBorrador(b, []);
  const reglaValida =
    !erroresRegla.cantidad_minima && !erroresRegla.incremento_cantidad && !erroresRegla.decimales_cantidad;
  const ejemplos = reglaValida ? ejemplosCantidad(b.cantidad_minima, b.incremento_cantidad, 6) : [];
  const abreviatura = unidad?.abreviatura_unidad ?? "";
  const precioValido = !erroresRegla.precio_unitario;
  const costoMinimo = precioValido && reglaValida ? costoDe(b.cantidad_minima, b.precio_unitario) : null;

  async function cerrar() {
    if (guardando) return;
    if (huella(b) !== huellaInicial.current && !(await confirmarDescartar())) return;
    onCerrar();
  }

  function enfocarPrimerError(e: ErroresPresentacion) {
    const campo = ORDEN_CAMPOS.find((c) => e[c]);
    if (!campo) return;
    setPaso(pasoDe(campo));
    // El campo existe en el siguiente pintado si estaba en otro paso.
    requestAnimationFrame(() => refs.current[campo]?.focus());
  }

  /** Los errores de los campos de un paso (para no avanzar sin corregirlos). */
  function erroresDePaso(p: Exclude<Paso, "revision">): ErroresPresentacion {
    const todos = validarBorrador(b, hermanas);
    return Object.fromEntries(CAMPOS_DE[p].filter((c) => todos[c]).map((c) => [c, todos[c]]));
  }

  function irA(destino: string) {
    const d = destino as Paso;
    if (enOrden) {
      const hasta = ORDEN.indexOf(d);
      for (const previo of ORDEN.slice(0, hasta) as Exclude<Paso, "revision">[]) {
        const e = erroresDePaso(previo);
        if (Object.keys(e).length > 0) {
          setIntento(true);
          enfocarPrimerError(e);
          return;
        }
      }
    }
    setPaso(d);
  }

  async function guardar(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (guardando) return; // doble clic / doble Enter
    setIntento(true);
    setErrores({});
    const locales = validarBorrador(b, hermanas);
    if (Object.keys(locales).length > 0) {
      enfocarPrimerError(locales);
      return;
    }
    setGuardando(true);
    try {
      const delServidor = await onGuardar(b);
      if (delServidor) {
        setErrores(delServidor);
        enfocarPrimerError(delServidor);
      }
    } finally {
      setGuardando(false);
    }
  }

  async function guardarUnidad() {
    const nombre = unidadNueva.nombre.trim();
    const abrev = unidadNueva.abreviatura.trim();
    if (!nombre || !abrev) {
      setErrorUnidad("Escribe el nombre y la abreviatura (ej: Caja · cj).");
      return;
    }
    setGuardandoUnidad(true);
    setErrorUnidad(null);
    try {
      const creada = await crearUnidad({ nombre_unidad: nombre, abreviatura_unidad: abrev });
      onUnidadCreada(creada);
      cambiar("unidad_venta", creada.id);
      setCreandoUnidad(false);
      setUnidadNueva({ nombre: "", abreviatura: "" });
      requestAnimationFrame(() => refs.current.unidad_venta?.focus());
    } catch (err) {
      setErrorUnidad(extraerMensajeError(err, "No se pudo crear la unidad. Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setGuardandoUnidad(false);
    }
  }

  /** Props de accesibilidad y estilo para un campo con posible error. */
  function campo(nombre: CampoPresentacion) {
    const error = erroresVisibles[nombre];
    return {
      id: `pf-${nombre}`,
      ref: (el: HTMLElement | null) => {
        refs.current[nombre] = el;
      },
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `pf-${nombre}-error` : `pf-${nombre}-ayuda`,
      className: error ? "campo-invalido" : undefined,
    };
  }

  function ErrorCampo({ de }: { de: CampoPresentacion }) {
    const mensaje = erroresVisibles[de];
    if (!mensaje) return null;
    return (
      <p className="campo-error" id={`pf-${de}-error`} role="alert">
        <AlertTriangle size={13} aria-hidden /> {mensaje}
      </p>
    );
  }

  const indice = ORDEN.indexOf(paso);
  const precioApi = precioValido ? aDecimalApi(textoPrecio(b.precio_unitario)) : null;
  const idValida = Object.keys(erroresDePaso("identificacion")).length === 0;
  const precioPasoValido = Object.keys(erroresDePaso("precio")).length === 0;
  const textoRegla = reglaValida
    ? `Desde ${formatearCantidad(b.cantidad_minima)} ${abreviatura}, de ${formatearCantidad(b.incremento_cantidad)} en ${formatearCantidad(b.incremento_cantidad)}`
    : "Por definir";

  const pasos: PasoModal[] = [
    {
      clave: "identificacion",
      titulo: "Identificación",
      detalle: b.nombre_presentacion.trim()
        ? `${b.nombre_presentacion.trim()}${unidad ? ` · ${unidad.abreviatura_unidad}` : ""}`
        : "Nombre, unidad y foto",
      hecho: enOrden && indice > 0,
    },
    {
      clave: "precio",
      titulo: "Precio y cantidades",
      detalle: precioApi ? `${formatoPrecio(precioApi)}${abreviatura ? ` / ${abreviatura}` : ""}` : "Precio y forma de pedir",
      bloqueado: enOrden && !idValida,
      hecho: enOrden && indice > 1,
    },
    {
      clave: "revision",
      titulo: "Revisión",
      detalle: b.estado_presentacion ? "Activa" : "Inactiva",
      bloqueado: enOrden && (!idValida || !precioPasoValido),
    },
  ];

  const tituloGuardar = guardando ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Guardar presentación";
  const pie = !enOrden ? (
    <>
      <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
        Cancelar
      </button>
      <button type="submit" form="form-presentacion" className="btn primario btn-con-icono" disabled={guardando} aria-busy={guardando}>
        <Save size={16} aria-hidden /> {tituloGuardar}
      </button>
    </>
  ) : (
    <>
      {indice === 0 ? (
        <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
          Cancelar
        </button>
      ) : (
        <button type="button" className="btn secundario btn-con-icono" onClick={() => irA(ORDEN[indice - 1])} disabled={guardando}>
          <ArrowLeft size={16} aria-hidden /> Atrás
        </button>
      )}
      {paso === "revision" ? (
        <button type="submit" form="form-presentacion" className="btn primario btn-con-icono" disabled={guardando} aria-busy={guardando}>
          <Save size={16} aria-hidden /> {tituloGuardar}
        </button>
      ) : (
        <button type="button" className="btn primario btn-con-icono" onClick={() => irA(ORDEN[indice + 1])}>
          {paso === "identificacion" ? "Continuar a precio y cantidades" : "Continuar a revisión"}
          <ArrowRight size={16} aria-hidden />
        </button>
      )}
    </>
  );

  return (
    <Modal
      amplio
      ancho
      expandible
      cerrarConEscape
      clase="modal-producto modal-presentacion"
      titulo={TITULOS[modo]}
      subtitulo={
        productoNombre
          ? `Define cómo se vende ${productoNombre}: unidad, precio y cantidades.`
          : "Define cómo se vende el producto: unidad, precio y cantidades."
      }
      subcabecera={
        <PasosModal
          etiqueta={enOrden ? "Pasos para crear la presentación" : "Secciones de la presentación"}
          pasos={pasos}
          activo={paso}
          onCambiar={irA}
          numerados={enOrden}
          variante={enOrden ? "progreso" : "pestanas"}
        />
      }
      onCerrar={cerrar}
      footer={pie}
    >
      <form
        id="form-presentacion"
        className="form-presentacion"
        onSubmit={(e) => {
          // En crear/duplicar, Enter en un paso intermedio avanza en vez de guardar.
          if (enOrden && paso !== "revision") {
            e.preventDefault();
            irA(ORDEN[indice + 1]);
            return;
          }
          guardar(e);
        }}
        noValidate
      >
        {erroresVisibles.general && (
          <div className="error-box" role="alert">
            <AlertTriangle size={15} aria-hidden /> {erroresVisibles.general}
          </div>
        )}

        {/* --------------------------------------------- 1 · Identificación
            A la izquierda, la tarjeta de la presentación: su foto (opcional;
            sin ella se usa la del producto) con nombre, unidad, precio y
            estado debajo. A la derecha, el formulario. */}
        {paso === "identificacion" && (
          <div className="producto-paso prd-info" role="tabpanel">
            <aside className="prd-tarjeta" aria-label="Vista previa de la presentación">
              <MediaField
                variante="zona"
                valor={b.archivo ?? null}
                urlActual={b.imagen_url ?? null}
                quitada={Boolean(b.quitarImagen)}
                onCambiar={(archivo) => setB((prev) => ({ ...prev, archivo, quitarImagen: false }))}
                onQuitarActual={(quitar) => setB((prev) => ({ ...prev, archivo: null, quitarImagen: quitar }))}
                accept="image/png,image/jpeg,image/webp"
                ayuda="Opcional: sin foto, la tienda muestra la del producto."
                pie={<TarjetaPie b={b} unidad={unidad?.nombre_unidad ?? ""} precio={precioApi} abreviatura={abreviatura} />}
              />
            </aside>

            <div className="prd-campos">
              <section className="prd-grupo" aria-labelledby="pre-grupo-id">
                <h3 id="pre-grupo-id" className="prd-grupo-titulo">Identificación comercial</h3>

                <div className="campo prd-campo">
                  <label htmlFor="pf-nombre_presentacion">
                    Nombre de la presentación <span className="prd-req">Obligatorio</span>
                  </label>
                  <input
                    {...campo("nombre_presentacion")}
                    autoFocus
                    maxLength={200}
                    placeholder="Ej: Kilo, Caja x 12, Frasco 100 ml"
                    value={b.nombre_presentacion}
                    onChange={(e) => cambiar("nombre_presentacion", e.target.value)}
                  />
                  <ErrorCampo de="nombre_presentacion" />
                  {!erroresVisibles.nombre_presentacion && (
                    <p className="campo-ayuda" id="pf-nombre_presentacion-ayuda">
                      Es lo que el cliente elige en la tienda.
                    </p>
                  )}
                </div>

                <div className="prd-dos">
                  <div className="campo prd-campo">
                    <label htmlFor="pf-unidad_venta">
                      Unidad comercial <span className="prd-req">Obligatorio</span>
                    </label>
                    {!creandoUnidad ? (
                      <Combobox
                        id="pf-unidad_venta"
                        ref={(h) => {
                          refs.current.unidad_venta = h as unknown as HTMLElement | null;
                        }}
                        valor={b.unidad_venta}
                        opciones={unidadesVisibles.map((u) => ({ valor: u.id, etiqueta: u.nombre_unidad, detalle: u.abreviatura_unidad }))}
                        onCambiar={(v) => cambiar("unidad_venta", v)}
                        placeholder="Elige una unidad"
                        invalido={Boolean(erroresVisibles.unidad_venta)}
                        describedBy={erroresVisibles.unidad_venta ? "pf-unidad_venta-error" : undefined}
                        accion={puedeCrearUnidad ? { etiqueta: "+ Crear unidad nueva…", onElegir: () => setCreandoUnidad(true) } : undefined}
                      />
                    ) : (
                      <div className="pf-unidad-nueva" role="group" aria-label="Crear unidad nueva">
                        <input
                          autoFocus
                          aria-label="Nombre de la unidad"
                          placeholder="Nombre (ej: Caja)"
                          maxLength={100}
                          value={unidadNueva.nombre}
                          onChange={(e) => setUnidadNueva((u) => ({ ...u, nombre: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), guardarUnidad())}
                        />
                        <input
                          aria-label="Abreviatura de la unidad"
                          placeholder="Abrev. (cj)"
                          maxLength={10}
                          value={unidadNueva.abreviatura}
                          onChange={(e) => setUnidadNueva((u) => ({ ...u, abreviatura: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), guardarUnidad())}
                        />
                        <div className="pf-unidad-nueva-acciones">
                          <button type="button" className="btn primario sm" onClick={guardarUnidad} disabled={guardandoUnidad}>
                            {guardandoUnidad ? "Creando…" : "Crear"}
                          </button>
                          <button
                            type="button"
                            className="btn secundario sm"
                            onClick={() => {
                              setCreandoUnidad(false);
                              setErrorUnidad(null);
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                        {errorUnidad && (
                          <p className="campo-error" role="alert">
                            <AlertTriangle size={13} aria-hidden /> {errorUnidad}
                          </p>
                        )}
                      </div>
                    )}
                    <ErrorCampo de="unidad_venta" />
                  </div>

                  <div className="campo prd-campo">
                    <span className="prd-etiqueta" id="pf-estado-etiqueta">
                      Estado
                    </span>
                    <label className="prd-interruptor">
                      <span className="switch">
                        <input
                          type="checkbox"
                          aria-labelledby="pf-estado-etiqueta pf-estado-texto"
                          checked={b.estado_presentacion}
                          onChange={(e) => cambiar("estado_presentacion", e.target.checked)}
                        />
                        <span className="switch-riel" />
                      </span>
                      <span id="pf-estado-texto">
                        <strong>{b.estado_presentacion ? "Activa" : "Inactiva"}</strong>
                        <small>{b.estado_presentacion ? "Se puede pedir en la tienda" : "Oculta en la tienda"}</small>
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="prd-grupo" aria-labelledby="pre-grupo-eq">
                <h3 id="pre-grupo-eq" className="prd-grupo-titulo">Equivalencia para inventario</h3>
                <div className="campo prd-campo">
                  <label htmlFor="pf-factor_conversion">
                    Equivale a {unidadBase ? unidadBase.nombre_unidad.toLowerCase() : "unidades base"}{" "}
                    <span className="prd-opc">Opcional</span>
                  </label>
                  <div className="prd-con-icono">
                    <Ruler size={15} aria-hidden />
                    <input
                      {...campo("factor_conversion")}
                      inputMode="decimal"
                      autoComplete="off"
                      value={b.factor_conversion}
                      onChange={(e) => cambiar("factor_conversion", e.target.value)}
                    />
                  </div>
                  <ErrorCampo de="factor_conversion" />
                </div>
                <p className="prd-nota" id="pf-factor_conversion-ayuda">
                  <Info size={14} aria-hidden />
                  <span>
                    <strong>
                      1 {b.nombre_presentacion.trim() || "presentación"} = {formatearCantidad(b.factor_conversion || "1")}{" "}
                      {unidadBase?.abreviatura_unidad ?? "unidad base"}
                    </strong>
                    . Solo se usa para descontar inventario; no cambia el precio.
                  </span>
                </p>
              </section>
            </div>
          </div>
        )}

        {/* ------------------------------------------ 2 · Precio y cantidades */}
        {paso === "precio" && (
          <div className="producto-paso prd-campos prd-paso-ancho" role="tabpanel">
            <section className="prd-grupo" aria-labelledby="pre-grupo-precio">
              <h3 id="pre-grupo-precio" className="prd-grupo-titulo">
                <Calculator size={14} aria-hidden /> Precio de venta
              </h3>
              <div className="prd-dos prd-dos-precio">
                <div className="campo prd-campo">
                  <label htmlFor="pf-precio_unitario">
                    Precio {unidad ? `por 1 ${unidad.nombre_unidad.toLowerCase()}` : ""} <span className="prd-req">Obligatorio</span>
                  </label>
                  <div className={`input-precio prd-precio ${erroresVisibles.precio_unitario ? "campo-invalido" : ""}`}>
                    <span aria-hidden>$</span>
                    <input
                      {...campo("precio_unitario")}
                      className={undefined}
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      placeholder="0"
                      value={b.precio_unitario}
                      onChange={(e) => cambiar("precio_unitario", e.target.value)}
                    />
                    <span className="pf-moneda" aria-hidden>
                      COP
                    </span>
                  </div>
                  <ErrorCampo de="precio_unitario" />
                </div>
                <div className="prd-nota prd-nota-precio" id="pf-precio_unitario-ayuda" aria-live="polite">
                  <Info size={14} aria-hidden />
                  {precioValido && unidad ? (
                    <span>
                      <strong>
                        {formatoPrecio(precioApi ?? "0")} por {unidad.nombre_unidad.toLowerCase()}
                      </strong>
                      {costoMinimo && b.cantidad_minima !== "1" && (
                        <>
                          . El pedido mínimo ({formatearCantidad(b.cantidad_minima)} {abreviatura}) cuesta {costoMinimo}
                        </>
                      )}
                      . Cada presentación tiene su propio precio; no se calcula a partir de otras.
                    </span>
                  ) : (
                    <span>Escribe el precio: aquí verás a qué corresponde.</span>
                  )}
                </div>
              </div>
            </section>

            <section className="prd-grupo" aria-labelledby="pre-grupo-cant">
              <h3 id="pre-grupo-cant" className="prd-grupo-titulo">
                <Scale size={14} aria-hidden /> Reglas de cantidad
              </h3>
              <div className="pf-presets" role="radiogroup" aria-label="Forma de pedir">
                {PRESETS_CANTIDAD.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={presetActivo === p.id}
                    className={`pf-preset ${presetActivo === p.id ? "activo" : ""}`}
                    onClick={() => {
                      setB((prev) => ({
                        ...prev,
                        cantidad_minima: p.minima,
                        incremento_cantidad: p.incremento,
                        decimales_cantidad: p.decimales,
                      }));
                      setErrores({});
                    }}
                  >
                    {presetActivo === p.id && <Check size={13} aria-hidden />}
                    <span className="pf-preset-titulo">{p.titulo}</span>
                    <span className="pf-preset-ejemplo">{p.ejemplo}</span>
                  </button>
                ))}
                <span className={`pf-preset pf-preset-info ${presetActivo === "personalizado" ? "activo" : ""}`} aria-hidden>
                  {presetActivo === "personalizado" && <Check size={13} />}
                  <span className="pf-preset-titulo">Personalizada</span>
                  <span className="pf-preset-ejemplo">Ajusta los campos</span>
                </span>
              </div>

              <div className="prd-tres">
                <div className="campo prd-campo">
                  <label htmlFor="pf-cantidad_minima">
                    Cantidad mínima <span className="prd-req">Obligatorio</span>
                  </label>
                  <input
                    {...campo("cantidad_minima")}
                    inputMode="decimal"
                    autoComplete="off"
                    value={b.cantidad_minima}
                    onChange={(e) => cambiar("cantidad_minima", e.target.value)}
                  />
                  <ErrorCampo de="cantidad_minima" />
                </div>
                <div className="campo prd-campo">
                  <label htmlFor="pf-incremento_cantidad">
                    Incremento <span className="prd-req">Obligatorio</span>
                  </label>
                  <input
                    {...campo("incremento_cantidad")}
                    inputMode="decimal"
                    autoComplete="off"
                    value={b.incremento_cantidad}
                    onChange={(e) => cambiar("incremento_cantidad", e.target.value)}
                  />
                  <ErrorCampo de="incremento_cantidad" />
                </div>
                <div className="campo prd-campo">
                  <label htmlFor="pf-decimales_cantidad">Decimales admitidos</label>
                  <Combobox
                    id="pf-decimales_cantidad"
                    ref={(h) => {
                      refs.current.decimales_cantidad = h as unknown as HTMLElement | null;
                    }}
                    valor={b.decimales_cantidad}
                    opciones={Array.from({ length: MAX_DECIMALES + 1 }, (_, n) => ({
                      valor: n,
                      etiqueta: n === 0 ? "Sin decimales" : n === 1 ? "1 decimal" : "2 decimales",
                      detalle: n === 0 ? "1, 2, 3" : n === 1 ? "0,5" : "0,25",
                    }))}
                    onCambiar={(v) => cambiar("decimales_cantidad", v === "" ? 0 : v)}
                    invalido={Boolean(erroresVisibles.decimales_cantidad)}
                    describedBy={erroresVisibles.decimales_cantidad ? "pf-decimales_cantidad-error" : undefined}
                  />
                  <ErrorCampo de="decimales_cantidad" />
                </div>
              </div>

              <div className={`pf-vista-previa ${reglaValida ? "" : "invalida"}`} aria-live="polite">
                <span className="pf-etiqueta">Cantidades válidas</span>
                {reglaValida ? (
                  <>
                    <div className="pf-secuencia">
                      {ejemplos.map((x) => (
                        <span key={x} className="pf-cantidad">
                          {x}
                          {abreviatura && <small> {abreviatura}</small>}
                        </span>
                      ))}
                      <span className="pf-cantidad pf-cantidad-mas" aria-hidden>
                        …
                      </span>
                    </div>
                    <p>
                      Desde {formatearCantidad(b.cantidad_minima)} {abreviatura} y luego sumando{" "}
                      {formatearCantidad(b.incremento_cantidad)} {abreviatura} cada vez. El cliente no podrá pedir cantidades
                      intermedias.
                    </p>
                  </>
                ) : (
                  <p>Corrige la cantidad mínima y el incremento para ver la secuencia.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* -------------------------------------------------- 3 · Revisión */}
        {paso === "revision" && (
          <div className="producto-paso prd-info" role="tabpanel">
            <aside className="prd-tarjeta" aria-label="Así se verá la presentación">
              <div className="media-zona-tarjeta">
                <div className={`media-zona ${b.archivo || (b.imagen_url && !b.quitarImagen) ? "con-imagen" : ""}`}>
                  <VistaFoto b={b} />
                </div>
                <TarjetaPie b={b} unidad={unidad?.nombre_unidad ?? ""} precio={precioApi} abreviatura={abreviatura} />
              </div>
            </aside>
            <div className="producto-resumen prd-resumen-pres">
              <p className="producto-resumen-titulo">Así quedará la presentación</p>
              <dl>
                <div>
                  <dt>Nombre</dt>
                  <dd>{b.nombre_presentacion.trim()}</dd>
                </div>
                <div>
                  <dt>Unidad comercial</dt>
                  <dd>{unidad ? `${unidad.nombre_unidad} (${unidad.abreviatura_unidad})` : "—"}</dd>
                </div>
                <div>
                  <dt>Precio</dt>
                  <dd>{precioApi ? `${formatoPrecio(precioApi)} / ${abreviatura || "u"}` : "—"}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{b.estado_presentacion ? "Activa" : "Inactiva"}</dd>
                </div>
                <div className="producto-resumen-ancho">
                  <dt>Cantidades</dt>
                  <dd>{textoRegla}</dd>
                </div>
                <div className="producto-resumen-ancho">
                  <dt>Equivalencia</dt>
                  <dd>
                    1 {b.nombre_presentacion.trim() || "presentación"} = {formatearCantidad(b.factor_conversion || "1")}{" "}
                    {unidadBase?.abreviatura_unidad ?? "unidad base"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

/** Debajo de la foto: nombre, unidad, precio y estado (se actualiza al escribir). */
function TarjetaPie({
  b,
  unidad,
  precio,
  abreviatura,
}: {
  b: BorradorPresentacion;
  unidad: string;
  precio: string | null;
  abreviatura: string;
}) {
  return (
    <div className="prd-tarjeta-pie">
      <p className={`prd-tarjeta-nombre ${b.nombre_presentacion.trim() ? "" : "vacio"}`}>
        {b.nombre_presentacion.trim() || "Nombre de la presentación"}
      </p>
      <p className="prd-tarjeta-precio">
        {precio ? formatoPrecio(precio) : "$ —"}
        {abreviatura && <small> / {abreviatura}</small>}
      </p>
      <div className="prd-tarjeta-meta">
        <span className={`prd-chip ${unidad ? "" : "vacio"}`}>{unidad || "Sin unidad"}</span>
        <span className={`prd-estado ${b.estado_presentacion ? "visible" : ""}`}>
          <span aria-hidden className="prd-estado-punto" />
          {b.estado_presentacion ? "Activa" : "Inactiva"}
        </span>
      </div>
    </div>
  );
}

/** La foto en la revisión (sin acciones): la nueva, la actual o el ícono. */
function VistaFoto({ b }: { b: BorradorPresentacion }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!b.archivo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(b.archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [b.archivo]);
  const src = url ?? (b.quitarImagen ? null : b.imagen_url ?? null);
  return src ? (
    <img src={src} alt="" />
  ) : (
    <div className="media-zona-vacia">
      <span className="media-zona-icono" aria-hidden>
        <Info size={20} />
      </span>
      <p className="media-zona-sub">Sin foto propia: se usa la del producto.</p>
    </div>
  );
}
