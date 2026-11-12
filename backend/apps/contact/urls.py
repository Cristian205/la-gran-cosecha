from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MensajeContactoViewSet, SolicitudComercialView, SuscriptorViewSet

router = DefaultRouter()
router.register(r"messages", MensajeContactoViewSet, basename="contact-messages")
router.register(r"subscribers", SuscriptorViewSet, basename="contact-subscribers")

urlpatterns = router.urls + [
    path("solicitudes-comerciales/", SolicitudComercialView.as_view(), name="solicitud-comercial"),
]
