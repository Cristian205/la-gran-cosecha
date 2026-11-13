from django.urls import path
from rest_framework.routers import DefaultRouter

from .pdf import GenerarPdfPedidosLoteView, GenerarPdfPedidoView, VistaPreviaFacturaView
from .stats import PanelEstadisticasView, ReporteVentasView, ResumenEstadisticasView
from .vistas_analitica import (
    ActividadRecienteView,
    AnaliticaClientesView,
    ClientesDestacadosView,
    EvolucionVentasView,
    RankingProductosView,
    ResumenEjecutivoView,
    ResumenOperativoView,
    VentasPorCategoriaView,
)
from .views import (
    ClienteViewSet,
    LoteViewSet,
    PedidoViewSet,
    ProductoPendienteViewSet,
    ProductosMasVendidosView,
)
from .vistas_tienda import ConsultarClienteView, HistorialClienteView

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
    path("admin/stats/panel/", PanelEstadisticasView.as_view(), name="admin-stats-panel"),
    # El dashboard ejecutivo: un endpoint por módulo (ver `vistas_analitica.py`).
    path("admin/analitica/resumen/", ResumenEjecutivoView.as_view(), name="analitica-resumen"),
    path("admin/analitica/ventas/", EvolucionVentasView.as_view(), name="analitica-ventas"),
    path("admin/analitica/clientes/", AnaliticaClientesView.as_view(), name="analitica-clientes"),
    path("admin/analitica/productos/", RankingProductosView.as_view(), name="analitica-productos"),
    path("admin/analitica/categorias/", VentasPorCategoriaView.as_view(), name="analitica-categorias"),
    path("admin/analitica/operacion/", ResumenOperativoView.as_view(), name="analitica-operacion"),
    path(
        "admin/analitica/clientes-destacados/",
        ClientesDestacadosView.as_view(),
        name="analitica-clientes-destacados",
    ),
    path("admin/analitica/recientes/", ActividadRecienteView.as_view(), name="analitica-recientes"),
    path(
        "orders/productos-mas-vendidos/",
        ProductosMasVendidosView.as_view(),
        name="productos-mas-vendidos",
    ),
    path("orders/pdf-lote/", GenerarPdfPedidosLoteView.as_view(), name="pedidos-pdf-lote"),
    path("orders/factura/vista-previa/", VistaPreviaFacturaView.as_view(), name="factura-vista-previa"),
    # La tienda pública, para el cliente que se identifica con su cédula.
    path("orders-cliente/consultar/", ConsultarClienteView.as_view(), name="cliente-tienda-consultar"),
    path("orders-cliente/historial/", HistorialClienteView.as_view(), name="cliente-tienda-historial"),
    path("orders/<int:pk>/pdf/", GenerarPdfPedidoView.as_view(), name="pedido-pdf"),
]

urlpatterns += router.urls
