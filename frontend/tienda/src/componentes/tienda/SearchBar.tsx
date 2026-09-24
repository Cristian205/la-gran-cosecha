"use client";

import { ArrowRight, LayoutGrid, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { useTienda } from "@/estado/tienda";
import { obtenerProductos } from "@/lib/datos";
import type { Categoria, Producto } from "@/lib/tipos";
import { formatoPrecio, normalizarTexto } from "@/lib/utiles";
import { ImagenProducto } from "./ImagenProducto";

interface Props {
  placeholder?: string;
  /** Una pregunta visible encima del campo ("¿Qué estás buscando?"). */
  etiqueta?: string;
}

type Opcion =
  | { tipo: "categoria"; categoria: Categoria }
  | { tipo: "producto"; producto: Producto }
  | { tipo: "todos" };

const MINIMO = 2;

/** Lleva la vista al principio del catálogo, bajo la barra fija. */
function irAlCatalogo() {
  document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * El buscador del catálogo: la herramienta central de /tienda.
 *
 * Es el MISMO texto de búsqueda que el del Navbar (`useEnvoltorio`), no un
 * segundo buscador con su propio estado: escribir aquí o arriba filtra la
 * misma rejilla y los dos campos muestran lo mismo. Lo que añade es la
 * lista de sugerencias pensada para comprar:
 *
 *   · categorías que coinciden → filtran el catálogo en el sitio;
 *   · productos (con foto, categoría y precio "desde") → abren la vista
 *     rápida, donde se elige la unidad y se agrega;
 *   · "Ver los N resultados" → baja al catálogo ya filtrado.
 *
 * Patrón combobox de ARIA: flechas para recorrer, Enter para elegir, Esc
 * para cerrar. Mientras este campo está a la vista, el buscador del Navbar
 * se oculta (clase en `<body>`): dos campos idénticos uno encima del otro
 * solo obligan a elegir cuál usar.
 */
export function SearchBar({ placeholder = "Buscar productos…", etiqueta }: Props) {
  const catalogo = useCatalogoContexto();
  const envoltorio = useEnvoltorio();
  const busqueda = catalogo?.busqueda ?? envoltorio.busqueda;
  const buscar = catalogo?.buscar ?? envoltorio.buscar;
  const abrirVistaRapida = useTienda((s) => s.abrirVistaRapida);

  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);

  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const idLista = useId();

  const q = busqueda.trim();

  // Sugerencias de productos: el backend recorta a 5 y trae `count`, que es
  // el número real de coincidencias en todo el catálogo.
  useEffect(() => {
    if (q.length < MINIMO) {
      setProductos([]);
      setTotal(null);
      setBuscando(false);
      return;
    }
    const controlador = new AbortController();
    setBuscando(true);
    const t = window.setTimeout(() => {
      obtenerProductos({ search: q, pageSize: 5, signal: controlador.signal })
        .then((d) => {
          setProductos(d.results);
          setTotal(d.count);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controlador.signal.aborted) setBuscando(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(t);
      controlador.abort();
    };
  }, [q]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  // Mientras este buscador se ve, el del Navbar sobra.
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => {
      document.body.classList.toggle("buscador-tienda-visible", e.isIntersecting);
      // Una lista de sugerencias colgando sobre la rejilla, lejos de su campo,
      // ya no se entiende: se cierra al salir el buscador de la vista.
      if (!e.isIntersecting) setAbierto(false);
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      document.body.classList.remove("buscador-tienda-visible");
    };
  }, []);

  const categorias = useMemo(() => {
    if (q.length < MINIMO || !catalogo) return [];
    const n = normalizarTexto(q);
    return catalogo.categorias.filter((c) => normalizarTexto(c.nombre_categoria).includes(n)).slice(0, 3);
  }, [q, catalogo]);

  const opciones: Opcion[] = useMemo(() => {
    const lista: Opcion[] = [
      ...categorias.map((categoria) => ({ tipo: "categoria" as const, categoria })),
      ...productos.map((producto) => ({ tipo: "producto" as const, producto })),
    ];
    if (total !== null && total > 0) lista.push({ tipo: "todos" });
    return lista;
  }, [categorias, productos, total]);

  useEffect(() => setActiva(-1), [q]);
  useEffect(() => {
    if (!abierto) setActiva(-1);
  }, [abierto]);

  const mostrarLista = abierto && q.length >= MINIMO;

  function elegir(opcion: Opcion) {
    setAbierto(false);
    if (opcion.tipo === "categoria") {
      buscar("");
      catalogo?.cambiarCategoria(opcion.categoria.id);
      irAlCatalogo();
    } else if (opcion.tipo === "producto") {
      abrirVistaRapida(opcion.producto);
    } else {
      irAlCatalogo();
    }
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActiva((i) => (opciones.length ? (i + 1) % opciones.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => (opciones.length ? (i <= 0 ? opciones.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mostrarLista && activa >= 0 && opciones[activa]) elegir(opciones[activa]);
      else {
        setAbierto(false);
        irAlCatalogo();
      }
    } else if (e.key === "Escape") {
      if (mostrarLista) setAbierto(false);
      else buscar("");
    }
  }

  const idOpcion = (i: number) => `${idLista}-op-${i}`;

  return (
    <div className="sbar" ref={raiz}>
      {etiqueta && (
        <label className="sbar-etiqueta" htmlFor={`${idLista}-campo`}>
          {etiqueta}
        </label>
      )}
      <div className={`sbar-campo ${mostrarLista ? "is-abierto" : ""}`}>
        {buscando ? (
          <Loader2 size={20} className="sbar-icono girando" aria-hidden="true" />
        ) : (
          <Search size={20} className="sbar-icono" aria-hidden="true" />
        )}
        <input
          ref={campo}
          id={`${idLista}-campo`}
          type="search"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista && activa >= 0 ? idOpcion(activa) : undefined}
          aria-label={etiqueta ? undefined : "Buscar productos"}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={busqueda}
          onChange={(e) => {
            buscar(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
        />
        {busqueda && (
          <button
            type="button"
            className="sbar-limpiar"
            onClick={() => {
              buscar("");
              campo.current?.focus();
            }}
            aria-label="Borrar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {mostrarLista && (
        <div className="sbar-lista" id={idLista} role="listbox" aria-label="Sugerencias">
          {opciones.length === 0 ? (
            <p className="sbar-vacio">
              {buscando ? "Buscando…" : <>No encontramos “{q}”. Prueba con otra palabra.</>}
            </p>
          ) : (
            opciones.map((op, i) => {
              const comun = {
                id: idOpcion(i),
                role: "option" as const,
                "aria-selected": i === activa,
                className: `sbar-op sbar-op--${op.tipo} ${i === activa ? "is-activa" : ""}`,
                onMouseEnter: () => setActiva(i),
                // `mousedown` + preventDefault: elegir no debe quitarle el
                // foco al campo antes de tiempo (cerraría la lista primero).
                onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
                onClick: () => elegir(op),
              };
              if (op.tipo === "categoria") {
                return (
                  <div key={`c-${op.categoria.id}`} {...comun}>
                    <span className="sbar-op-icono">
                      <LayoutGrid size={16} aria-hidden="true" />
                    </span>
                    <span className="sbar-op-texto">
                      <b>{op.categoria.nombre_categoria}</b>
                      <small>
                        Categoría
                        {op.categoria.num_productos ? ` · ${op.categoria.num_productos} productos` : ""}
                      </small>
                    </span>
                  </div>
                );
              }
              if (op.tipo === "producto") {
                const p = op.producto;
                return (
                  <div key={`p-${p.id}`} {...comun}>
                    <ImagenProducto producto={p} tamanoIcono={26} className="sbar-op-img" />
                    <span className="sbar-op-texto">
                      <b>{p.nombre_producto}</b>
                      <small>{p.categoria_nombre}</small>
                    </span>
                    {p.precio_desde && (
                      <span className="sbar-op-precio">
                        <small>desde</small> {formatoPrecio(p.precio_desde)}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <div key="todos" {...comun}>
                  <span className="sbar-op-texto">
                    <b>
                      Ver {total === 1 ? "el resultado" : `los ${total} resultados`} para “{q}”
                    </b>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
