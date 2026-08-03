from rest_framework.routers import DefaultRouter

from .views import ArchivoViewSet

router = DefaultRouter()
router.register(r"archivos", ArchivoViewSet, basename="archivos")

urlpatterns = router.urls
