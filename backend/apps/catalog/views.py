from django.db import transaction
from django.db.models import Count, DecimalField, Min, OuterRef, Prefetch, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.common.permissions import EsStaff, SoloLecturaPublicaOStaff, requiere_permiso
from apps.inventory.operaciones import anotacion_disponible
from apps.tenancy.viewsets import TenantScopedMixin

from .filters import ProductoFilter
from .models import Categoria, HistorialPrecio, PresentacionProducto, Producto, UnidadMedida
from .serializers import (
    CategoriaSerializer,
    HistorialPrecioSerializer,
    PresentacionGestionSerializer,
    PresentacionProductoSerializer,
    ProductoSerializer,
    ProductoWriteSerializer,
    UnidadMedidaSerializer,
)

TIPOS_IMAGEN_VALIDOS = ("image/jpeg", "image/png", "image/webp")
LIMITE_IMAGEN_MB = 5


class CategoriaViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """Categorías: lectura pública, escritura solo staff."""

    serializer_class = CategoriaSerializer
    permission_classes = [SoloLecturaPublicaOStaff]

    def get_queryset(self):
        # `num_productos` es lo que la tienda pinta junto a cada categoría
        # ("Frutas · 42"): cuántos productos ACTIVOS tiene. Se cuenta aquí y no
        # en el navegador porque el catálogo se pagina — el cliente solo ve una
        # tanda y contaría mal.
        # El `order_by` repite el `Meta.ordering` a propósito: Django lo ignora
        # en cuanto la consulta agrega (`Count`), y las categorías saldrían en
        # cualquier orden.
        qs = Categoria.objects.annotate(  # ya acotado por el manager
            num_productos=Count("productos", filter=Q(productos__estado_producto=True))
        ).order_by("orden", "nombre_categoria")
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(estado_categoria=True)
        return qs


class UnidadMedidaViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """Unidades de medida (catálogo interno)."""

    serializer_class = UnidadMedidaSerializer
    permission_classes = [SoloLecturaPublicaOStaff]
    modelo = UnidadMedida

    def get_permissions(self):
        # Crear o cambiar unidades es configurar el catálogo: lo hace quien
        # puede editar productos (el editor de presentaciones las crea).
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [requiere_permiso("catalog.change_producto")()]
        return super().get_permissions()
    # Catálogo cerrado y pequeño que los <select> del panel consumen entero:
    # paginarlo solo hacía desaparecer las unidades a partir de la número 20.
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        # `?en_catalogo=1`: solo las unidades por las que de verdad se vende
        # algo hoy, con cuántos productos. Es el filtro "Se vende por" de la
        # tienda: ofrecer "Galón" en una tienda que no vende nada por galón
        # sería un filtro que siempre devuelve vacío.
        if self.request.query_params.get("en_catalogo") in ("1", "true"):
            activas = Q(
                presentaciones_venta__estado_presentacion=True,
                presentaciones_venta__producto__estado_producto=True,
            )
            qs = (
                qs.annotate(
                    num_productos=Count(
                        "presentaciones_venta__producto", filter=activas, distinct=True
                    )
                )
                .filter(num_productos__gt=0)
                .order_by("-num_productos", "nombre_unidad")
            )
        return qs


class ProductoViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Productos: lectura pública (solo activos para anónimos), escritura staff.
    El borrado es lógico (estado_producto=False), como en el original.
    """

    filterset_class = ProductoFilter
    search_fields = ["nombre_producto", "categoria__nombre_categoria"]
    # `precio_desde` es la anotación de get_queryset: el precio del producto vive
    # en sus presentaciones (1:N), así que sin ella la tienda no podría ordenar
    # por precio sobre el catálogo completo, solo sobre la página ya cargada.
    ordering_fields = [
        "orden",
        "nombre_producto",
        "fecha_creacion",
        "id",
        "precio_desde",
        # Anotación condicional, ver `_anotar_unidades_vendidas`.
        "unidades_vendidas",
    ]

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
            .annotate(
                precio_desde=Min(
                    "presentaciones__precio_unitario",
                    filter=Q(presentaciones__estado_presentacion=True),
                ),
                # Subconsulta y no `Sum("existencias__…")`: esta consulta ya se
                # une a las presentaciones para el precio, y dos uniones
                # a-muchos multiplican las filas entre sí. El `Min` sobrevive a
                # eso; una suma daría el stock multiplicado por el número de
                # presentaciones. Ver `anotacion_disponible`.
                disponible=anotacion_disponible(),
            )
            .order_by("orden", "nombre_producto")
        )
        # Los clientes anónimos solo ven productos activos.
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(estado_producto=True)
        if "unidades_vendidas" in self.request.query_params.get("ordering", ""):
            qs = self._anotar_unidades_vendidas(qs)
        return qs

    @staticmethod
    def _anotar_unidades_vendidas(qs):
        """
        "Más pedidos" como criterio del listado.

        Mismo criterio que `/orders/productos-mas-vendidos/` —unidades en
        pedidos ENTREGADOS— para que la sección y el orden no se contradigan.
        Subconsulta y no `Sum(...)` sobre la unión, por la misma razón que
        `disponible`: la consulta ya se une a las presentaciones y la suma
        saldría multiplicada. Solo se anota cuando se pide ese orden: es una
        subconsulta correlacionada y el listado normal no la necesita.

        El valor no se serializa: la tienda ordena por él, pero el volumen de
        ventas de un negocio no es un dato público.
        """
        from apps.orders.models import DetallePedido

        decimal = DecimalField(max_digits=14, decimal_places=2)
        vendidas = (
            DetallePedido.objects.filter(
                pedido__estado="ENTREGADO", presentacion__producto=OuterRef("pk")
            )
            .values("presentacion__producto")
            .annotate(total=Sum("cantidad"))
            .values("total")
        )
        return qs.annotate(
            unidades_vendidas=Coalesce(
                Subquery(vendidas, output_field=decimal), Value(0, output_field=decimal)
            )
        )

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


def _validar_imagen(imagen):
    """El mensaje de error de una imagen subida, o None si sirve."""
    if not imagen:
        return "No se envió ninguna imagen."
    if imagen.content_type not in TIPOS_IMAGEN_VALIDOS:
        return "Formato no permitido. Usa JPG, PNG o WEBP."
    if imagen.size > LIMITE_IMAGEN_MB * 1024 * 1024:
        return f"La imagen supera el límite de {LIMITE_IMAGEN_MB}MB."
    return None


class PresentacionProductoViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Presentaciones de un producto, una a una (panel).

    Leer: cualquier persona del equipo. Crear, editar, ordenar, activar o
    desactivar: quien puede editar productos, porque una presentación es parte
    del producto. El borrado es lógico: los pedidos y las facturas viejas
    apuntan a la presentación y tienen que seguir diciendo qué se vendió.

    `?producto=<id>` devuelve las de un producto, activas e inactivas, en su
    orden. Es lo que pide el editor del panel; el catálogo público solo lleva
    las activas dentro de cada producto.
    """

    permission_classes = [EsStaff]
    modelo = PresentacionProducto
    # Un producto tiene pocas presentaciones y el editor las quiere todas.
    pagination_class = None

    ACCIONES_DE_ESCRITURA = (
        "create",
        "update",
        "partial_update",
        "destroy",
        "imagen",
        "reordenar",
    )

    def get_permissions(self):
        # La foto y los datos de una presentación son parte del producto: los
        # cambia quien puede editar productos, igual que la foto principal.
        if self.action in self.ACCIONES_DE_ESCRITURA:
            return [requiere_permiso("catalog.change_producto")()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PresentacionGestionSerializer
        return PresentacionProductoSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related("unidad_venta", "producto")
        producto = self.request.query_params.get("producto")
        if producto is not None:
            qs = qs.filter(producto_id=producto) if producto.isdigit() else qs.none()
        return qs.order_by("orden", "id")

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser, FormParser])
    def imagen(self, request, pk=None):
        """Sube (POST, campo `imagen`) o quita (DELETE) la foto de la presentación."""
        presentacion = self.get_object()
        if request.method == "DELETE":
            if presentacion.imagen:
                presentacion.imagen.delete(save=False)
            presentacion.imagen = None
            presentacion.save(update_fields=["imagen"])
            return Response(PresentacionProductoSerializer(presentacion, context={"request": request}).data)

        archivo = request.FILES.get("imagen")
        error = _validar_imagen(archivo)
        if error:
            return Response({"ok": False, "mensaje": error}, status=status.HTTP_400_BAD_REQUEST)
        presentacion.imagen = archivo
        presentacion.save(update_fields=["imagen"])
        return Response(PresentacionProductoSerializer(presentacion, context={"request": request}).data)

    @action(detail=False, methods=["post"])
    def reordenar(self, request):
        """
        `{"producto": 7, "ids": [12, 9, 15]}`: deja las presentaciones de ese
        producto en ese orden.

        Tienen que venir TODAS las del producto, ni una más ni una menos: un
        orden parcial dejaría a las que faltan con números que ya no se
        corresponden con nada, y un id ajeno no puede colarse en la lista.
        """
        producto_id = request.data.get("producto")
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
            return Response(
                {"ids": ["Envía la lista completa de presentaciones en el orden deseado."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            presentaciones = {
                p.id: p
                for p in self.get_queryset()
                .filter(producto_id=producto_id)
                .select_for_update()
            }
            if not presentaciones:
                return Response(status=status.HTTP_404_NOT_FOUND)
            if sorted(ids) != sorted(presentaciones):
                return Response(
                    {"ids": ["La lista no coincide con las presentaciones actuales del producto. Recarga e inténtalo de nuevo."]},
                    status=status.HTTP_409_CONFLICT,
                )
            cambiadas = []
            for posicion, pid in enumerate(ids):
                pres = presentaciones[pid]
                if pres.orden != posicion:
                    pres.orden = posicion
                    pres.version += 1
                    cambiadas.append(pres)
            PresentacionProducto.objects.bulk_update(cambiadas, ["orden", "version"])

        ordenadas = sorted(presentaciones.values(), key=lambda p: p.orden)
        return Response(
            PresentacionProductoSerializer(ordenadas, many=True, context={"request": request}).data
        )

    def destroy(self, request, *args, **kwargs):
        presentacion = self.get_object()
        presentacion.estado_presentacion = False
        presentacion.save(update_fields=["estado_presentacion"])
        return Response({"ok": True}, status=status.HTTP_200_OK)
