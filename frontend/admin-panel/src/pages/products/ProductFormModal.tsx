import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Package } from "lucide-react";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
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
  const [imagen, setImagen] = useState<File | null>(null);

  const [unidadesLocales, setUnidadesLocales] = useState(unidades);
  const [presentaciones, setPresentaciones] = useState<BorradorPresentacion[]>([]);
  const [cargandoPres, setCargandoPres] = useState(esEdicion);
  const [errorCargaPres, setErrorCargaPres] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Partial<Record<CampoProducto, string>>>({});
  const [errorPresentaciones, setErrorPresentaciones] = useState<string | null>(null);
  const refNombre = useRef<HTMLInputElement>(null);
  const refCategoria = useRef<HTMLSelectElement>(null);
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
    () => JSON.stringify([nombre.trim(), categoria, unidadBase, estado, controlaStock, codigoBarras.trim(), imagen?.name]),
    [nombre, categoria, unidadBase, estado, controlaStock, codigoBarras, imagen]
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

  async function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    if (guardando) return;
    setError(null);
    setErrorPresentaciones(null);

    const nuevos: Partial<Record<CampoProducto, string>> = {};
    if (!nombre.trim()) nuevos.nombre = "Escribe el nombre del producto.";
    if (categoria === "") nuevos.categoria = "Elige una categoría.";
    setErrores(nuevos);

    let errorSeccion: string | null = null;
    if (!esEdicion && !presentaciones.some((p) => p.estado_presentacion)) {
      errorSeccion = "Agrega al menos una presentación activa: es la que da precio al producto.";
    }
    setErrorPresentaciones(errorSeccion);

    if (nuevos.nombre) return refNombre.current?.focus();
    if (nuevos.categoria) return refCategoria.current?.focus();
    if (errorSeccion) {
      refSeccion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      refSeccion.current?.querySelector<HTMLButtonElement>(".pc-agregar")?.focus();
      return;
    }

    const base = {
      nombre_producto: nombre.trim(),
      categoria: Number(categoria),
      unidad_base: unidadBase === "" ? null : Number(unidadBase),
      estado_producto: estado,
      controla_stock: controlaStock,
      codigo_barras: codigoBarras.trim(),
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
            refSeccion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        if (porCampo.nombre) refNombre.current?.focus();
        else if (porCampo.categoria) refCategoria.current?.focus();
        else setError(extraerMensajeError(err, "No se pudo guardar el producto."));
      }
    } finally {
      setGuardando(false);
    }
  }

  const unidadBaseObj = unidadBase === "" ? null : unidadesLocales.find((u) => u.id === unidadBase) ?? null;

  return (
    <Modal
      amplio
      ancho
      cerrarConEscape
      titulo={esEdicion ? "Editar producto" : "Nuevo producto"}
      subtitulo={esEdicion ? `${producto!.codigo_producto} · ${producto!.nombre_producto}` : undefined}
      onCerrar={cerrar}
      footer={
        <>
          {hayCambios && <span className="pie-aviso">Cambios sin guardar</span>}
          <button type="button" className="btn secundario" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-producto"
            className="btn primario"
            disabled={guardando}
            aria-busy={guardando}
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar producto" : "Crear producto"}
          </button>
        </>
      }
    >
      <form id="form-producto" onSubmit={guardar} noValidate>
        {error && (
          <div className="error-box" role="alert">
            <AlertTriangle size={15} style={{ marginRight: ".4rem", verticalAlign: "-2px" }} />
            {error}
          </div>
        )}

        <div className="modal-seccion">
          <Package size={16} aria-hidden />
          <span>Información básica</span>
        </div>

        <div className="producto-basico">
          <div className="producto-hero">
            <MediaField
              valor={imagen}
              urlActual={producto?.imagen_url ?? null}
              onCambiar={setImagen}
              accept="image/png,image/jpeg,image/webp"
              ayuda="Una foto clara ayuda a vender más. Se recomienda una imagen cuadrada."
            />
          </div>

          <div className="producto-basico-campos">
            <div className="campo">
              <label htmlFor="pr-nombre">Nombre del producto *</label>
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

            <div className="fila fila-responsive">
              <div className="campo">
                <label htmlFor="pr-categoria">Categoría *</label>
                <select
                  id="pr-categoria"
                  ref={refCategoria}
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value === "" ? "" : Number(e.target.value));
                    if (errores.categoria) setErrores((x) => ({ ...x, categoria: undefined }));
                  }}
                  className={errores.categoria ? "campo-invalido" : ""}
                  aria-invalid={errores.categoria ? true : undefined}
                  aria-describedby={errores.categoria ? "pr-categoria-error" : undefined}
                >
                  <option value="">Selecciona…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_categoria}
                    </option>
                  ))}
                </select>
                {errores.categoria && (
                  <p className="campo-error" id="pr-categoria-error" role="alert">
                    <AlertTriangle size={13} aria-hidden /> {errores.categoria}
                  </p>
                )}
              </div>
              <div className="campo">
                <label htmlFor="pr-unidad-base">Unidad de referencia</label>
                <select
                  id="pr-unidad-base"
                  value={unidadBase}
                  onChange={(e) => setUnidadBase(e.target.value === "" ? "" : Number(e.target.value))}
                  aria-describedby="pr-unidad-base-ayuda"
                >
                  <option value="">Sin definir</option>
                  {unidadesLocales.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_unidad}
                    </option>
                  ))}
                </select>
                <p className="campo-ayuda" id="pr-unidad-base-ayuda">
                  Base para las equivalencias e inventario. No cambia precios.
                </p>
              </div>
            </div>

            <div className="campo">
              <label htmlFor="pr-codigo-barras">Código de barras</label>
              <input
                id="pr-codigo-barras"
                value={codigoBarras}
                maxLength={64}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="7701234567890"
                aria-describedby="pr-codigo-barras-ayuda"
              />
              <p className="campo-ayuda" id="pr-codigo-barras-ayuda">
                Opcional. Identifica el artículo para el lector del punto de venta.
              </p>
            </div>
          </div>
        </div>

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
              <input
                type="checkbox"
                checked={controlaStock}
                onChange={(e) => setControlaStock(e.target.checked)}
              />
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
      </form>

      {/* Fuera del <form> del producto: la sección tiene sus propios botones
          y su propio formulario (en el modal de la presentación). */}
      <div ref={refSeccion} className="producto-seccion-presentaciones">
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
    </Modal>
  );
}
