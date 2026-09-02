import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute, RequierePermiso } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { BusinessProfilePage } from "./pages/business/BusinessProfilePage";
import { ClientsPage } from "./pages/ClientsPage";
import { ContentPage } from "./pages/content/ContentPage";
import { TiendaPage } from "./pages/tienda/TiendaPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HelpPage } from "./pages/HelpPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrdersPage } from "./pages/orders/OrdersPage";
import { PendingProductsPage } from "./pages/PendingProductsPage";
import { PosPage } from "./pages/pos/PosPage";
import { ReservationsPage } from "./pages/reservations/ReservationsPage";
import { ProductsPage } from "./pages/products/ProductsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/productos"
            element={
              <RequierePermiso permiso="catalog.view_producto">
                <ProductsPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/inventario"
            element={
              <RequierePermiso permiso="inventory.view_existencia">
                <InventoryPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/caja"
            element={
              <RequierePermiso permiso="pos.add_venta">
                <PosPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/reservas"
            element={
              <RequierePermiso permiso="reservations.view_reserva">
                <ReservationsPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/pedidos"
            element={
              <RequierePermiso permiso="orders.view_pedido">
                <OrdersPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/productos-pendientes"
            element={
              <RequierePermiso permiso="orders.view_pedido">
                <PendingProductsPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/clientes"
            element={
              <RequierePermiso permiso="orders.view_cliente">
                <ClientsPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequierePermiso permiso="accounts.view_usuario">
                <UsersPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/contenido"
            element={
              <RequierePermiso permiso="content.view_promobanner">
                <ContentPage />
              </RequierePermiso>
            }
          />
          <Route
            path="/tienda"
            element={
              <RequierePermiso permiso="content.view_promobanner">
                <TiendaPage />
              </RequierePermiso>
            }
          />
          {/* El perfil del NEGOCIO, no el de la persona. Sin permiso
              propio: todo el equipo lo ve; solo el dueno lo cambia, y eso
              lo decide la vista. */}
          <Route path="/negocio" element={<BusinessProfilePage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/ayuda" element={<HelpPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
