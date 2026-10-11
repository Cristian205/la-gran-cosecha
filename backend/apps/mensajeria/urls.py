from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ConfiguracionView, ExclusionViewSet, MensajeViewSet, PlantillaViewSet, PruebaView
from .webhooks import webhook_meta, webhook_twilio

router = DefaultRouter()
router.register(r"plantillas", PlantillaViewSet, basename="whatsapp-plantillas")
router.register(r"mensajes", MensajeViewSet, basename="whatsapp-mensajes")
router.register(r"exclusiones", ExclusionViewSet, basename="whatsapp-exclusiones")

#: Panel del negocio: /api/whatsapp/...
del_negocio = [
    path("configuracion/", ConfiguracionView.as_view(), name="whatsapp-configuracion"),
    path("probar/", PruebaView.as_view(), name="whatsapp-probar"),
    *router.urls,
]

#: Llamados por Meta y Twilio: /api/webhooks/whatsapp/...
webhooks = [
    path("meta/", webhook_meta, name="whatsapp-webhook-meta"),
    path("twilio/", webhook_twilio, name="whatsapp-webhook-twilio"),
]
