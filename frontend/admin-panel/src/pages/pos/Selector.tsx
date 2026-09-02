import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Search } from "lucide-react";
import type { Busqueda, PerfilPOS } from "../../api/pos";
import type { Categoria, Presentacion, Producto } from "../../types";
import { formatoPrecio } from "../../utils";

interface Props {
  perfil: PerfilPOS;
  productos: Producto[];
  categorias: Categoria[];
  onElegir: (producto: Producto, presentacion: Presentacion) => void;
}

/**
 * La primera de las cuatro zonas del POS: cómo encuentra el cajero lo que vende.
 *
 * Es el mismo componente en todos los negocios. Lo único que cambia es
 * `perfil.busqueda`, y de ahí sale la diferencia entera entre una boutique y una
 * ferretería:
 *
 *   rejilla         tarjetas con foto — se vende lo que se ve
 *   categorias      lo mismo, agrupado — un menú, una frutería
 *   codigo_barras   un campo y un lector — trescientas referencias que el
 *                   cajero no distingue de vista
 *   lista           filas densas con buscador — catálogo grande, sin fotos
 *
 * No hay un POS por sector. Hay cuatro maneras de listar lo mismo.
 */
export function Selector({ perfil, productos, categorias, onElegir }: Props) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<number | "">("");
  const campo = useRef<HTMLInputElement>(null);

  // El lector de código de barras teclea y pulsa Enter. Si el foco no está en
  // el campo, lo que teclea se pierde — así que vuelve solo tras cada venta.
  useEffect(() => {
    if (perfil.busqueda === "codigo_barras") campo.current?.focus();
  }, [perfil.busqueda]);

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase();
    return productos.filter((p) => {
      if (categoria !== "" && p.categoria !== categoria) return false;
      if (!buscado) return true;
      return (
        p.nombre_producto.toLowerCase().includes(buscado) ||
        p.codigo_producto.toLowerCase().includes(buscado) ||
        (p.codigo_barras ?? "").toLowerCase().includes(buscado)
      );
    });
  }, [productos, texto, categoria]);

  /** La primera presentación activa. Con una sola, no se pregunta. */
  function elegir(producto: Producto) {
    const presentacion = producto.presentaciones[0];
    if (presentacion) onElegir(producto, presentacion);
  }

  function porCodigo(e: React.FormEvent) {
    e.preventDefault();
    const buscado = texto.trim().toLowerCase();
    if (!buscado) return;
    // Coincidencia exacta por código de barras primero: es lo que el lector
    // manda, y una búsqueda parcial elegiría el producto equivocado.
    const exacto =
      productos.find((p) => (p.codigo_barras ?? "").toLowerCase() === buscado) ??
      productos.find((p) => p.codigo_producto.toLowerCase() === buscado) ??
      filtrados[0];
    if (exacto) {
      elegir(exacto);
      setTexto("");
    }
  }

  const conFoto = perfil.muestra_imagenes;
  const modo: Busqueda = perfil.busqueda;

  return (
    <div className="panel caja-selector">
      {modo === "codigo_barras" ? (
        <form onSubmit={porCodigo} className="buscador" style={{ marginBottom: ".75rem" }}>
          <Barcode size={18} />
          <input
            ref={campo}
            placeholder="Escanea o escribe el código…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
          />
        </form>
      ) : (
        <div className="filtros-bar" style={{ marginBottom: ".75rem" }}>
          <div className="buscador">
            <Search size={16} />
            <input
              placeholder="Buscar producto…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          {modo === "categorias" && (
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="caja-lista">
        {filtrados.length === 0 ? (
          <p className="vacio">Sin productos que coincidan</p>
        ) : modo === "lista" || modo === "codigo_barras" ? (
          <table>
            <tbody>
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => elegir(p)}
                  style={{ cursor: "pointer" }}
                  title="Añadir a la venta"
                >
                  <td>
                    <strong>{p.nombre_producto}</strong>
                    <br />
                    <span className="pres-mas">
                      {p.codigo_barras || p.codigo_producto}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {p.precio_desde ? formatoPrecio(Number(p.precio_desde)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Cuantas caben y cuanto respiran lo deciden `--caja-columnas` y
             `--caja-densidad`, que llegan resueltas del servidor. */
          <div className="caja-rejilla">
            {filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegir(p)}
                className="caja-ficha"
              >
                {conFoto && (
                  <div className="caja-ficha-foto">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt=""
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                )}
                <div className="caja-ficha-cuerpo">
                  <div className="caja-ficha-nombre">{p.nombre_producto}</div>
                  <div className="pres-mas" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.precio_desde ? formatoPrecio(Number(p.precio_desde)) : "—"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
