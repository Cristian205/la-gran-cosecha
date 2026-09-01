from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CaracteristicaViewSet,
    NegocioViewSet,
    PermisoDisponibleViewSet,
    PlanViewSet,
    PrecioPlanViewSet,
    ProductoViewSet,
    ResumenPlataformaView,
    SubscriptionViewSet,
    TipoLimiteViewSet,
)

router = DefaultRouter()
# Clientes y contratos.
router.register(r"tenants", NegocioViewSet, basename="platform-tenants")
router.register(r"subscriptions", SubscriptionViewSet, basename="platform-subscriptions")
# Catálogo comercial.
router.register(r"products", ProductoViewSet, basename="platform-products")
router.register(r"features", CaracteristicaViewSet, basename="platform-features")
router.register(r"limit-types", TipoLimiteViewSet, basename="platform-limit-types")
router.register(r"plans", PlanViewSet, basename="platform-plans")
router.register(r"prices", PrecioPlanViewSet, basename="platform-prices")
router.register(r"permissions", PermisoDisponibleViewSet, basename="platform-permissions")

urlpatterns = [path("resumen/", ResumenPlataformaView.as_view(), name="platform-resumen")]
urlpatterns += router.urls
