from rest_framework.routers import DefaultRouter

from .views import MensajeContactoViewSet, SuscriptorViewSet

router = DefaultRouter()
router.register(r"messages", MensajeContactoViewSet, basename="contact-messages")
router.register(r"subscribers", SuscriptorViewSet, basename="contact-subscribers")

urlpatterns = router.urls
