from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from apps.common.permissions import EsStaff

from apps.tenancy.viewsets import TenantScopedMixin

from .models import MensajeContacto, SolicitudComercial, Suscriptor
from .serializers import (
    MensajeContactoSerializer,
    SolicitudComercialSerializer,
    SuscriptorSerializer,
)


class MensajeContactoViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Mensajes del formulario de contacto público.
    - create: público (cualquiera puede enviar un mensaje).
    - list/retrieve/update/destroy: solo staff.
    """

    serializer_class = MensajeContactoSerializer
    modelo = MensajeContacto
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [EsStaff()]


class SuscriptorViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    La lista de correo del negocio.

    - create: publico. Lo llama el bloque de boletin de la tienda.
    - list/retrieve: solo staff. Es la lista que el negocio exporta.

    No hay borrado: darse de baja es archivar —`activo` a falso— y no
    desaparecer. Es la regla de la casa y ademas es lo que hay que poder
    demostrar si alguien reclama que le siguen escribiendo.
    """

    serializer_class = SuscriptorSerializer
    modelo = Suscriptor
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [EsStaff()]

    def create(self, request, *args, **kwargs):
        """
        Apuntarse dos veces no es un error.

        Quien no esta seguro de si le funciono vuelve a pulsar, y devolverle un
        400 por eso le dice que algo se rompio cuando en realidad ya estaba
        dentro. Se responde 200 y se reactiva la suscripcion si estaba de baja,
        que es lo que la persona acaba de pedir.
        """
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        existente = self.get_queryset().filter(email__iexact=datos["email"]).first()
        if existente is not None:
            if not existente.activo:
                existente.activo = True
                existente.save(update_fields=["activo"])
            return Response(self.get_serializer(existente).data, status=status.HTTP_200_OK)

        entrada.save()
        return Response(entrada.data, status=status.HTTP_201_CREATED)


class SolicitudComercialThrottle(SimpleRateThrottle):
    """
    Cuántas solicitudes puede enviar una misma IP por hora.

    Es un formulario público que cualquiera puede llamar sin sesión, así que
    sin tope sería una forma gratis de llenar la bandeja del equipo. Cinco por
    hora es de sobra para una persona real (que se equivoca y reenvía) y poco
    para un script. Configurable con `TASA_SOLICITUD_COMERCIAL`.
    """

    scope = "solicitud_comercial"

    def get_rate(self):
        return getattr(settings, "TASA_SOLICITUD_COMERCIAL", "5/hour")

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class SolicitudComercialView(APIView):
    """
    POST /api/contact/solicitudes-comerciales/ — alguien le escribe a la
    plataforma desde su sitio de ventas.

    Público y sin sesión: no pasa por el ámbito de negocio (no hay tienda) ni
    lee credenciales. Solo crea; leerlas es del equipo, desde el admin.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SolicitudComercialThrottle]

    def post(self, request):
        entrada = SolicitudComercialSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = dict(entrada.validated_data)
        trampa = datos.pop("sitio_web", "")
        if trampa:
            # Un bot: se le responde como si hubiera funcionado y no se guarda.
            return Response({"ok": True}, status=status.HTTP_201_CREATED)
        SolicitudComercial.objects.create(**datos)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
