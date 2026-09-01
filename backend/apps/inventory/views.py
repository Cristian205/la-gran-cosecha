"""
Las rutas del inventario.

Todas son del panel: la tienda pública NO consulta esta app. Lo que el visitante
ve —«quedan 3», «agotado»— sale del catálogo, que anota su disponibilidad al
listar productos; exponer el kardex a quien no ha iniciado sesión regalaría el
ritmo de ventas del negocio a cualquiera que mirase.
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import EsStaff, requiere_permiso
from apps.tenancy.viewsets import TenantScopedMixin

from . import operaciones
from .models import Existencia, MovimientoInventario, Ubicacion
from .serializers import (
    AjusteSerializer,
    EntradaSerializer,
    ExistenciaSerializer,
    MovimientoSerializer,
    TrasladoSerializer,
    UbicacionSerializer,
)

VER = "inventory.view_existencia"
MOVER = "inventory.change_existencia"


class UbicacionViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """Bodegas y puntos de venta del negocio."""

    serializer_class = UbicacionSerializer
    permission_classes = [EsStaff]
    modelo = Ubicacion
    # Catálogo cerrado y corto que alimenta los <select> del panel: paginarlo
    # solo haría desaparecer la bodega número veintiuno.
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [requiere_permiso(MOVER)()]
        return super().get_permissions()


class ExistenciaViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """
    Los saldos, y las operaciones que los cambian.

    Es de solo lectura como recurso y con acciones para escribir. La asimetría
    es el punto: no hay forma de fijar un número directamente, solo de registrar
    lo que pasó y dejar que el saldo se derive.
    """

    serializer_class = ExistenciaSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Existencia
    filterset_fields = ["producto", "ubicacion"]
    search_fields = ["producto__nombre_producto", "producto__codigo_producto"]
    ordering_fields = ["cantidad", "producto__nombre_producto"]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("producto", "ubicacion")
        )

    def get_permissions(self):
        if self.action in ("entrada", "ajuste", "traslado"):
            return [requiere_permiso(MOVER)()]
        return super().get_permissions()

    # ----------------------------------------------------------------------
    def _ejecutar(self, serializer_class, operacion):
        """
        El armazón común de las tres acciones.

        Traduce `ErrorDeInventario` a un 400 con su mensaje. Esos mensajes están
        escritos para que los lea un cajero —«solo hay 3 disponibles»— y no para
        depurar, así que devolverlos tal cual es lo correcto.
        """
        entrada = serializer_class(data=self.request.data, context=self.get_serializer_context())
        entrada.is_valid(raise_exception=True)
        try:
            existencia = operacion(entrada.validated_data)
        except operaciones.ErrorDeInventario as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        if existencia is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(ExistenciaSerializer(existencia).data)

    @action(detail=False, methods=["post"])
    def entrada(self, request):
        """Registra mercancía que llega."""
        return self._ejecutar(
            EntradaSerializer,
            lambda datos: operaciones.entrada(
                datos["producto"],
                datos["cantidad"],
                ubicacion=datos.get("ubicacion"),
                usuario=request.user,
                motivo=datos.get("motivo", ""),
                origen_tipo="panel",
            ),
        )

    @action(detail=False, methods=["post"])
    def ajuste(self, request):
        """Cuadra el saldo con un conteo físico."""
        return self._ejecutar(
            AjusteSerializer,
            lambda datos: operaciones.ajustar(
                datos["producto"],
                datos["cantidad_contada"],
                ubicacion=datos.get("ubicacion"),
                usuario=request.user,
                motivo=datos.get("motivo") or "Ajuste por conteo físico",
                origen_tipo="panel",
            ),
        )

    @action(detail=False, methods=["post"])
    def traslado(self, request):
        """Mueve mercancía de una ubicación a otra."""
        return self._ejecutar(
            TrasladoSerializer,
            lambda datos: operaciones.trasladar(
                datos["producto"],
                datos["cantidad"],
                origen=datos["origen"],
                destino=datos["destino"],
                usuario=request.user,
                motivo=datos.get("motivo", ""),
                origen_tipo="panel",
            ),
        )


class MovimientoViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """
    El kardex: qué pasó, cuándo y por orden de quién.

    Solo lectura, y no por comodidad: un movimiento equivocado se corrige con un
    ajuste que deja los dos a la vista. Poder reescribir el histórico convertiría
    la única fuente de verdad del inventario en una opinión.
    """

    serializer_class = MovimientoSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = MovimientoInventario
    filterset_fields = ["producto", "ubicacion", "tipo"]
    ordering_fields = ["fecha"]

    def get_queryset(self):
        return super().get_queryset().select_related("producto", "ubicacion", "usuario")
