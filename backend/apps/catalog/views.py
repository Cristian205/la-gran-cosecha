from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.common.permissions import EsStaff, SoloLecturaPublicaOStaff, requiere_permiso

from .filters import ProductoFilter
from .models import Categoria, HistorialPrecio, PresentacionProducto, Producto, UnidadMedida
from .serializers import (
    CategoriaSerializer,
    HistorialPrecioSerializer,
    PresentacionProductoSerializer,
    ProductoSerializer,
    ProductoWriteSerializer,
    UnidadMedidaSerializer,
)

TIPOS_IMAGEN_VALIDOS = ("image/jpeg", "image/png", "image/webp")
LIMITE_IMAGEN_MB = 5


class CategoriaViewSet(viewsets.ModelViewSet):
    """Categorías: lectura pública, escritura solo staff."""

    serializer_class = CategoriaSerializer
    permission_classes = [SoloLecturaPublicaOStaff]

    def get_queryset(self):
        qs = Categoria.objects.all()
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(estado_categoria=True)
        return qs


class UnidadMedidaViewSet(viewsets.ModelViewSet):
    """Unidades de medida (catálogo interno)."""

    serializer_class = UnidadMedidaSerializer
    permission_classes = [SoloLecturaPublicaOStaff]
    queryset = UnidadMedida.objects.all()


class ProductoViewSet(viewsets.ModelViewSet):
    """
    Productos: lectura pública (solo activos para anónimos), escritura staff.
    El borrado es lógico (estado_producto=False), como en el original.
    """

    filterset_class = ProductoFilter
    search_fields = ["nombre_producto", "categoria__nombre_categoria"]
    ordering_fields = ["orden", "nombre_producto", "fecha_creacion", "id"]

    def get_permissions(self):
        if self.action in ("update", "partial_update", "subir_imagen"):
            return [requiere_permiso("catalog.change_producto")()]
        if self.action == "destroy":
            return [requiere_permiso("catalog.delete_producto")()]
        return [SoloLecturaPublicaOStaff()]

    def get_queryset(self):
        qs = (
            Producto.objects.select_related("categoria", "unidad_base")
            .prefetch_related(
                Prefetch(
                    "presentaciones",
                    queryset=PresentacionProducto.objects.select_related("unidad_venta"),
                )
            )
            .order_by("orden", "nombre_producto")
        )
        # Los clientes anónimos solo ven productos activos.
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(estado_producto=True)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ProductoWriteSerializer
        return ProductoSerializer

    def destroy(self, request, *args, **kwargs):
        producto = self.get_object()
        producto.estado_producto = False
        producto.save(update_fields=["estado_producto"])
        return Response(
            {"ok": True, "mensaje": f"{producto.nombre_producto} desactivado"},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="historial-precios",
        permission_classes=[EsStaff],
    )
    def historial_precios(self, request, pk=None):
        producto = self.get_object()
        historial = (
            HistorialPrecio.objects.filter(presentacion__producto=producto)
            .select_related("presentacion", "usuario")
            .order_by("-fecha_cambio")[:50]
        )
        return Response(HistorialPrecioSerializer(historial, many=True).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="imagen",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[EsStaff],
    )
    def subir_imagen(self, request, pk=None):
        producto = self.get_object()
        imagen = request.FILES.get("imagen")

        if not imagen:
            return Response(
                {"ok": False, "mensaje": "No se envió ninguna imagen."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if imagen.content_type not in TIPOS_IMAGEN_VALIDOS:
            return Response(
                {"ok": False, "mensaje": "Formato no permitido. Usa JPG, PNG o WEBP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if imagen.size > LIMITE_IMAGEN_MB * 1024 * 1024:
            return Response(
                {"ok": False, "mensaje": f"La imagen supera el límite de {LIMITE_IMAGEN_MB}MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        producto.imagen = imagen
        producto.save(update_fields=["imagen"])
        return Response(
            {"ok": True, "mensaje": "Imagen actualizada correctamente",
             **ProductoSerializer(producto, context={"request": request}).data}
        )


class PresentacionProductoViewSet(viewsets.ModelViewSet):
    """Presentaciones (staff). El borrado es lógico."""

    serializer_class = PresentacionProductoSerializer
    permission_classes = [EsStaff]
    queryset = PresentacionProducto.objects.select_related("unidad_venta", "producto")

    def destroy(self, request, *args, **kwargs):
        presentacion = self.get_object()
        presentacion.estado_presentacion = False
        presentacion.save(update_fields=["estado_presentacion"])
        return Response({"ok": True}, status=status.HTTP_200_OK)
