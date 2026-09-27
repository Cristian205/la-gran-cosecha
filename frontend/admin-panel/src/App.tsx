import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute, RequierePermiso } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
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
import { DeliveryPage } from "./pages/delivery/DeliveryPage";
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
            path="/domicilios"
            element={
              <RequierePermiso permiso="delivery.view_envio">
                <DeliveryPage />
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
          {/* Configuración del negocio y de su tienda. Sin permiso propio:
              «Tu negocio» lo ve todo el equipo, y cada pestaña de contenido
              pide el suyo dentro de la página. */}
          <Route path="/contenido" element={<ContentPage />} />
          <Route
            path="/tienda"
            element={
              <RequierePermiso permiso="content.view_promobanner">
                <TiendaPage />
              </RequierePermiso>
            }
          />
          {/* «Tu negocio» ahora es una pestaña de Configuración. */}
          <Route path="/negocio" element={<Navigate to="/contenido?pestana=negocio" replace />} />
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
