"use client";

import { ArrowRight, Check, Loader2, Minus, PackagePlus, Plus, Ruler, Search, Tag, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { obtenerProductos, obtenerUnidades } from "@/lib/datos";
import { useCart } from "@/estado/carrito";
import { useTienda } from "@/estado/tienda";
import type { Categoria, Producto, UnidadMedida } from "@/lib/tipos";
import { ajustarCantidad, formatoCantidad, formatoPrecio, normalizarTexto, parsearCantidad } from "@/lib/utiles";
import { ImagenProducto } from "@/componentes/tienda/ImagenProducto";
import { SelectorBuscable } from "@/componentes/tienda/SelectorBuscable";
import { cantidadConUnidad } from "@/lib/cantidadHumana";

interface Props {
  categorias: Categoria[];
  /** Categoría filtrada en la tienda: llega elegida, pero se puede cambiar. */
  categoriaFija?: Categoria | null;
  /** Lo que el cliente buscó sin encontrarlo: llega ya escrito en el campo. */
  nombreInicial?: string;
  /** El texto del botón que despliega el formulario. */
  textoBoton?: string;
}

/** Desde cuántas letras se consulta el catálogo. */
const MINIMO = 2;
/**
 * La cantidad se dice en fracciones de mostrador ("1/2", "1 1/2"), nunca
 * "0,5": los botones van de media en media y a mano se puede escribir hasta
 * un cuarto ("3/4", "2 1/4"), con el mismo lector que el resto de la tienda.
 */
const PASO = 0.5;
const CANTIDAD_MINIMA = 0.5;
const PASO_ESCRITO = 0.25;

/**
 * Pedir algo que no está en el catálogo.
 *
 * Solo agrega una línea MANUAL al pedido (`agregarPersonalizado`): nombre,
 * cantidad, unidad y categoría. No crea productos, presentaciones ni precios
 * —el precio lo confirma el negocio al recibir el pedido—, y por eso no se
 * envía ninguno.
 *
 * Mientras se escribe el nombre, el catálogo sugiere lo parecido. Elegir una
 * sugerencia abre la vista rápida, el flujo normal de compra. Si lo escrito
 * coincide con un producto que ya existe, «Agregar» no lo duplica en
 * silencio: primero lo muestra y pide confirmar la solicitud manual.
 */
export function CustomProductForm({
  categorias,
  categoriaFija,
  nombreInicial = "",
  textoBoton = "¿No encuentras tu producto? Escríbelo aquí",
}: Props) {
  const agregarPersonalizado = useCart((s) => s.agregarPersonalizado);
  const abrirVistaRapida = useTienda((s) => s.abrirVistaRapida);

  const [abierto, setAbierto] = useState(false);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [nombre, setNombre] = useState(nombreInicial);
  const [cantidad, setCantidad] = useState(1);
  /** Lo que el cliente está escribiendo en la cantidad; null = mostrar la fracción. */
  const [cantidadTexto, setCantidadTexto] = useState<string | null>(null);
  const [unidadId, setUnidadId] = useState<number | "">("");
  const [categoriaId, setCategoriaId] = useState<number | "">(categoriaFija?.id ?? "");
  const [confirmado, setConfirmado] = useState(false);

  // Sugerencias del catálogo.
  const [sugerencias, setSugerencias] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const [activa, setActiva] = useState(-1);
  /** El nombre para el que el cliente ya dijo «no es ninguno de estos». */
  const [manualPara, setManualPara] = useState<string | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState(false);

  const raiz = useRef<HTMLFormElement>(null);
  const id = useId();
  const idLista = `${id}-lista`;

  useEffect(() => {
    if (abierto && unidades.length === 0) {
      obtenerUnidades()
        .then(setUnidades)
        .catch(() => setUnidades([]));
    }
  }, [abierto, unidades.length]);

  // La categoría del filtro manda; si el cliente cambia de filtro, se refleja.
  useEffect(() => {
    if (categoriaFija) setCategoriaId(categoriaFija.id);
  }, [categoriaFija]);

  const q = nombre.trim();
  const qNormal = normalizarTexto(q);

  useEffect(() => {
    if (!abierto || q.length < MINIMO) {
      setSugerencias([]);
      setBuscado("");
      setBuscando(false);
      return;
    }
    const controlador = new AbortController();
    setBuscando(true);
    const t = window.setTimeout(() => {
      obtenerProductos({ search: q, pageSize: 5, signal: controlador.signal })
        .then((d) => {
          setSugerencias(d.results);
          setBuscado(q);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controlador.signal.aborted) setBuscando(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(t);
      controlador.abort();
    };
  }, [abierto, q]);

  useEffect(() => {
    setActiva(-1);
    setAvisoDuplicado(false);
  }, [q]);

  // Cerrar la lista al hacer clic fuera del formulario.
  useEffect(() => {
    if (!listaAbierta) return;
    function fuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setListaAbierta(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [listaAbierta]);

  const manualConfirmado = manualPara !== null && manualPara === qNormal;
  const coincidencia = useMemo(
    () => sugerencias.find((p) => normalizarTexto(p.nombre_producto) === qNormal) ?? null,
    [sugerencias, qNormal]
  );
  const resultadosAlDia = buscado === q;
  const sinCoincidencias = resultadosAlDia && sugerencias.length === 0 && q.length >= MINIMO;
  const mostrarLista = listaAbierta && resultadosAlDia && sugerencias.length > 0 && !manualConfirmado;
  // Las opciones navegables: las sugerencias y, al final, la salida manual.
  const totalOpciones = sugerencias.length + 1;

  // Mientras se escribe, lo que no se entiende se marca, pero no se pierde.
  const cantidadValida =
    cantidadTexto === null || parsearCantidad(cantidadTexto, PASO_ESCRITO) !== null;

  function cambiarCantidad(delta: number) {
    setCantidadTexto(null);
    setCantidad((c) => ajustarCantidad(c, delta, PASO_ESCRITO, CANTIDAD_MINIMA));
  }

  /** Lee lo escrito ("1 1/2", "3/4", "2"); si no se entiende, se queda la cantidad anterior. */
  function confirmarCantidad(): number {
    if (cantidadTexto === null) return cantidad;
    const valor = parsearCantidad(cantidadTexto, PASO_ESCRITO);
    setCantidadTexto(null);
    if (valor === null) return cantidad;
    setCantidad(valor);
    return valor;
  }

  function verEnCatalogo(producto: Producto) {
    setListaAbierta(false);
    abrirVistaRapida(producto);
  }

  function continuarManual() {
    setManualPara(qNormal);
    setListaAbierta(false);
    setAvisoDuplicado(false);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrarLista) {
      if (e.key === "ArrowDown" && sugerencias.length > 0 && resultadosAlDia) {
        e.preventDefault();
        setManualPara(null);
        setListaAbierta(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiva((i) => (i + 1) % totalOpciones);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => (i <= 0 ? totalOpciones - 1 : i - 1));
    } else if (e.key === "Enter" && activa >= 0) {
      e.preventDefault();
      if (activa < sugerencias.length) verEnCatalogo(sugerencias[activa]);
      else continuarManual();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setListaAbierta(false);
    }
  }

  function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    const categoria = categorias.find((c) => c.id === categoriaId) ?? (categoriaFija?.id === categoriaId ? categoriaFija : null);
    if (!q || !cantidadValida || !categoria) return;

    // Nunca se registra como manual algo del catálogo sin que el cliente lo diga.
    if (coincidencia && !manualConfirmado) {
      setAvisoDuplicado(true);
      setListaAbierta(true);
      return;
    }

    // Enter dentro de la cantidad envía sin pasar por el blur: se lee aquí.
    const cantidadFinal = confirmarCantidad();
    const unidad = unidades.find((u) => u.id === unidadId);
    agregarPersonalizado({
      id: crypto.randomUUID(),
      nombre: q,
      cantidad: cantidadFinal,
      unidadId: unidad ? unidad.id : null,
      unidadNombre: unidad ? unidad.nombre_unidad : "",
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre_categoria,
    });

    setNombre("");
    setCantidad(1);
    setCantidadTexto(null);
    setUnidadId("");
    setManualPara(null);
    setListaAbierta(false);
    setConfirmado(true);
    setTimeout(() => setConfirmado(false), 1800);
  }

  if (!abierto) {
    return (
      <button type="button" className="custom-prod-toggle" onClick={() => setAbierto(true)}>
        <PackagePlus size={16} aria-hidden="true" />
        {textoBoton}
      </button>
    );
  }

  const idOpcion = (i: number) => `${id}-op-${i}`;
  const unidadElegida = unidades.find((u) => u.id === unidadId) ?? null;
  const opcionesUnidad = unidades.map((u) => ({
    valor: u.id,
    etiqueta: u.nombre_unidad,
    detalle: u.abreviatura_unidad !== u.nombre_unidad ? u.abreviatura_unidad : undefined,
  }));
  const opcionesCategoria = [
    ...(categoriaFija && !categorias.some((c) => c.id === categoriaFija.id) ? [categoriaFija] : []),
    ...categorias,
  ].map((c) => ({ valor: c.id, etiqueta: c.nombre_categoria }));

  return (
    <form className="cpf" onSubmit={handleAgregar} ref={raiz} aria-labelledby={`${id}-titulo`}>
      <header className="cpf-cabecera">
        <span className="cpf-insignia" aria-hidden="true">
          <PackagePlus size={20} />
        </span>
        <div className="cpf-cabecera-texto">
          <h4 className="cpf-titulo" id={`${id}-titulo`}>¿No encuentras un producto?</h4>
          <p className="cpf-subtitulo">Agrégalo a tu pedido y confirmaremos su disponibilidad y precio.</p>
        </div>
        <button type="button" className="cpf-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">
          <X size={18} />
        </button>
      </header>

      <div className="cpf-campos">
        {/* Nombre + sugerencias del catálogo (combobox de ARIA). */}
        <div className="cpf-campo cpf-campo--nombre">
          <label className="cpf-etiqueta" htmlFor={`${id}-nombre`}>
            Nombre del producto
          </label>
          <div className={`cpf-control ${mostrarLista ? "is-abierto" : ""}`}>
            {buscando ? (
              <Loader2 size={17} className="cpf-icono girando" aria-hidden="true" />
            ) : (
              <Search size={17} className="cpf-icono" aria-hidden="true" />
            )}
            <input
              id={`${id}-nombre`}
              type="text"
              role="combobox"
              aria-expanded={mostrarLista}
              aria-controls={idLista}
              aria-autocomplete="list"
              aria-activedescendant={mostrarLista && activa >= 0 ? idOpcion(activa) : undefined}
              autoComplete="off"
              placeholder="Ej. Papa criolla costeña"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setManualPara(null);
                setListaAbierta(true);
              }}
              onFocus={() => setListaAbierta(true)}
              onKeyDown={alTeclear}
              maxLength={255}
              required
            />
          </div>

          {mostrarLista && (
            <div className="cpf-sugerencias">
              <p className="cpf-sugerencias-titulo">
                {avisoDuplicado && coincidencia
                  ? `«${coincidencia.nombre_producto}» ya está en el catálogo. ¿Es este?`
                  : "¿Es alguno de estos? Ya los tenemos en el catálogo"}
              </p>
              <ul id={idLista} role="listbox" aria-label="Productos del catálogo" className="cpf-lista">
                {sugerencias.map((p, i) => {
                  const presentaciones = [...new Set(p.presentaciones.map((x) => x.nombre_presentacion))];
                  return (
                    <li
                      key={p.id}
                      id={idOpcion(i)}
                      role="option"
                      aria-selected={activa === i}
                      className={`cpf-op ${activa === i ? "is-activa" : ""}`}
                      onMouseEnter={() => setActiva(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => verEnCatalogo(p)}
                    >
                      <ImagenProducto producto={p} tamanoIcono={22} className="cpf-op-img" />
                      <span className="cpf-op-texto">
                        <span className="cpf-op-nombre">{p.nombre_producto}</span>
                        <span className="cpf-op-detalle">
                          {p.categoria_nombre}
                          {presentaciones.length > 0 && ` · ${presentaciones.slice(0, 3).join(", ")}`}
                        </span>
                      </span>
                      {p.precio_desde && (
                        <span className="cpf-op-precio">
                          <small>desde</small> {formatoPrecio(Number(p.precio_desde))}
                        </span>
                      )}
                    </li>
                  );
                })}
                <li
                  id={idOpcion(sugerencias.length)}
                  role="option"
                  aria-selected={activa === sugerencias.length}
                  className={`cpf-op cpf-op--manual ${activa === sugerencias.length ? "is-activa" : ""}`}
                  onMouseEnter={() => setActiva(sugerencias.length)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={continuarManual}
                >
                  <span className="cpf-op-manual-icono" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                  <span className="cpf-op-texto">
                    <span className="cpf-op-nombre">Continuar con solicitud manual</span>
                    <span className="cpf-op-detalle">Ninguno es lo que busco: pedir «{q}»</span>
                  </span>
                </li>
              </ul>
            </div>
          )}

          {!mostrarLista && (manualConfirmado || sinCoincidencias) && (
            <p className="cpf-nota" role="status">
              <Check size={14} aria-hidden="true" />
              {manualConfirmado ? "Se agregará como solicitud manual." : "No está en el catálogo: lo pedimos por ti."}
            </p>
          )}
        </div>

        <div className="cpf-campo cpf-campo--cantidad">
          <label className="cpf-etiqueta" htmlFor={`${id}-cantidad`}>
            Cantidad
          </label>
          <div className="cpf-paso">
            <button
              type="button"
              onClick={() => cambiarCantidad(-PASO)}
              disabled={cantidadTexto === null && cantidad <= CANTIDAD_MINIMA}
              aria-label="Menos"
            >
              <Minus size={16} />
            </button>
            {/* Teclado de texto y no numérico: "1 1/2" necesita la barra y el espacio. */}
            <input
              id={`${id}-cantidad`}
              type="text"
              autoComplete="off"
              value={cantidadTexto ?? formatoCantidad(cantidad, true)}
              onChange={(e) => setCantidadTexto(e.target.value.replace(/[^\d\s/.,]/g, ""))}
              onBlur={confirmarCantidad}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCantidadTexto(null);
                  e.currentTarget.blur();
                }
              }}
              aria-invalid={!cantidadValida}
              aria-describedby={`${id}-cantidad-ayuda`}
              required
            />
            <span id={`${id}-cantidad-ayuda`} hidden>
              Puedes escribir fracciones como 1/2, 3/4 o 1 1/2.
            </span>
            <button type="button" onClick={() => cambiarCantidad(PASO)} aria-label="Más">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="cpf-campo cpf-campo--unidad">
          <label className="cpf-etiqueta" htmlFor={`${id}-unidad`}>
            Unidad
          </label>
          <SelectorBuscable
            id={`${id}-unidad`}
            icono={<Ruler size={15} />}
            opciones={opcionesUnidad}
            valor={unidadId === "" ? null : unidadId}
            onCambiar={(v) => setUnidadId(v ?? "")}
            placeholder="Opcional"
            opcional
            etiquetaLista="Unidades"
          />
        </div>

        <div className="cpf-campo cpf-campo--categoria">
          <label className="cpf-etiqueta" htmlFor={`${id}-categoria`}>
            Categoría
          </label>
          <SelectorBuscable
            id={`${id}-categoria`}
            icono={<Tag size={15} />}
            opciones={opcionesCategoria}
            valor={categoriaId === "" ? null : categoriaId}
            onCambiar={(v) => setCategoriaId(v ?? "")}
            placeholder="Elige una"
            mensajeRequerido="Elige una categoría de la lista."
            etiquetaLista="Categorías"
          />
        </div>
      </div>

      <footer className="cpf-pie">
        {/* Lo que va a quedar en el pedido, dicho como en el mercado: así se
            revisa antes de agregar ("1 1/2 bultos de papa criolla"). */}
        <div className="cpf-resumen" aria-live="polite">
          {q ? (
            <p className="cpf-resumen-linea">
              <span>Vas a pedir</span>{" "}
              <b>
                {cantidadConUnidad(cantidad, unidadElegida?.nombre_unidad || "unidad")} de {q}
              </b>
            </p>
          ) : null}
          <p className="cpf-aviso">El precio se confirma al recibir tu pedido. No se agrega al catálogo.</p>
        </div>
        <div className="cpf-acciones">
          <button type="button" className="btn btn-outline" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
          <button type="submit" className={`btn btn-verde ${confirmado ? "is-confirmado" : ""}`}>
            {confirmado ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {confirmado ? "¡Agregado!" : "Agregar al pedido"}
          </button>
        </div>
      </footer>
    </form>
  );
}
