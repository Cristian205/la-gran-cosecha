import { Shapes } from "lucide-react";
import type { CSSProperties } from "react";
import { CuerpoModulo, EmptyState, Tarjeta } from "./estados";
import { formatoPrecio, numero, porcentaje, variacion } from "./formato";
import { referenciaAnterior } from "./periodo";
import type { CategoriaElegida } from "./TopProducts";
import type { VentasCategoria } from "./tipos";
import { useModulo } from "./useModulo";
import { VariacionChip } from "./Variacion";

/**
 * Ventas por categoría: barras horizontales (la forma más rápida de comparar
 * magnitudes), cada una con su participación y su variación. Elegir una
 * categoría filtra el ranking de productos.
 */
export function CategorySalesChart({
  seleccionada,
  onSeleccionar,
}: {
  seleccionada: CategoriaElegida | null;
  onSeleccionar: (c: CategoriaElegida | null) => void;
}) {
  const { estado, recargar } = useModulo("categorias");
  return (
    <Tarjeta
      titulo="Ventas por categoría"
      subtitulo="Elige una categoría para ver sus productos"
      info="Ingresos de los pedidos ENTREGADOS por la categoría actual de cada producto. «Pedidos» cuenta en cuántos pedidos aparece al menos un producto de la categoría."
      className="db-categorias"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      <CuerpoModulo estado={estado} filas={6} error="No pudimos cargar las categorías." onReintentar={recargar}>
        {(d) => <Lista datos={d} seleccionada={seleccionada} onSeleccionar={onSeleccionar} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function Lista({
  datos,
  seleccionada,
  onSeleccionar,
}: {
  datos: VentasCategoria;
  seleccionada: CategoriaElegida | null;
  onSeleccionar: (c: CategoriaElegida | null) => void;
}) {
  if (datos.categorias.length === 0)
    return <EmptyState icono={Shapes} titulo="Sin ventas en el período" texto="Aquí verás qué categorías generan más ingresos." />;
  const max = Math.max(...datos.categorias.map((c) => c.ingresos), 1);
  const ref = referenciaAnterior(datos.periodo);

  return (
    <ul className="db-cats">
      {datos.categorias.map((c, i) => {
        const activa = seleccionada?.id === c.id && c.id !== null;
        const contenido = (
          <>
            <span className="db-cats-cabeza">
              <span className="db-cats-nombre">{c.nombre}</span>
              <span className="db-cats-valor">{formatoPrecio(c.ingresos)}</span>
            </span>
            <span className="db-cats-pista" aria-hidden="true">
              <span style={{ transform: `scaleX(${c.ingresos / max})` }} />
            </span>
            <span className="db-cats-pie">
              <span>
                {porcentaje(c.participacion)} · {numero(c.pedidos)} {c.pedidos === 1 ? "pedido" : "pedidos"}
              </span>
              <VariacionChip variacion={variacion(c.ingresos, c.anterior === null ? undefined : c.anterior, formatoPrecio)} referencia={null} compacta />
            </span>
          </>
        );
        return (
          <li key={c.id ?? "sin"} style={{ "--i": i } as CSSProperties}>
            {c.id === null ? (
              <div className="db-cats-fila db-cats-fila--fija" title="Productos escritos a mano sin categoría">
                {contenido}
              </div>
            ) : (
              <button
                type="button"
                className={`db-cats-fila ${activa ? "activa" : ""}`}
                aria-pressed={activa}
                onClick={() => onSeleccionar(activa ? null : { id: c.id!, nombre: c.nombre })}
                title={ref ? `Variación ${ref}` : undefined}
              >
                {contenido}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
