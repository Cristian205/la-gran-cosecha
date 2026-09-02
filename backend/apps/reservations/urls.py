from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ConfiguracionReservasView, RecursoViewSet, ReservaViewSet

router = DefaultRouter()
router.register(r"reservas/recursos", RecursoViewSet, basename="reservas-recursos")
router.register(r"reservas/reservas", ReservaViewSet, basename="reservas-reservas")

urlpatterns = [
    path(
        "reservas/configuracion/",
        ConfiguracionReservasView.as_view(),
        name="reservas-configuracion",
    ),
    *router.urls,
]
