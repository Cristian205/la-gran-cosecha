/**
 * Las respuestas de `/admin/analitica/*` tal como las devuelve el backend
 * (`apps/orders/analitica.py`, donde están también las definiciones de cada
 * métrica). Cualquier `null` significa «no hay base para calcularlo» —sin
 * pedidos entregados no hay ticket; sin comparar no hay anterior—, nunca cero.
 */
import type { EstadoPedido } from "../../types";

export type Granularidad = "hora" | "dia" | "semana" | "mes";

export interface PeriodoRespuesta {
  desde: string;
  hasta: string;
  dias: number;
  granularidad: Granularidad;
  /** `null` cuando no se pidió comparar. */
  anterior: { desde: string; hasta: string; hasta_hora: string | null } | null;
}

export interface ConPeriodo {
  periodo: PeriodoRespuesta;
  generado_en: string;
}

export interface Resumen extends ConPeriodo {
  ventas: { total: number; entregados: number; serie: number[] };
  pedidos: { total: number; por_estado: Record<EstadoPedido, number>; serie: number[] };
  ticket: { promedio: number | null; serie: (number | null)[] };
  clientes: { activos: number; nuevos: number; recurrentes: number; serie: number[] };
  anterior: { ventas: number; pedidos: number; ticket: number | null; clientes_activos: number } | null;
}

export interface Metricas {
  ventas: number;
  pedidos: number;
  ticket: number | null;
}

export interface PuntoVentas extends Metricas {
  inicio: string;
  anterior?: Metricas;
}

export interface AnalisisVentas extends ConPeriodo {
  serie: PuntoVentas[];
  totales: Metricas;
  anterior: Metricas | null;
  indicadores: {
    promedio_diario: number;
    dias_transcurridos: number;
    dia_mayor_facturacion: { fecha: string; ventas: number; pedidos: number } | null;
    mejor_dia_semana: { dia: string; promedio: number } | null;
  };
}

export interface AnaliticaClientes extends ConPeriodo {
  registrados: number;
  nuevos_registro: number;
  activos: number;
  nuevos_compra: number;
  recurrentes: number;
  con_compras: number;
  inactivos: number;
  dias_inactividad: number;
  evolucion: { inicio: string; primera_compra: number; registro: number }[];
  frecuencia: { clave: string; etiqueta: string; clientes: number }[];
  anterior: { activos: number; nuevos_compra: number; recurrentes: number; nuevos_registro: number } | null;
}

export type OrdenProductos = "ingresos" | "cantidad" | "frecuencia";

export interface ProductoRanking {
  posicion: number;
  clave: string;
  /** `null` en los productos escritos a mano en un pedido. */
  producto_id: number | null;
  nombre: string;
  imagen: string | null;
  categoria: string;
  ingresos: number;
  participacion: number;
  frecuencia: number;
  /** La cantidad principal: convertida a la unidad base, o la de su presentación más vendida. */
  cantidad: { valor: number; unidad: string; convertida: boolean };
  desglose: { presentacion: string; unidad: string; cantidad: number }[];
}

export interface RankingProductos extends ConPeriodo {
  orden: OrdenProductos;
  categoria: number | null;
  ingresos_totales: number;
  total_productos: number;
  productos: ProductoRanking[];
}

export interface CategoriaVentas {
  /** `null` = líneas sin categoría (escritas a mano). */
  id: number | null;
  nombre: string;
  ingresos: number;
  pedidos: number;
  participacion: number;
  anterior: number | null;
}

export interface VentasCategoria extends ConPeriodo {
  total: number;
  categorias: CategoriaVentas[];
}

export type EstadoAbierto = "PENDIENTE" | "EDITADO" | "CERRADO" | "IMPRESO";

export interface ResumenOperativo extends ConPeriodo {
  recibidos: number;
  por_estado: Record<EstadoPedido, number>;
  cumplimiento: number | null;
  abiertos: Record<EstadoAbierto, number>;
  entregados_hoy: number;
}

export interface ClientesDestacados extends ConPeriodo {
  ventas_periodo: number;
  clientes: { id: number; nombre: string; pedidos: number; total: number; participacion: number | null }[];
}

export interface PedidoReciente {
  id: number;
  cliente: string;
  cliente_id: number | null;
  estado: EstadoPedido;
  fecha: string;
  total: number;
  num_items: number;
}

export interface ActividadReciente extends ConPeriodo {
  hay_mas: boolean;
  pedidos: PedidoReciente[];
}

/** Lo que cada módulo devuelve, por nombre de endpoint. */
export interface Modulos {
  resumen: Resumen;
  ventas: AnalisisVentas;
  clientes: AnaliticaClientes;
  productos: RankingProductos;
  categorias: VentasCategoria;
  operacion: ResumenOperativo;
  "clientes-destacados": ClientesDestacados;
  recientes: ActividadReciente;
}

export type NombreModulo = keyof Modulos;
