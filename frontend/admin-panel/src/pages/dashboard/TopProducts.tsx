import { ArrowRight, PackageSearch, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CuerpoModulo, EmptyState, Tarjeta } from "./estados";
import { cantidad, formatoPrecio, numero, porcentaje } from "./formato";
import type { OrdenProductos, ProductoRanking, RankingProductos } from "./tipos";
import { useModulo } from "./useModulo";

/**
 * Productos más vendidos (solo pedidos ENTREGADOS), con sus presentaciones
 * agrupadas.
 *
 * Las cantidades no mezclan unidades: si el producto tiene unidad base, la
 * cantidad viene convertida (3 bultos de 50 kg + 20 kg = 170 kg); si no, se
 * muestra la de cada presentación por separado. Ver `ranking_productos` en
 * `apps/orders/analitica.py`.
 */
const ORDENES: { valor: OrdenProductos; etiqueta: string }[] = [
  { valor: "ingresos", etiqueta: "Facturación" },
  { valor: "cantidad", etiqueta: "Cantidad" },
  { valor: "frecuencia", etiqueta: "Frecuencia" },
];

export interface CategoriaElegida {
  id: number;
  nombre: string;
}

export function TopProducts({
  categoria,
  onQuitarCategoria,
  puedeVerProductos,
}: {
  categoria: CategoriaElegida | null;
  onQuitarCategoria: () => void;
  puedeVerProductos: boolean;
}) {
  const [orden, setOrden] = useState<OrdenProductos>("ingresos");
  const { estado, recargar } = useModulo("productos", { orden, limite: 10, categoria: categoria?.id });

  const selector = (
    <div className="db-segmentado db-segmentado--sm" role="radiogroup" aria-label="Ordenar productos por">
      {ORDENES.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={orden === o.valor}
          className={orden === o.valor ? "activo" : ""}
          onClick={() => setOrden(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );

  return (
    <Tarjeta
      titulo="Productos más vendidos"
      subtitulo={
        categoria ? (
          <span className="db-filtro-chip">
            {categoria.nombre}
            <button type="button" onClick={onQuitarCategoria} aria-label={`Quitar el filtro ${categoria.nombre}`}>
              <X size={12} />
            </button>
          </span>
        ) : (
          "Top 10 del período, todas las categorías"
        )
      }
      info="Calculado sobre pedidos ENTREGADOS. Frecuencia = en cuántos pedidos aparece. Ordenar por cantidad compara la cantidad principal de cada producto, siempre con su unidad."
      accion={selector}
      className="db-productos"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      <CuerpoModulo estado={estado} filas={8} error="No pudimos cargar el ranking." onReintentar={recargar}>
        {(d) => <Lista datos={d} orden={orden} puedeVerProductos={puedeVerProductos} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function valorDe(p: ProductoRanking, orden: OrdenProductos): number {
  if (orden === "cantidad") return p.cantidad.valor;
  if (orden === "frecuencia") return p.frecuencia;
  return p.ingresos;
}

function Lista({ datos, orden, puedeVerProductos }: { datos: RankingProductos; orden: OrdenProductos; puedeVerProductos: boolean }) {
  if (datos.productos.length === 0)
    return (
      <EmptyState
        icono={PackageSearch}
        titulo="Sin ventas en el período"
        texto="Aquí verás qué productos generan más ingresos cuando se entreguen pedidos."
      />
    );
  const max = Math.max(...datos.productos.map((p) => valorDe(p, orden)), 1);

  return (
    <>
      <ol className="db-ranking">
        {datos.productos.map((p, i) => {
          const principal =
            orden === "cantidad"
              ? `${cantidad(p.cantidad.valor)} ${p.cantidad.unidad}`
              : orden === "frecuencia"
                ? `${numero(p.frecuencia)} ${p.frecuencia === 1 ? "pedido" : "pedidos"}`
                : formatoPrecio(p.ingresos);
          const nombre =
            puedeVerProductos && p.producto_id !== null ? (
              <Link to={`/productos?q=${encodeURIComponent(p.nombre)}`} className="db-ranking-nombre">
                {p.nombre}
              </Link>
            ) : (
              <span className="db-ranking-nombre">{p.nombre}</span>
            );
          return (
            <li key={p.clave} style={{ "--i": i } as CSSProperties}>
              <span className="db-ranking-pos">{p.posicion}</span>
              <span className="db-ranking-img" aria-hidden="true">
                {p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : p.nombre.charAt(0).toUpperCase()}
              </span>
              <span className="db-ranking-texto">
                {nombre}
                <span className="db-ranking-meta">
                  {p.categoria} · <Cantidades p={p} />
                </span>
              </span>
              <span className="db-ranking-cifras">
                <strong>{principal}</strong>
                <span className="db-tenue">{porcentaje(p.participacion)} de ingresos</span>
              </span>
              <span className="db-ranking-barra" aria-hidden="true">
                <span style={{ transform: `scaleX(${valorDe(p, orden) / max})` }} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="db-nota">
        {datos.total_productos > datos.productos.length
          ? `${datos.productos.length} de ${datos.total_productos} productos vendidos · `
          : ""}
        Ingresos del período: {formatoPrecio(datos.ingresos_totales)}
        {puedeVerProductos && (
          <Link className="db-enlace" to="/productos">
            Ver catálogo <ArrowRight size={13} aria-hidden="true" />
          </Link>
        )}
      </p>
    </>
  );
}

/** "110 kg" si se pudo convertir; si no, "2 Canastilla · 10 Unidad". */
function Cantidades({ p }: { p: ProductoRanking }) {
  if (p.cantidad.convertida) {
    const detalle = p.desglose.map((d) => `${cantidad(d.cantidad)} × ${d.presentacion}`).join(" + ");
    return (
      <span title={detalle}>
        {cantidad(p.cantidad.valor)} {p.cantidad.unidad}
      </span>
    );
  }
  return <span>{p.desglose.map((d) => `${cantidad(d.cantidad)} ${d.presentacion === "Pedido a mano" ? d.unidad || "und" : d.presentacion}`).join(" · ")}</span>;
}
