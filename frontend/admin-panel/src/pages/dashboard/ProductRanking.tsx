import { PackageSearch } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { formatoPrecio } from "../../utils";
import { EmptyState, ErrorState, LoadingState, Tarjeta } from "./estados";
import type { EstadoPanel } from "./usePanel";

/**
 * Lo que más se mueve, en una lista con barra proporcional (no una tarjeta
 * por producto).
 *
 * - Productos: en CUÁNTOS pedidos del período aparece cada uno. Sumar
 *   cantidades mezclaría libras con bultos; contar pedidos no.
 * - Categorías: cuánto se vendió de cada una (pedidos entregados).
 */
type Vista = "productos" | "categorias";

export function ProductRanking({ estado, onReintentar }: { estado: EstadoPanel; onReintentar: () => void }) {
  const [vista, setVista] = useState<Vista>("productos");

  const pestañas = (
    <div className="db-pestanas" role="tablist" aria-label="Ranking">
      {(
        [
          ["productos", "Productos"],
          ["categorias", "Categorías"],
        ] as const
      ).map(([valor, texto]) => (
        <button
          key={valor}
          type="button"
          role="tab"
          aria-selected={vista === valor}
          className={vista === valor ? "activo" : ""}
          onClick={() => setVista(valor)}
        >
          {texto}
        </button>
      ))}
    </div>
  );

  let cuerpo;
  if (estado.tipo === "cargando") cuerpo = <LoadingState filas={6} />;
  else if (estado.tipo === "error")
    cuerpo = <ErrorState mensaje="No pudimos cargar el ranking." onReintentar={onReintentar} />;
  else {
    const filas =
      vista === "productos"
        ? estado.datos.productos.map((p) => ({
            nombre: p.nombre,
            valor: p.pedidos,
            texto: `${p.pedidos} ${p.pedidos === 1 ? "pedido" : "pedidos"}`,
            titulo: `${formatoPrecio(p.total)} en esos pedidos`,
          }))
        : estado.datos.categorias.map((c) => ({
            nombre: c.categoria,
            valor: c.total,
            texto: formatoPrecio(c.total),
            titulo: undefined,
          }));
    const maximo = Math.max(...filas.map((f) => f.valor), 1);

    cuerpo =
      filas.length === 0 ? (
        <EmptyState
          icono={PackageSearch}
          titulo={vista === "productos" ? "Sin pedidos en el período" : "Sin ventas en el período"}
          texto={
            vista === "productos"
              ? "Aquí verás qué productos piden más tus clientes."
              : "Aquí verás qué categorías venden más."
          }
        />
      ) : (
        <ol className="db-ranking" role="tabpanel">
          {filas.map((f, i) => (
            <li key={f.nombre} style={{ "--i": i } as CSSProperties} title={f.titulo}>
              <span className="db-ranking-pos">{String(i + 1).padStart(2, "0")}</span>
              <span className="db-ranking-nombre">{f.nombre}</span>
              <span className="db-ranking-valor">{f.texto}</span>
              <span className="db-ranking-barra" aria-hidden="true">
                <span style={{ transform: `scaleX(${f.valor / maximo})` }} />
              </span>
            </li>
          ))}
        </ol>
      );
  }

  return (
    <Tarjeta
      titulo={vista === "productos" ? "Productos más solicitados" : "Ventas por categoría"}
      accion={pestañas}
      className="db-ranking-tarjeta"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      {cuerpo}
    </Tarjeta>
  );
}
