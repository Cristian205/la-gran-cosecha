"""
Las rutas del perfil, repartidas por quien las llama.

Mismo criterio que el motor de tiendas: `/business/` lo consume el panel del
negocio y `/platform/` el de Crynex. El prefijo importa tanto como la vista,
porque es lo que hace que un permiso mal puesto se note al leer la URL.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdoptarPresetView,
    AltaGuiadaView,
    ModulosView,
    PerfilNegocioView,
    PresetViewSet,
)

# --- el panel del negocio ----------------------------------------------
del_negocio = [
    path("perfil/", PerfilNegocioView.as_view(), name="business-perfil"),
    path("modulos/", ModulosView.as_view(), name="business-modulos"),
    path("alta/", AltaGuiadaView.as_view(), name="business-alta"),
    path("alta/adoptar/", AdoptarPresetView.as_view(), name="business-adoptar"),
]

# --- el Control Center -------------------------------------------------
router_plataforma = DefaultRouter()
router_plataforma.register(r"presets", PresetViewSet, basename="platform-presets")

de_plataforma = router_plataforma.urls
