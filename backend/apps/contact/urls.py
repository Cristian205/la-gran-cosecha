from rest_framework.routers import DefaultRouter

from .views import MensajeContactoViewSet

router = DefaultRouter()
router.register(r"messages", MensajeContactoViewSet, basename="contact-messages")

urlpatterns = router.urls
