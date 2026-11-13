import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { tienePermiso } from "../utils";
import { CategorySalesChart } from "./dashboard/CategorySalesChart";
import { CustomerAnalytics } from "./dashboard/CustomerAnalytics";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { FiltrosProvider } from "./dashboard/filtros";
import { OperationalSummary } from "./dashboard/OperationalSummary";
import { RecentOrders } from "./dashboard/RecentOrders";
import { ResumenEjecutivo } from "./dashboard/ResumenEjecutivo";
import { SalesOverviewChart } from "./dashboard/SalesOverviewChart";
import { TopCustomers } from "./dashboard/TopCustomers";
import { TopProducts, type CategoriaElegida } from "./dashboard/TopProducts";
import { OrderDetailModal } from "./orders/OrderDetailModal";
import "./dashboard/dashboard.css";

/**
 * Resumen del negocio: el centro de inteligencia comercial del panel.
 *
 * Orden de lectura (y de carga): filtros → KPI → ventas → clientes y
 * productos → operación → clientes destacados y actividad reciente.
 *
 * Cada módulo pide su propio endpoint (`/admin/analitica/<modulo>/`) con los
 * parámetros del filtro global (`dashboard/filtros.tsx`), así que carga, falla
 * y se reintenta por su cuenta. Los cálculos y sus definiciones están en el
 * backend (`apps/orders/analitica.py`); aquí solo se presentan.
 */
export function DashboardPage() {
  return (
    <FiltrosProvider>
      <Dashboard />
    </FiltrosProvider>
  );
}

function Dashboard() {
  const { usuario, negocioActivo } = useAuth();
  const [pedidoAbierto, setPedidoAbierto] = useState<number | null>(null);
  const [categoria, setCategoria] = useState<CategoriaElegida | null>(null);
  const [edicion, setEdicion] = useState(0);

  const u = usuario ?? null;
  const puedeVerPedidos = tienePermiso(u, "orders.view_pedido");
  const puedeVerClientes = tienePermiso(u, "orders.view_cliente");
  const puedeVerProductos = tienePermiso(u, "catalog.view_producto");

  return (
    <div className="db">
      <DashboardHeader negocio={negocioActivo?.nombre ?? null} />

      <ResumenEjecutivo puedeVerPedidos={puedeVerPedidos} puedeVerClientes={puedeVerClientes} />

      <div className="db-fila db-fila--ventas">
        <SalesOverviewChart puedeVerPedidos={puedeVerPedidos} />
        <OperationalSummary puedeVerPedidos={puedeVerPedidos} />
      </div>

      <CustomerAnalytics puedeVerClientes={puedeVerClientes} />

      <div className="db-fila db-fila--productos">
        <TopProducts
          categoria={categoria}
          onQuitarCategoria={() => setCategoria(null)}
          puedeVerProductos={puedeVerProductos}
        />
        <CategorySalesChart seleccionada={categoria} onSeleccionar={setCategoria} />
      </div>

      {(puedeVerClientes || puedeVerPedidos) && (
        <div className={`db-fila ${puedeVerClientes && puedeVerPedidos ? "db-fila--final" : ""}`}>
          {puedeVerClientes && <TopCustomers />}
          {puedeVerPedidos && <RecentOrders onVer={setPedidoAbierto} version={edicion} />}
        </div>
      )}

      {pedidoAbierto !== null && (
        <OrderDetailModal
          pedidoId={pedidoAbierto}
          soloLectura={!tienePermiso(u, "orders.change_pedido")}
          onCerrar={() => setPedidoAbierto(null)}
          onGuardado={() => {
            setPedidoAbierto(null);
            setEdicion((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
