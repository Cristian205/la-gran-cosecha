import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Barcode, Check, Eye, EyeOff, Info, Package, PackagePlus, Ruler } from "lucide-react";
import { Combobox, type ComboboxHandle } from "../../components/Combobox";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import { PasosModal, type PasoModal } from "../../components/PasosModal";
import {
  actualizarProductoParcial,
  crearProducto,
  obtenerPresentaciones,
  quitarImagenPresentacion,
  subirImagenPresentacion,
  subirImagenProducto,
  type ProductoPayload,
} from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";
import { alertaError, alertaExito, confirmarDescartar } from "../../utils/alertas";
import { leerNumero } from "../../utils/cantidades";
import type { Categoria, Producto, UnidadMedida } from "../../types";
import { extraerMensajeError, tienePermiso } from "../../utils";
import { PresentacionesComerciales } from "./PresentacionesComerciales";
import "./producto-modal.css";
import {
  aAnidada,
  borradorDesde,
  erroresDesdeServidor,
  type BorradorPresentacion,
} from "./presentaciones";

interface Props {
  producto: Producto | null;
  categorias: Categoria[];
  unidades: UnidadMedida[];
  onCerrar: () => void;
  onGuardado: () => void;
  /** Se guardó una presentación (producto existente): el catálogo se refresca. */
  onPresentacionesCambiadas?: () => void;
  onUnidadCreada?: (u: UnidadMedida) => void;
}

type CampoProducto = "nombre" | "categoria";
/** Crear va en tres pasos; editar usa las mismas secciones como pestañas libres. */
type Paso = "info" | "presentaciones" | "publicacion";
const ORDEN: Paso[] = ["info", "presentaciones", "publicacion"];

/**
 * Los campos `tipo_cantidad`/`permite_fraccion` del producto son de antes de
 * que cada presentación tuviera su regla. Se siguen rellenando al CREAR, con
 * la regla de la primera presentación activa, para que quien todavía los lea
 * (clientes viejos de la tienda en caché) vea algo coherente.
 */
function reglaLegada(presentaciones: BorradorPresentacion[]) {
  const primera = presentaciones.find((p) => p.estado_presentacion) ?? presentaciones[0];
  const paso = leerNumero(primera?.incremento_cantidad ?? "1");
  const tipo = paso?.escalado === 500_000 ? "medio" : paso?.escalado === 250_000 ? "cuarto" : "entero";
  return { tipo_cantidad: tipo, permite_fraccion: tipo !== "entero" };
}

