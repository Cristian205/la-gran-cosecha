from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser

from apps.common.pagination import DefaultPagination
from apps.common.permissions import requiere_permiso
from apps.tenancy.viewsets import TenantScopedMixin

from .models import Archivo
from .serializers import ArchivoSerializer


class ArchivoViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Biblioteca de medios del panel (herramienta de administración, sin
    lectura pública). Los bytes de un archivo son inmutables una vez
    subidos: `patch` solo permite renombrar, no reemplazar el archivo.
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    serializer_class = ArchivoSerializer
    permission_classes = [requiere_permiso("content.view_promobanner")]
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = DefaultPagination
    modelo = Archivo

    def get_queryset(self):
        return super().get_queryset().select_related("subido_por")
    filterset_fields = ["tipo"]
    search_fields = ["nombre_original"]
    ordering = ["-fecha_creacion"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.archivo.delete(save=False)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def contenido(self, request, pk=None):
        """
        Los bytes del archivo, servidos por este mismo API.

        El bucket público de R2 no tiene CORS configurado —ni le hace falta
        para lo que fue pensado: servir la tienda, que nunca lo pide con
        `fetch`—, así que "elegir de la biblioteca" no puede simplemente
        descargar `archivo.url` desde el navegador del panel: el navegador
        rechaza esa respuesta antes de que el código la vea. Pedirla aquí en
        cambio es una petición más al API de siempre: el backend habla con R2
        por su cuenta —sin navegador de por medio, sin CORS que aplique— y
        entrega los bytes ya en el origen del panel.
        """
        archivo = self.get_object()
        return FileResponse(archivo.archivo.open("rb"), content_type=archivo.content_type)
