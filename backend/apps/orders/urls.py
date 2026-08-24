from django.urls import path
from rest_framework.routers import DefaultRouter

from .pdf import GenerarPdfPedidoView, GenerarPdfPedidosLoteView
from .stats import ReporteVentasView, ResumenEstadisticasView
from .views import (
    ClienteViewSet,
    LoteViewSet,
    PedidoViewSet,
    ProductoPendienteViewSet,
    ProductosMasVendidosView,
)

router = DefaultRouter()
router.register(r"orders", PedidoViewSet, basename="pedidos")
router.register(r"clients", ClienteViewSet, basename="clientes")
router.register(r"orders-lotes", LoteViewSet, basename="lotes")
router.register(
    r"orders-productos-pendientes", ProductoPendienteViewSet, basename="productos-pendientes"
)

urlpatterns = [
    path("admin/stats/", ResumenEstadisticasView.as_view(), name="admin-stats"),
    path(
        "admin/stats/reporte/",
        ReporteVentasView.as_view(),
        name="admin-stats-reporte",
    ),
    path(
        "orders/productos-mas-vendidos/",
        ProductosMasVendidosView.as_view(),
        name="productos-mas-vendidos",
    ),
    path("orders/pdf-lote/", GenerarPdfPedidosLoteView.as_view(), name="pedidos-pdf-lote"),
    path("orders/<int:pk>/pdf/", GenerarPdfPedidoView.as_view(), name="pedido-pdf"),
]

urlpatterns += router.urls
