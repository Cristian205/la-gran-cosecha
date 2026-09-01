from rest_framework.routers import DefaultRouter

from .views import ExistenciaViewSet, MovimientoViewSet, UbicacionViewSet

router = DefaultRouter()
router.register(r"inventory/locations", UbicacionViewSet, basename="ubicaciones")
router.register(r"inventory/stock", ExistenciaViewSet, basename="existencias")
router.register(r"inventory/movements", MovimientoViewSet, basename="movimientos")

urlpatterns = router.urls
