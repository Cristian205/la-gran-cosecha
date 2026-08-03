from rest_framework.routers import DefaultRouter

from .views import (
    CategoriaViewSet,
    PresentacionProductoViewSet,
    ProductoViewSet,
    UnidadMedidaViewSet,
)

router = DefaultRouter()
router.register(r"catalog/categories", CategoriaViewSet, basename="categorias")
router.register(r"catalog/units", UnidadMedidaViewSet, basename="unidades")
router.register(r"catalog/products", ProductoViewSet, basename="productos")
router.register(
    r"catalog/presentations", PresentacionProductoViewSet, basename="presentaciones"
)

urlpatterns = router.urls
