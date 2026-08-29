from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    NegocioViewSet,
    PermisoDisponibleViewSet,
    PlanViewSet,
    ResumenPlataformaView,
    SubscriptionViewSet,
)

router = DefaultRouter()
router.register(r"tenants", NegocioViewSet, basename="platform-tenants")
router.register(r"plans", PlanViewSet, basename="platform-plans")
router.register(r"permissions", PermisoDisponibleViewSet, basename="platform-permissions")
router.register(r"subscriptions", SubscriptionViewSet, basename="platform-subscriptions")

urlpatterns = [path("resumen/", ResumenPlataformaView.as_view(), name="platform-resumen")]
urlpatterns += router.urls
