from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConfiguracionEnviosView,
    EnvioViewSet,
    RepartidorViewSet,
    ZonaViewSet,
)

router = DefaultRouter()
router.register(r"domicilios/zonas", ZonaViewSet, basename="domicilios-zonas")
router.register(
    r"domicilios/repartidores", RepartidorViewSet, basename="domicilios-repartidores"
)
router.register(r"domicilios/envios", EnvioViewSet, basename="domicilios-envios")

urlpatterns = [
    path(
        "domicilios/configuracion/",
        ConfiguracionEnviosView.as_view(),
        name="domicilios-configuracion",
    ),
    *router.urls,
]
