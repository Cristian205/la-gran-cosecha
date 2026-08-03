from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import EsStaff

from .models import Notificacion
from .serializers import NotificacionSerializer


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Bandeja de notificaciones del panel: solo lectura + acciones puntuales
    para marcar como leída (una o todas). Se crean desde señales (nuevo
    pedido, nuevo cliente) o, más adelante, desde avisos de plataforma.
    """

    serializer_class = NotificacionSerializer
    queryset = Notificacion.objects.all()
    permission_classes = [EsStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        silenciados = getattr(self.request.user, "notificaciones_silenciadas", None) or []
        if silenciados:
            qs = qs.exclude(tipo__in=silenciados)
        if self.request.query_params.get("no_leidas") == "true":
            qs = qs.filter(leida=False)
        return qs

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        return Response({"no_leidas": self.get_queryset().filter(leida=False).count()})

    @action(detail=True, methods=["post"])
    def marcar_leida(self, request, pk=None):
        notificacion = self.get_object()
        if not notificacion.leida:
            notificacion.leida = True
            notificacion.save(update_fields=["leida"])
        return Response(self.get_serializer(notificacion).data)

    @action(detail=False, methods=["post"])
    def marcar_todas_leidas(self, request):
        self.get_queryset().filter(leida=False).update(leida=True)
        return Response({"actualizado": True})