export function ProductFormModal({
  producto,
  categorias,
  unidades,
  onCerrar,
  onGuardado,
  onPresentacionesCambiadas,
  onUnidadCreada,
}: Props) {
  const esEdicion = producto !== null;
  const { usuario } = useAuth();
  const puedeEditarPresentaciones = !esEdicion || tienePermiso(usuario, "catalog.change_producto");

  const [nombre, setNombre] = useState(producto?.nombre_producto ?? "");
  const [categoria, setCategoria] = useState<number | "">(producto?.categoria ?? "");
  const [unidadBase, setUnidadBase] = useState<number | "">(producto?.unidad_base ?? "");
  const [estado, setEstado] = useState(producto?.estado_producto ?? true);
  const [controlaStock, setControlaStock] = useState(producto?.controla_stock ?? false);
  const [codigoBarras, setCodigoBarras] = useState(producto?.codigo_barras ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [imagen, setImagen] = useState<File | null>(null);

  const [unidadesLocales, setUnidadesLocales] = useState(unidades);
  const [presentaciones, setPresentaciones] = useState<BorradorPresentacion[]>([]);
  const [cargandoPres, setCargandoPres] = useState(esEdicion);
  const [errorCargaPres, setErrorCargaPres] = useState<string | null>(null);

  const [paso, setPaso] = useState<Paso>("info");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Partial<Record<CampoProducto, string>>>({});
  const [errorPresentaciones, setErrorPresentaciones] = useState<string | null>(null);
  const refNombre = useRef<HTMLInputElement>(null);
  const refCategoria = useRef<ComboboxHandle>(null);
  const refSeccion = useRef<HTMLDivElement>(null);

  // Las de un producto existente se leen enteras (también las inactivas,
  // para poder reactivarlas): el catálogo solo trae las activas.
  function cargarPresentaciones() {
    if (!producto) return;
    setCargandoPres(true);
    setErrorCargaPres(null);
    obtenerPresentaciones(producto.id)
      .then((lista) => setPresentaciones(lista.map(borradorDesde)))
      .catch((err) =>
        setErrorCargaPres(extraerMensajeError(err, "No se pudieron cargar las presentaciones de este producto."))
      )
      .finally(() => setCargandoPres(false));
  }
  useEffect(cargarPresentaciones, [producto?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const datosProducto = useMemo(
    () => JSON.stringify([nombre.trim(), categoria, unidadBase, estado, controlaStock, codigoBarras.trim(), descripcion.trim(), imagen?.name]),
    [nombre, categoria, unidadBase, estado, controlaStock, codigoBarras, descripcion, imagen]
  );
  const datosIniciales = useRef(datosProducto);
  // Con producto existente las presentaciones se guardan al momento; con uno
  // nuevo, viven en este formulario y cuentan como cambios sin guardar.
  const hayCambios = datosProducto !== datosIniciales.current || (!esEdicion && presentaciones.length > 0);

  async function cerrar() {
    if (guardando) return;
    if (hayCambios && !(await confirmarDescartar())) return;
    onCerrar();
  }

  function unidadCreada(u: UnidadMedida) {
    setUnidadesLocales((prev) => [...prev, u].sort((a, b) => a.nombre_unidad.localeCompare(b.nombre_unidad, "es")));
    onUnidadCreada?.(u);
  }

  const infoValida = Boolean(nombre.trim()) && categoria !== "";
  const hayPresentacionActiva = presentaciones.some((p) => p.estado_presentacion);

  /** Revisa el paso de información; si falla, vuelve a él y enfoca el campo. */
  function validarInfo(): boolean {
    const nuevos: Partial<Record<CampoProducto, string>> = {};
    if (!nombre.trim()) nuevos.nombre = "Escribe el nombre del producto.";
    if (categoria === "") nuevos.categoria = "Elige una categoría.";
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.categoria) {
      setPaso("info");
      // El campo existe en el siguiente pintado si se venía de otro paso.
      requestAnimationFrame(() => (nuevos.nombre ? refNombre : refCategoria).current?.focus());
      return false;
    }
    return true;
  }

  /** Al crear hace falta una presentación activa: es la que da precio. */
  function validarPresentaciones(): boolean {
    if (esEdicion || hayPresentacionActiva) {
      setErrorPresentaciones(null);
      return true;
    }
    setErrorPresentaciones("Agrega al menos una presentación activa: es la que da precio al producto.");
    setPaso("presentaciones");
    requestAnimationFrame(() => refSeccion.current?.querySelector<HTMLButtonElement>(".pc-agregar")?.focus());
    return false;
  }

  function irA(destino: string) {
    const d = destino as Paso;
    if (!esEdicion) {
      const i = ORDEN.indexOf(d);
      if (i >= 1 && !validarInfo()) return;
      if (i >= 2 && !validarPresentaciones()) return;
    }
    setError(null);
    setPaso(d);
  }

  async function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    if (guardando) return;
    setError(null);
    setErrorPresentaciones(null);
    if (!validarInfo() || !validarPresentaciones()) return;

    const base = {
      nombre_producto: nombre.trim(),
      categoria: Number(categoria),
      unidad_base: unidadBase === "" ? null : Number(unidadBase),
      estado_producto: estado,
      controla_stock: controlaStock,
      codigo_barras: codigoBarras.trim(),
      descripcion: descripcion.trim(),
    };

    setGuardando(true);
    try {
      let prod: Producto;
      if (esEdicion) {
        // Solo los datos del producto: las presentaciones ya se guardaron una
        // a una y reenviarlas podría pisar el cambio de otra persona.
        prod = await actualizarProductoParcial(producto!.id, base);
      } else {
        const payload: ProductoPayload = {
          ...base,
          ...reglaLegada(presentaciones),
          presentaciones: presentaciones.map(aAnidada),
        };
        try {
          prod = await crearProducto(payload);
        } catch (err) {
          const lista = (err as { response?: { data?: { presentaciones?: unknown[] } } })?.response?.data
            ?.presentaciones;
          if (Array.isArray(lista)) {
            // El servidor rechazó presentaciones concretas: se marcan en la
            // lista y el editor de cada una abre con sus errores.
            setPresentaciones((prev) =>
              prev.map((p, i) => ({ ...p, erroresServidor: erroresDesdeServidor(lista[i]) }))
            );
            setErrorPresentaciones("Hay presentaciones con datos inválidos. Ábrelas para corregirlas.");
            setPaso("presentaciones");
            return;
          }
          throw err;
        }
      }

      if (imagen) await subirImagenProducto(prod.id, imagen);

      // Fotos de presentaciones nuevas: no tienen id hasta que el producto se
      // guarda. Se reconocen por nombre y unidad, únicos dentro del producto.
      const conFoto = esEdicion ? [] : presentaciones.filter((p) => p.archivo || p.quitarImagen);
      if (conFoto.length > 0) {
        const fallidas: string[] = [];
        const creadas = await obtenerPresentaciones(prod.id).catch(() => []);
        const clave = (n: string, u: number | "") => `${n.split(/\s+/).filter(Boolean).join(" ").toLowerCase()}|${u}`;
        for (const fila of conFoto) {
          const id = creadas.find(
            (g) => clave(g.nombre_presentacion, g.unidad_venta) === clave(fila.nombre_presentacion, fila.unidad_venta)
          )?.id;
          try {
            if (!id) throw new Error("sin id");
            if (fila.archivo) await subirImagenPresentacion(id, fila.archivo);
            else await quitarImagenPresentacion(id);
          } catch {
            fallidas.push(fila.nombre_presentacion);
          }
        }
        if (fallidas.length > 0) {
          // El producto YA se guardó: se avisa y se cierra; reintentar este
          // formulario crearía de nuevo el producto.
          await alertaError(
            `El producto se guardó, pero no se pudo subir la foto de: ${fallidas.join(", ")}. Puedes intentarlo de nuevo editando la presentación.`
          );
        }
      }
      alertaExito(esEdicion ? "Producto actualizado" : "Producto creado");
      onGuardado();
    } catch (err) {
      const respuesta = (err as { response?: { data?: Record<string, unknown> } })?.response;
      if (!respuesta) {
        setError("No se pudo conectar con el servidor. Revisa tu conexión: tus cambios siguen aquí, vuelve a intentarlo.");
      } else {
        const datos = respuesta.data ?? {};
        const porCampo: Partial<Record<CampoProducto, string>> = {};
        if (Array.isArray(datos.nombre_producto)) porCampo.nombre = String(datos.nombre_producto[0]);
        if (Array.isArray(datos.categoria)) porCampo.categoria = String(datos.categoria[0]);
        setErrores(porCampo);
        if (porCampo.nombre || porCampo.categoria) {
          setPaso("info");
          requestAnimationFrame(() => (porCampo.nombre ? refNombre : refCategoria).current?.focus());
        } else setError(extraerMensajeError(err, "No se pudo guardar el producto."));
      }
    } finally {
      setGuardando(false);
    }
  }

  const unidadBaseObj = unidadBase === "" ? null : unidadesLocales.find((u) => u.id === unidadBase) ?? null;
  const categoriaNombre = categorias.find((c) => c.id === categoria)?.nombre_categoria ?? "";
  const activas = presentaciones.filter((p) => p.estado_presentacion).length;
  const indice = ORDEN.indexOf(paso);

  const pasos: PasoModal[] = [
    {
      clave: "info",
      titulo: "Información",
      detalle: nombre.trim() ? `${nombre.trim()}${categoriaNombre ? ` · ${categoriaNombre}` : ""}` : "Nombre, categoría y foto",
      hecho: !esEdicion && indice > 0,
    },
    {
      clave: "presentaciones",
      titulo: "Presentaciones",
      detalle: cargandoPres
        ? "Cargando…"
        : presentaciones.length === 0
          ? "Precio y formas de venta"
          : `${activas} ${activas === 1 ? "activa" : "activas"} de ${presentaciones.length}`,
      bloqueado: !esEdicion && !infoValida,
      hecho: !esEdicion && indice > 1,
    },
    {
      clave: "publicacion",
      titulo: "Publicación",
      detalle: estado ? "Visible en la tienda" : "Oculto",
      bloqueado: !esEdicion && (!infoValida || !hayPresentacionActiva),
    },
  ];

  let pie;
  if (esEdicion) {
    pie = (
      <>
        {hayCambios && <span className="pie-aviso">Cambios sin guardar</span>}
        <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" form="form-producto" className="btn primario" disabled={guardando} aria-busy={guardando}>
          {guardando ? "Guardando…" : "Guardar producto"}
        </button>
      </>
    );
  } else {
    pie = (
      <>
        {hayCambios && <span className="pie-aviso">Cambios sin guardar</span>}
        {indice === 0 ? (
          <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
        ) : (
          <button type="button" className="btn secundario btn-con-icono" onClick={() => irA(ORDEN[indice - 1])} disabled={guardando}>
            <ArrowLeft size={16} aria-hidden /> Atrás
          </button>
        )}
        {paso === "publicacion" ? (
          <button type="submit" form="form-producto" className="btn primario btn-con-icono" disabled={guardando} aria-busy={guardando}>
            <PackagePlus size={16} aria-hidden /> {guardando ? "Creando…" : "Crear producto"}
          </button>
        ) : (
          <button type="button" className="btn primario btn-con-icono" onClick={() => irA(ORDEN[indice + 1])}>
            {paso === "info" ? "Continuar a presentaciones" : "Continuar a publicación"} <ArrowRight size={16} aria-hidden />
          </button>
        )}
      </>
    );
  }

  return (
    <Modal
      amplio
      ancho
      expandible
      cerrarConEscape
      titulo={esEdicion ? "Editar producto" : "Nuevo producto"}
      subtitulo={
        esEdicion
          ? `${producto!.codigo_producto} · ${producto!.nombre_producto}`
          : "Registra la información básica para incorporar un producto al catálogo."
      }
      clase="modal-producto"
      subcabecera={
        <PasosModal
          etiqueta={esEdicion ? "Secciones del producto" : "Pasos para crear el producto"}
          pasos={pasos}
          activo={paso}
          onCambiar={irA}
          numerados={!esEdicion}
          variante={esEdicion ? "pestanas" : "progreso"}
        />
      }
      onCerrar={cerrar}
      footer={pie}
    >
      <form
        id="form-producto"
        onSubmit={(e) => {
          // Al crear, Enter en un paso intermedio avanza en vez de crear.
          if (!esEdicion && paso !== "publicacion") {
            e.preventDefault();
            irA(ORDEN[indice + 1]);
            return;
          }
          guardar(e);
        }}
        noValidate
      >
        {error && (
          <div className="error-box" role="alert">
            <AlertTriangle size={15} style={{ marginRight: ".4rem", verticalAlign: "-2px" }} />
            {error}
          </div>
        )}

        {/* ------------------------------------------- 1 · Información
            A la izquierda, la tarjeta del producto: la zona de imagen ES la
            vista previa, con nombre, categoría y estado debajo, que se
            actualizan mientras se escribe. A la derecha, el formulario. */}
        {paso === "info" && (
          <div className="producto-paso prd-info" role="tabpanel">
            <aside className="prd-tarjeta" aria-label="Vista previa del producto">
              <MediaField
                variante="zona"
                valor={imagen}
                urlActual={producto?.imagen_url ?? null}
                onCambiar={setImagen}
                accept="image/png,image/jpeg,image/webp"
                ayuda="Imagen cuadrada y bien iluminada: ayuda a vender más."
                pie={
                  <div className="prd-tarjeta-pie">
                    <p className={`prd-tarjeta-nombre ${nombre.trim() ? "" : "vacio"}`}>
                      {nombre.trim() || "Nombre del producto"}
                    </p>
                    <div className="prd-tarjeta-meta">
                      <span className={`prd-chip ${categoriaNombre ? "" : "vacio"}`}>{categoriaNombre || "Sin categoría"}</span>
                      <span className={`prd-estado ${estado ? "visible" : ""}`}>
                        <span aria-hidden className="prd-estado-punto" />
                        {estado ? "Visible" : "Oculto"}
                      </span>
                    </div>
                  </div>
                }
              />
            </aside>

            <div className="prd-campos">
              <section className="prd-grupo" aria-labelledby="prd-grupo-principal">
                <h3 id="prd-grupo-principal" className="prd-grupo-titulo">Información principal</h3>

                <div className="campo prd-campo">
                  <label htmlFor="pr-nombre">
                    Nombre del producto <span className="prd-req">Obligatorio</span>
                  </label>
                  <input
                    id="pr-nombre"
                    ref={refNombre}
                    autoFocus
                    maxLength={200}
                    placeholder="Ej: Papa sabanera, Perfume floral 50 ml"
                    value={nombre}
                    onChange={(e) => {
                      setNombre(e.target.value);
                      if (errores.nombre) setErrores((x) => ({ ...x, nombre: undefined }));
                    }}
                    className={errores.nombre ? "campo-invalido" : ""}
                    aria-invalid={errores.nombre ? true : undefined}
                    aria-describedby={errores.nombre ? "pr-nombre-error" : undefined}
                  />
                  {errores.nombre && (
                    <p className="campo-error" id="pr-nombre-error" role="alert">
                      <AlertTriangle size={13} aria-hidden /> {errores.nombre}
                    </p>
                  )}
                </div>

                <div className="prd-dos">
                  <div className="campo prd-campo">
                    <label htmlFor="pr-categoria">
                      Categoría <span className="prd-req">Obligatorio</span>
                    </label>
                    <Combobox
                      id="pr-categoria"
                      ref={refCategoria}
                      valor={categoria}
                      opciones={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre_categoria }))}
                      onCambiar={(v) => {
                        setCategoria(v);
                        if (errores.categoria) setErrores((x) => ({ ...x, categoria: undefined }));
                      }}
                      placeholder="Selecciona una categoría"
                      invalido={Boolean(errores.categoria)}
                      describedBy={errores.categoria ? "pr-categoria-error" : undefined}
                    />
                    {errores.categoria && (
                      <p className="campo-error" id="pr-categoria-error" role="alert">
                        <AlertTriangle size={13} aria-hidden /> {errores.categoria}
                      </p>
                    )}
                  </div>

                  <div className="campo prd-campo">
                    <label htmlFor="pr-unidad-base">
                      Unidad de referencia <span className="prd-opc">Opcional</span>
                    </label>
                    <Combobox
                      id="pr-unidad-base"
                      valor={unidadBase}
                      opciones={unidadesLocales.map((u) => ({ valor: u.id, etiqueta: u.nombre_unidad, detalle: u.abreviatura_unidad }))}
                      onCambiar={setUnidadBase}
                      vacio="Sin definir"
                      icono={<Ruler size={15} />}
                      describedBy="pr-unidad-base-ayuda"
                    />
                  </div>
                </div>
                <p className="prd-nota" id="pr-unidad-base-ayuda">
                  <Info size={14} aria-hidden />
                  <span>
                    La <strong>unidad de referencia</strong> es la base para equivalencias e inventario (por ejemplo, kg).
                    No es una presentación de venta ni cambia precios: las formas de venta se definen en el siguiente paso.
                  </span>
                </p>
              </section>

              <section className="prd-grupo" aria-labelledby="prd-grupo-extra">
                <h3 id="prd-grupo-extra" className="prd-grupo-titulo">Información complementaria</h3>

                <div className="campo prd-campo">
                  <label htmlFor="pr-descripcion">
                    Descripción <span className="prd-opc">Opcional</span>
                  </label>
                  <textarea
                    id="pr-descripcion"
                    value={descripcion}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Papa criolla fresca, ideal para sopas, ajiaco y freír. Cosechada en la sabana."
                    aria-describedby="pr-descripcion-ayuda"
                  />
                  <p className="campo-ayuda prd-ayuda-fila" id="pr-descripcion-ayuda">
                    <span>Se muestra en el detalle del producto en la tienda.</span>
                    <span className={`prd-contador ${descripcion.length > 450 ? "cerca" : ""}`}>{descripcion.length}/500</span>
                  </p>
                </div>

                <div className="campo prd-campo">
                  <label htmlFor="pr-codigo-barras">
                    Código de barras <span className="prd-opc">Opcional</span>
                  </label>
                  <div className="prd-con-icono">
                    <Barcode size={15} aria-hidden />
                    <input
                      id="pr-codigo-barras"
                      value={codigoBarras}
                      maxLength={64}
                      inputMode="numeric"
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      placeholder="7701234567890"
                      aria-describedby="pr-codigo-barras-ayuda"
                    />
                  </div>
                  <p className="campo-ayuda" id="pr-codigo-barras-ayuda">
                    Identifica el artículo para el lector del punto de venta.
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* --------------------------------------------- 3 · Publicación */}
        {paso === "publicacion" && (
          <div className="producto-paso" role="tabpanel">
            <div className="producto-interruptores">
              <label className="campo-switch">
                <span className="switch">
                  <input type="checkbox" checked={estado} onChange={(e) => setEstado(e.target.checked)} />
                  <span className="switch-riel" />
                </span>
                <span>
                  <span className="campo-switch-titulo">
                    {estado ? "Visible para tus clientes" : "Oculto de la tienda"}
                  </span>
                  <span className="campo-switch-desc">
                    {estado
                      ? "El producto aparece en el catálogo y se puede pedir."
                      : "Queda guardado, pero no se muestra ni se puede pedir."}
                  </span>
                </span>
              </label>

              <label className="campo-switch">
                <span className="switch">
                  <input type="checkbox" checked={controlaStock} onChange={(e) => setControlaStock(e.target.checked)} />
                  <span className="switch-riel" />
                </span>
                <span>
                  <span className="campo-switch-titulo">
                    {controlaStock ? "Lleva cuenta de existencias" : "Sin control de existencias"}
                  </span>
                  <span className="campo-switch-desc">
                    {controlaStock
                      ? "Los pedidos apartan unidades y no se vende más de lo que hay."
                      : "Se puede pedir sin límite. Actívalo cuando hayas contado lo que tienes."}
                  </span>
                </span>
              </label>
            </div>

            {!esEdicion && (
              <div className="producto-resumen">
                <p className="producto-resumen-titulo">
                  <Package size={15} aria-hidden /> Así quedará el producto
                </p>
                <dl>
                  <div>
                    <dt>Nombre</dt>
                    <dd>{nombre.trim()}</dd>
                  </div>
                  <div>
                    <dt>Categoría</dt>
                    <dd>{categoriaNombre || "—"}</dd>
                  </div>
                  <div>
                    <dt>Unidad de referencia</dt>
                    <dd>{unidadBaseObj?.nombre_unidad ?? "Sin definir"}</dd>
                  </div>
                  <div>
                    <dt>Foto</dt>
                    <dd>{imagen ? "Cargada" : "Sin foto"}</dd>
                  </div>
                  <div className="producto-resumen-ancho">
                    <dt>Presentaciones</dt>
                    <dd>
                      <ul className="producto-resumen-pres">
                        {presentaciones.map((p, i) => (
                          <li key={i} className={p.estado_presentacion ? "" : "inactiva"}>
                            {p.estado_presentacion ? <Check size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
                            {p.nombre_presentacion || "Sin nombre"}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt>En la tienda</dt>
                    <dd className="producto-resumen-estado">
                      {estado ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
                      {estado ? "Visible" : "Oculto"}
                    </dd>
                  </div>
                  <div>
                    <dt>Existencias</dt>
                    <dd>{controlaStock ? "Con control" : "Sin control"}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )}
      </form>

      {/* ------------------------------------------- 2 · Presentaciones
          Fuera del <form> del producto: la sección tiene sus propios botones
          y su propio formulario (en el modal de la presentación). */}
      {paso === "presentaciones" && (
        <div ref={refSeccion} className="producto-seccion-presentaciones producto-paso" role="tabpanel">
          <PresentacionesComerciales
            productoId={producto?.id ?? null}
            productoNombre={nombre.trim() || producto?.nombre_producto || ""}
            presentaciones={presentaciones}
            onCambiar={(lista) => {
              setPresentaciones(lista);
              if (lista.some((p) => p.estado_presentacion)) setErrorPresentaciones(null);
            }}
            cargando={cargandoPres}
            errorCarga={errorCargaPres}
            onReintentar={cargarPresentaciones}
            unidades={unidadesLocales}
            onUnidadCreada={unidadCreada}
            unidadBase={unidadBaseObj}
            puedeEditar={puedeEditarPresentaciones}
            onPersistido={() => onPresentacionesCambiadas?.()}
            error={errorPresentaciones}
          />
        </div>
      )}
    </Modal>
  );
}
