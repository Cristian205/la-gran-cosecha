"""
La API del panel del negocio para WhatsApp: configurar, registrar
plantillas, ver qué se envió y probar.

Leer es de cualquier miembro del equipo; cambiar la configuración o las
plantillas es del dueño o administrador: un número de alertas cambiado por
error deja al negocio sin enterarse de sus pedidos.
"""
from django.conf import settings
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import EsAdministrador, EsStaff
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from . import servicio
from .eventos import EVENTOS
from .models import ConfiguracionWhatsApp, ExclusionWhatsApp, MensajeWhatsApp, PlantillaWhatsApp
from .serializers import ConfiguracionSerializer, ExclusionSerializer, MensajeSerializer, PlantillaSerializer

#: Valores de ejemplo para el envío de prueba de cada variable.
EJEMPLOS = {
    "cliente": "María",
    "pedido": "1234",
    "total": "$85.000",
    "negocio": "la tienda",
    "repartidor": "Carlos",
    "motivo": "Consulta",
    "telefono": "3001234567",
    "nota": "No había quién recibiera",
    "titulo": "Prueba",
    "detalle": "Este es un mensaje de prueba del sistema",
}


class EscrituraDeAdministrador:
    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [EsStaff()]
        return [EsAdministrador()]


def _credenciales() -> dict:
    """Qué tiene configurado la PLATAFORMA (sin revelar ningún secreto)."""
    return {
        "meta": bool(getattr(settings, "META_WHATSAPP_TOKEN", "")),
        "meta_webhook": bool(getattr(settings, "META_APP_SECRET", "") and getattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "")),
        "twilio": bool(getattr(settings, "TWILIO_ACCOUNT_SID", "") and getattr(settings, "TWILIO_AUTH_TOKEN", "")),
    }


class ConfiguracionView(ExigeNegocioMixin, EscrituraDeAdministrador, APIView):
    def _config(self, request):
        config, _ = ConfiguracionWhatsApp.objects.get_or_create(tenant=request.tenant)
        return config

    def _respuesta(self, config):
        return {
            **ConfiguracionSerializer(config).data,
            "credenciales_plataforma": _credenciales(),
            "eventos": [
                {"codigo": codigo, **{k: v for k, v in datos.items() if k != "disparador"}}
                for codigo, datos in EVENTOS.items()
            ],
        }

    def get(self, request):
        return Response(self._respuesta(self._config(request)))

    def patch(self, request):
        config = self._config(request)
        serializer = ConfiguracionSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self._respuesta(config))


class PlantillaViewSet(TenantScopedMixin, EscrituraDeAdministrador, viewsets.ModelViewSet):
    modelo = PlantillaWhatsApp
    serializer_class = PlantillaSerializer

    @action(detail=False, methods=["post"])
    def sugeridas(self, request):
        """
        Crea una plantilla por cada evento que aún no la tenga, con el texto y
        el nombre sugeridos. El nombre en Meta se deja propuesto; el ContentSid
        de Twilio, vacío: lo da Twilio al registrar la plantilla allí.
        """
        existentes = set(PlantillaWhatsApp.objects.values_list("evento", flat=True))
        creadas = [
            PlantillaWhatsApp.objects.create(
                tenant=request.tenant,
                evento=codigo,
                meta_nombre=codigo.lower(),
                cuerpo=datos["texto"],
            )
            for codigo, datos in EVENTOS.items()
            if codigo not in existentes
        ]
        return Response(PlantillaSerializer(creadas, many=True).data, status=status.HTTP_201_CREATED)


class MensajeViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    modelo = MensajeWhatsApp
    serializer_class = MensajeSerializer
    permission_classes = [EsStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        for campo in ("estado", "evento", "pedido_id"):
            valor = self.request.query_params.get(campo)
            if valor:
                qs = qs.filter(**{campo: valor})
        return qs

    @action(detail=True, methods=["post"])
    def reintentar(self, request, pk=None):
        mensaje = self.get_object()
        if mensaje.estado not in (MensajeWhatsApp.Estado.FALLIDO, MensajeWhatsApp.Estado.OMITIDO):
            return Response({"detail": "Solo se reintentan mensajes fallidos u omitidos."}, status=400)
        servicio.reintentar(mensaje)
        return Response(MensajeSerializer(mensaje).data)


class ExclusionViewSet(
    TenantScopedMixin,
    EscrituraDeAdministrador,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    modelo = ExclusionWhatsApp
    serializer_class = ExclusionSerializer


class PruebaView(ExigeNegocioMixin, APIView):
    """Envía un evento con datos de ejemplo a un número, para revisar plantillas."""

    permission_classes = [EsAdministrador]

    def post(self, request):
        evento = request.data.get("evento", "ALERTA_GENERAL")
        telefono = request.data.get("telefono", "")
        if evento not in EVENTOS:
            return Response({"detail": "Evento desconocido."}, status=400)
        config = servicio.configuracion(request.tenant)
        if not config or not config.activo:
            return Response({"detail": "Activa WhatsApp en la configuración antes de probar."}, status=400)

        with transaction.atomic():
            mensaje = servicio.encolar(
                request.tenant, evento, telefono, {n: EJEMPLOS.get(n, "-") for n in EVENTOS[evento]["variables"]}
            )
        if mensaje is None:
            return Response(
                {"detail": "No se encoló: revisa el teléfono, si el evento está apagado o si el número pidió la baja."},
                status=400,
            )
        mensaje.refresh_from_db()
        return Response(MensajeSerializer(mensaje).data, status=status.HTTP_201_CREATED)
