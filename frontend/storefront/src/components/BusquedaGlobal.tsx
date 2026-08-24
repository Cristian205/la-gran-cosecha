import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { obtenerCategorias, obtenerProductos } from "../api/catalog";
import { useSiteConfig } from "../context/SiteConfigContext";
import type { Categoria, Producto, SiteConfig } from "../types";
import { normalizarTexto } from "../utils";

interface Props {
  busqueda: string;
  onBuscar: (valor: string) => void;
  onNavegar?: () => void;
  atajoTeclado?: boolean;
  autoFocus?: boolean;
}

interface PaginaBuscable {
  titulo: string;
  ruta: string;
  resaltar?: string;
  palabras: string[];
}

function construirPaginas(config: SiteConfig): PaginaBuscable[] {
  const paginas: PaginaBuscable[] = [
    { titulo: "Inicio", ruta: "/", palabras: ["inicio", "home", "portada", "promociones"] },
    { titulo: "Tienda", ruta: "/tienda", palabras: ["tienda", "catálogo", "comprar", "productos"] },
    {
      titulo: "Nosotros",
      ruta: "/nosotros",
      resaltar: "valores",
      palabras: ["nosotros", "quienes somos", "equipo", "valores"],
    },
    {
      titulo: "Contáctanos",
      ruta: "/contacto",
      resaltar: "contacto-form",
      palabras: ["contacto", "contáctanos", "escríbenos", "mensaje"],
    },
  ];

  if (config.historia || config.mision) {
    paginas.push({
      titulo: "Nuestra historia y misión",
      ruta: "/nosotros",
      resaltar: "historia-mision",
      palabras: ["historia", "misión", "quienes somos"],
    });
  }
  if (config.telefono) {
    paginas.push({
      titulo: "Teléfono",
      ruta: "/contacto",
      resaltar: "contacto-telefono",
      palabras: ["teléfono", "llamar", "número"],
    });
  }
  if (config.whatsapp_numero) {
    paginas.push({
      titulo: "WhatsApp",
      ruta: "/contacto",
      resaltar: "contacto-whatsapp",
      palabras: ["whatsapp", "chat"],
    });
  }
  if (config.email) {
    paginas.push({
      titulo: "Correo",
      ruta: "/contacto",
      resaltar: "contacto-correo",
      palabras: ["correo", "email", "mail"],
    });
  }
  if (config.direccion || config.ciudad) {
    paginas.push({
      titulo: "Ubicación",
      ruta: "/contacto",
      resaltar: "contacto-ubicacion",
      palabras: ["dirección", "ubicación", "ciudad", "dónde"],
    });
  }
  if (config.horario) {
    paginas.push({
      titulo: "Horario de atención",
      ruta: "/contacto",
      resaltar: "contacto-horario",
      palabras: ["horario", "hora", "atención"],
    });
  }
  return paginas;
}

export function BusquedaGlobal({ busqueda, onBuscar, onNavegar, atajoTeclado, autoFocus }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useSiteConfig();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [abierto, setAbierto] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const contRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) {
      setProductos([]);
      return;
    }
    const id = setTimeout(() => {
      // El dropdown solo muestra 5: que el backend recorte, no el cliente.
      obtenerProductos({ search: q, pageSize: 5 })
        .then((data) => setProductos(data.results))
        .catch(() => setProductos([]));
    }, 250);
    return () => clearTimeout(id);
  }, [busqueda]);

  useEffect(() => {
    function alHacerClic(e: MouseEvent) {
      if (contRef.current && !contRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClic);
    return () => document.removeEventListener("mousedown", alHacerClic);
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!atajoTeclado) return;
    function alPresionar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setAbierto(true);
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [atajoTeclado]);

  const q = normalizarTexto(busqueda.trim());
  const paginas = useMemo(() => construirPaginas(config), [config]);

  const categoriasCoincidentes = useMemo(
    () =>
      q.length < 2
        ? []
        : categorias.filter((c) => normalizarTexto(c.nombre_categoria).includes(q)).slice(0, 4),
    [categorias, q]
  );

  const paginasCoincidentes = useMemo(
    () =>
      q.length < 2
        ? []
        : paginas
            .filter(
              (p) =>
                normalizarTexto(p.titulo).includes(q) ||
                p.palabras.some((palabra) => normalizarTexto(palabra).includes(q))
            )
            .slice(0, 4),
    [paginas, q]
  );

  const hayResultados =
    productos.length > 0 || categoriasCoincidentes.length > 0 || paginasCoincidentes.length > 0;

  /**
   * `busquedaDestino` deja el término aplicado en la tienda en vez de limpiarlo.
   * Es lo que hace que "resaltar un producto" siga funcionando ahora que el
   * catálogo se pagina: filtrado por su nombre, el producto cae en la primera
   * tanda y el hook de resaltado lo encuentra en pantalla.
   */
  function ir(ruta: string, params?: Record<string, string>, busquedaDestino?: string) {
    const query = new URLSearchParams(params).toString();
    const destino = query ? `${ruta}?${query}` : ruta;
    onBuscar(busquedaDestino ?? "");
    setAbierto(false);
    onNavegar?.();
    if (location.pathname === ruta) {
      // Ya estamos en la página: forzamos replace para que el hook de resaltado se vuelva a disparar.
      navigate(destino, { replace: true });
    } else {
      navigate(destino);
    }
  }

  return (
    <div className="buscador-cont" ref={contRef}>
      <div className="buscador">
        <Search size={17} />
        <input
          ref={inputRef}
          type="search"
          placeholder="Buscar productos, categorías, páginas..."
          value={busqueda}
          onChange={(e) => {
            onBuscar(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
        />
        {atajoTeclado && <span className="buscador-atajo">Ctrl K</span>}
      </div>

      {abierto && q.length >= 2 && (
        <div className="buscador-resultados">
          {!hayResultados ? (
            <div className="buscador-vacio">Sin resultados para "{busqueda.trim()}"</div>
          ) : (
            <>
              {productos.length > 0 && (
                <div className="buscador-grupo">
                  <span className="buscador-grupo-titulo">Productos</span>
                  {productos.map((p) => (
                    <button
                      key={`p-${p.id}`}
                      type="button"
                      className="buscador-item"
                      onClick={() =>
                        ir(
                          "/tienda",
                          { resaltar: `producto-${p.id}` },
                          p.nombre_producto
                        )
                      }
                    >
                      <span className="buscador-item-nombre">{p.nombre_producto}</span>
                      <span className="buscador-item-meta">{p.categoria_nombre}</span>
                    </button>
                  ))}
                </div>
              )}

              {categoriasCoincidentes.length > 0 && (
                <div className="buscador-grupo">
                  <span className="buscador-grupo-titulo">Categorías</span>
                  {categoriasCoincidentes.map((c) => (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      className="buscador-item"
                      onClick={() => ir("/tienda", { categoria: String(c.id) })}
                    >
                      <span className="buscador-item-nombre">{c.nombre_categoria}</span>
                    </button>
                  ))}
                </div>
              )}

              {paginasCoincidentes.length > 0 && (
                <div className="buscador-grupo">
                  <span className="buscador-grupo-titulo">Páginas</span>
                  {paginasCoincidentes.map((p) => (
                    <button
                      key={`pg-${p.ruta}-${p.resaltar ?? ""}`}
                      type="button"
                      className="buscador-item"
                      onClick={() =>
                        ir(p.ruta, p.resaltar ? { resaltar: p.resaltar } : undefined)
                      }
                    >
                      <span className="buscador-item-nombre">{p.titulo}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
