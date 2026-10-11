import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Calculator, Check, ImageIcon, Scale, Tag } from "lucide-react";
import { Modal } from "../../components/Modal";
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
import { FotoPresentacion } from "./FotoPresentacion";
import {
  ORDEN_CAMPOS,
  textoPrecio,
  validarBorrador,
  type BorradorPresentacion,
  type CampoPresentacion,
  type ErroresPresentacion,
} from "./presentaciones";

export type ModoFormulario = "crear" | "editar" | "duplicar";

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
    if (campo) refs.current[campo]?.focus();
  }

  async function guardar(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (guardando) return; // doble clic / doble Enter
    setIntento(true);
    setErrores({});
    const locales = validarBorrador(b, hermanas);
    if (Object.keys(locales).length > 0) {
      // Tras el render, para que el campo ya tenga su mensaje de error.
      requestAnimationFrame(() => enfocarPrimerError(locales));
      return;
    }
    setGuardando(true);
    try {
      const delServidor = await onGuardar(b);
      if (delServidor) {
        setErrores(delServidor);
        requestAnimationFrame(() => enfocarPrimerError(delServidor));
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

  return (
    <Modal
      amplio
      cerrarConEscape
      titulo={TITULOS[modo]}
      subtitulo={productoNombre ? `Producto: ${productoNombre}` : "Producto nuevo"}
      onCerrar={cerrar}
      footer={
        <>
          <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-presentacion"
            className="btn primario"
            disabled={guardando}
            aria-busy={guardando}
          >
            {guardando ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Guardar presentación"}
          </button>
        </>
      }
    >
      <form id="form-presentacion" className="form-presentacion" onSubmit={guardar} noValidate>
        {erroresVisibles.general && (
          <div className="error-box" role="alert">
            <AlertTriangle size={15} aria-hidden /> {erroresVisibles.general}
          </div>
        )}

        {/* ---------- A. Identificación comercial ---------- */}
        <section className="pf-seccion" aria-labelledby="pf-a">
          <h3 id="pf-a" className="pf-seccion-titulo">
            <Tag size={15} aria-hidden /> Identificación comercial
          </h3>
          <div className="pf-grid">
            <div className="campo pf-col-2">
              <label htmlFor="pf-nombre_presentacion">Nombre de la presentación *</label>
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

            <div className="campo">
              <label htmlFor="pf-unidad_venta">Unidad comercial *</label>
              {!creandoUnidad ? (
                <select
                  {...campo("unidad_venta")}
                  value={b.unidad_venta}
                  onChange={(e) => {
                    if (e.target.value === "__nueva") {
                      setCreandoUnidad(true);
                      return;
                    }
                    cambiar("unidad_venta", e.target.value === "" ? "" : Number(e.target.value));
                  }}
                >
                  <option value="">Elegir unidad…</option>
                  {unidadesVisibles.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_unidad} ({u.abreviatura_unidad})
                    </option>
                  ))}
                  {puedeCrearUnidad && <option value="__nueva">+ Crear unidad nueva…</option>}
                </select>
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

            <div className="campo">
              <span className="pf-etiqueta" id="pf-estado-etiqueta">Estado</span>
              <label className="pf-estado">
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
                  {b.estado_presentacion ? "Activa · se puede pedir" : "Inactiva · oculta en la tienda"}
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* ---------- B. Precio de venta ---------- */}
        <section className="pf-seccion" aria-labelledby="pf-b">
          <h3 id="pf-b" className="pf-seccion-titulo">
            <Calculator size={15} aria-hidden /> Precio de venta
          </h3>
          <div className="pf-grid">
            <div className="campo">
              <label htmlFor="pf-precio_unitario">
                Precio {unidad ? `por 1 ${unidad.nombre_unidad.toLowerCase()}` : ""} *
              </label>
              <div className={`input-precio ${erroresVisibles.precio_unitario ? "campo-invalido" : ""}`}>
                <span aria-hidden>$</span>
                <input
                  {...campo("precio_unitario")}
                  className={undefined}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={b.precio_unitario}
                  onChange={(e) => cambiar("precio_unitario", e.target.value)}
                />
                <span className="pf-moneda" aria-hidden>COP</span>
              </div>
              <ErrorCampo de="precio_unitario" />
            </div>
            <div className="pf-ayuda-contextual" id="pf-precio_unitario-ayuda" aria-live="polite">
              {precioValido && unidad ? (
                <>
                  <strong>
                    {formatoPrecio(aDecimalApi(textoPrecio(b.precio_unitario)) ?? "0")} por {unidad.nombre_unidad.toLowerCase()}
                  </strong>
                  {costoMinimo && b.cantidad_minima !== "1" && (
                    <span>
                      El pedido mínimo ({formatearCantidad(b.cantidad_minima)} {abreviatura}) cuesta {costoMinimo}.
                    </span>
                  )}
                  <span>Cada presentación tiene su propio precio; no se calcula a partir de otras.</span>
                </>
              ) : (
                <span>Elige la unidad y escribe el precio: aquí verás a qué corresponde.</span>
              )}
            </div>
          </div>
        </section>

        {/* ---------- C. Reglas de cantidad ---------- */}
        <section className="pf-seccion" aria-labelledby="pf-c">
          <h3 id="pf-c" className="pf-seccion-titulo">
            <Scale size={15} aria-hidden /> Reglas de cantidad
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

          <div className="pf-grid pf-grid-3">
            <div className="campo">
              <label htmlFor="pf-cantidad_minima">Cantidad mínima *</label>
              <input
                {...campo("cantidad_minima")}
                inputMode="decimal"
                autoComplete="off"
                value={b.cantidad_minima}
                onChange={(e) => cambiar("cantidad_minima", e.target.value)}
              />
              <ErrorCampo de="cantidad_minima" />
            </div>
            <div className="campo">
              <label htmlFor="pf-incremento_cantidad">Incremento *</label>
              <input
                {...campo("incremento_cantidad")}
                inputMode="decimal"
                autoComplete="off"
                value={b.incremento_cantidad}
                onChange={(e) => cambiar("incremento_cantidad", e.target.value)}
              />
              <ErrorCampo de="incremento_cantidad" />
            </div>
            <div className="campo">
              <label htmlFor="pf-decimales_cantidad">Decimales admitidos</label>
              <select
                {...campo("decimales_cantidad")}
                value={b.decimales_cantidad}
                onChange={(e) => cambiar("decimales_cantidad", Number(e.target.value))}
              >
                {Array.from({ length: MAX_DECIMALES + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Sin decimales (1, 2, 3)" : n === 1 ? "1 decimal (0,5)" : "2 decimales (0,25)"}
                  </option>
                ))}
              </select>
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
                  <span className="pf-cantidad pf-cantidad-mas" aria-hidden>…</span>
                </div>
                <p>
                  Desde {formatearCantidad(b.cantidad_minima)} {abreviatura} y luego sumando{" "}
                  {formatearCantidad(b.incremento_cantidad)} {abreviatura} cada vez. El cliente no podrá pedir
                  cantidades intermedias.
                </p>
              </>
            ) : (
              <p>Corrige la cantidad mínima y el incremento para ver la secuencia.</p>
            )}
          </div>
        </section>

        {/* ---------- D. Equivalencia e imagen ---------- */}
        <section className="pf-seccion" aria-labelledby="pf-d">
          <h3 id="pf-d" className="pf-seccion-titulo">
            <ImageIcon size={15} aria-hidden /> Equivalencia e imagen <span className="pf-opcional">Opcional</span>
          </h3>
          <div className="pf-grid">
            <div className="campo">
              <label htmlFor="pf-factor_conversion">
                Equivale a {unidadBase ? `(${unidadBase.nombre_unidad.toLowerCase()})` : "(unidades base)"}
              </label>
              <input
                {...campo("factor_conversion")}
                inputMode="decimal"
                autoComplete="off"
                value={b.factor_conversion}
                onChange={(e) => cambiar("factor_conversion", e.target.value)}
              />
              <ErrorCampo de="factor_conversion" />
              {!erroresVisibles.factor_conversion && (
                <p className="campo-ayuda" id="pf-factor_conversion-ayuda">
                  1 {b.nombre_presentacion.trim() || "presentación"} = {formatearCantidad(b.factor_conversion || "1")}{" "}
                  {unidadBase?.abreviatura_unidad ?? "unidad base"}. Solo para inventario; no cambia el precio.
                </p>
              )}
            </div>
            <FotoPresentacion
              urlActual={b.imagen_url ?? null}
              archivo={b.archivo ?? null}
              quitar={Boolean(b.quitarImagen)}
              nombre={b.nombre_presentacion}
              onCambiar={({ archivo, quitar }) => setB((prev) => ({ ...prev, archivo, quitarImagen: quitar }))}
            />
          </div>
        </section>

      </form>
    </Modal>
  );
}
