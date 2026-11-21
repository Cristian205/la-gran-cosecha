from rest_framework.routers import DefaultRouter

from .views import FurgonViewSet, PlanoCargaViewSet, TipoCanastillaViewSet
from .views_lotes import LoteDespachoViewSet
from .views_planificacion import (
    AjusteRutaViewSet,
    PlanificacionViewSet,
    ProgramacionSemanalViewSet,
    ReglaCargaViewSet,
    RutaViewSet,
)

router = DefaultRouter()
router.register(r"logistica/furgones", FurgonViewSet, basename="logistica-furgones")
router.register(r"logistica/canastillas", TipoCanastillaViewSet, basename="logistica-canastillas")
router.register(r"logistica/planos", PlanoCargaViewSet, basename="logistica-planos")
router.register(r"logistica/programaciones", ProgramacionSemanalViewSet, basename="logistica-programaciones")
router.register(r"logistica/rutas", RutaViewSet, basename="logistica-rutas")
router.register(r"logistica/ajustes-ruta", AjusteRutaViewSet, basename="logistica-ajustes-ruta")
router.register(r"logistica/reglas-carga", ReglaCargaViewSet, basename="logistica-reglas-carga")
router.register(r"logistica/planificacion", PlanificacionViewSet, basename="logistica-planificacion")
router.register(r"logistica/lotes", LoteDespachoViewSet, basename="logistica-lotes")

urlpatterns = router.urls
