from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from apps.common.permissions import EsStaff

from apps.tenancy.viewsets import TenantScopedMixin

from .models import MensajeContacto
from .serializers import MensajeContactoSerializer


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
