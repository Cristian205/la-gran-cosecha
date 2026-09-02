from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ConfiguracionPOSView, MedioPagoViewSet, TurnoViewSet, VentaViewSet

router = DefaultRouter()
router.register(r"pos/turnos", TurnoViewSet, basename="pos-turnos")
router.register(r"pos/ventas", VentaViewSet, basename="pos-ventas")
router.register(r"pos/medios-pago", MedioPagoViewSet, basename="pos-medios")

urlpatterns = [
    path("pos/configuracion/", ConfiguracionPOSView.as_view(), name="pos-configuracion"),
    *router.urls,
]
