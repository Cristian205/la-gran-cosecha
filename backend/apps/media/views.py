from rest_framework import viewsets
from rest_framework.parsers import FormParser, MultiPartParser

from apps.common.pagination import DefaultPagination
from apps.common.permissions import requiere_permiso

from .models import Archivo
from .serializers import ArchivoSerializer


class ArchivoViewSet(viewsets.ModelViewSet):
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
    queryset = Archivo.objects.select_related("subido_por")
    filterset_fields = ["tipo"]
    search_fields = ["nombre_original"]
    ordering = ["-fecha_creacion"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.archivo.delete(save=False)
        return super().destroy(request, *args, **kwargs)
