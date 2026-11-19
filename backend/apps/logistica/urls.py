from rest_framework.routers import DefaultRouter

from .views import FurgonViewSet, PlanoCargaViewSet, TipoCanastillaViewSet

router = DefaultRouter()
router.register(r"logistica/furgones", FurgonViewSet, basename="logistica-furgones")
router.register(r"logistica/canastillas", TipoCanastillaViewSet, basename="logistica-canastillas")
router.register(r"logistica/planos", PlanoCargaViewSet, basename="logistica-planos")

urlpatterns = router.urls
