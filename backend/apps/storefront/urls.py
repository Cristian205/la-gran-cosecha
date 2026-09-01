"""
Las rutas del motor, repartidas por quién las llama.

El prefijo importa tanto como la vista: `/storefront/` lo consume el servidor
de Next sin sesión, `/content/` lo consume el panel del negocio y
`/platform/` el Control Center de Crynex. Mezclarlas haría que un permiso mal
puesto pasara desapercibido.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdoptarPlantillaView,
    BloqueViewSet,
    CatalogoDeBloquesView,
    PaginaPublicaView,
    PaginaViewSet,
    PlantillaViewSet,
    RutasPublicasView,
    TemaViewSet,
    TokenTemaViewSet,
)

# --- la tienda pública -------------------------------------------------
publicas = [
    path("pagina/", PaginaPublicaView.as_view(), name="storefront-pagina"),
    path("rutas/", RutasPublicasView.as_view(), name="storefront-rutas"),
]

# --- el panel del negocio ----------------------------------------------
router_negocio = DefaultRouter()
router_negocio.register(r"paginas", PaginaViewSet, basename="storefront-paginas")

del_negocio = [
    path("constructor/", CatalogoDeBloquesView.as_view(), name="storefront-constructor"),
    path("adoptar-plantilla/", AdoptarPlantillaView.as_view(), name="storefront-adoptar"),
    *router_negocio.urls,
]

# --- el Control Center -------------------------------------------------
router_plataforma = DefaultRouter()
router_plataforma.register(r"blocks", BloqueViewSet, basename="platform-blocks")
router_plataforma.register(r"themes", TemaViewSet, basename="platform-themes")
router_plataforma.register(
    r"theme-tokens", TokenTemaViewSet, basename="platform-theme-tokens"
)
router_plataforma.register(r"templates", PlantillaViewSet, basename="platform-templates")

de_plataforma = router_plataforma.urls
