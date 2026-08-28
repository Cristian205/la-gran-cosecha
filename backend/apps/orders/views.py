from django.db import transaction
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Producto
from apps.catalog.serializers import ProductoSerializer, ProductoWriteSerializer
from apps.common.permissions import EsStaff, requiere_permiso
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from .models import Cliente, DetallePedido, HistorialDetallePedido, LotePedidos, Pedido
from .serializers import (
    ClienteSerializer,
    CrearPedidoSerializer,
    EditarPedidoSerializer,
    HistorialDetallePedidoSerializer,
    LoteDetailSerializer,
    LoteSerializer,
    PedidoDetailSerializer,
    PedidoListSerializer,
    ProductoPendienteSerializer,
)

MINIMO_MAS_VENDIDOS = 8


class ProductosMasVendidosView(ExigeNegocioMixin, APIView):
    """
    Home público: ranking real por unidades vendidas en pedidos ya
    entregados. Si el negocio es nuevo y aún no hay suficiente historial,
    completa el resto con productos activos por orden de catálogo, para que
    el bloque nunca se vea vacío.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        ids_vendidos = list(
            DetallePedido.objects.filter(
                pedido__estado="ENTREGADO", presentacion__isnull=False
            )
            .values("presentacion__producto_id")
            .annotate(total_cantidad=Sum("cantidad"))
            .order_by("-total_cantidad")
            .values_list("presentacion__producto_id", flat=True)
        )[:MINIMO_MAS_VENDIDOS]

        productos_por_id = Producto.objects.filter(
            id__in=ids_vendidos, estado_producto=True
        ).select_related("categoria").prefetch_related("presentaciones__unidad_venta")
        productos_por_id = {p.id: p for p in productos_por_id}
        resultado = [productos_por_id[i] for i in ids_vendidos if i in productos_por_id]

        if len(resultado) < MINIMO_MAS_VENDIDOS:
            faltan = MINIMO_MAS_VENDIDOS - len(resultado)
            relleno = (
                Producto.objects.filter(estado_producto=True)
                .exclude(id__in=[p.id for p in resultado])
                .select_related("categoria")
                .prefetch_related("presentaciones__unidad_venta")
                .order_by("orden", "nombre_producto")[:faltan]
            )
            resultado += list(relleno)

        data = ProductoSerializer(resultado, many=True, context={"request": request}).data
        return Response(data)


class PedidoViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Pedidos.
    - create: público (el cliente genera su pedido desde el storefront).
    - resto de operaciones: solo staff.
    """

    search_fields = ["id", "cliente__nombre_cliente"]
    ordering_fields = ["id", "fecha_pedido", "total_pedido"]
    ordering = ["-id"]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        if self.action in ("update", "partial_update", "entregar"):
            return [requiere_permiso("orders.change_pedido")()]
        if self.action == "destroy":
            return [requiere_permiso("orders.delete_pedido")()]
        return [requiere_permiso("orders.view_pedido")()]

    def get_queryset(self):
        qs = (
            Pedido.objects.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-id")
        )
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        desde = self.request.query_params.get("desde")
        if desde:
            qs = qs.filter(fecha_pedido__date__gte=desde)
        hasta = self.request.query_params.get("hasta")
        if hasta:
            qs = qs.filter(fecha_pedido__date__lte=hasta)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return CrearPedidoSerializer
        if self.action in ("retrieve", "partial_update", "update"):
            return PedidoDetailSerializer
        return PedidoListSerializer

    def create(self, request, *args, **kwargs):
        serializer = CrearPedidoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(serializer.to_representation(pedido), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        pedido = self.get_object()
        serializer = EditarPedidoSerializer(
            instance=pedido, data=request.data, context={"request": request}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(serializer.to_representation(pedido))

    # PUT delega en el mismo flujo de edición parcial
    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="entregar")
    def entregar(self, request):
        """Marca como ENTREGADO un lote de pedidos (mirror de entregar_pedidos_view)."""
        ids = request.data.get("ids", [])
        ids = [i for i in ids if str(i).isdigit()]
        if not ids:
            return Response(
                {"message": "No se seleccionaron pedidos"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pedidos_qs = Pedido.objects.filter(id__in=ids)
        cantidad = pedidos_qs.count()
        if cantidad == 0:
            return Response(
                {"message": "Ninguno de los pedidos existe"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        total = pedidos_qs.aggregate(total=Sum("total_pedido"))["total"] or 0
        pedidos_qs.update(estado="ENTREGADO")

        lote = LotePedidos.objects.create(
            tipo="ENTREGA",
            usuario=request.user,
            cantidad_pedidos=cantidad,
            total_lote=total,
        )
        lote.pedidos.set(pedidos_qs)

        return Response({"success": True, "actualizados": cantidad, "lote_id": lote.id})

    @action(detail=True, methods=["get"], url_path="historial")
    def historial(self, request, pk=None):
        """Historial de ediciones (cantidad/precio/nombre) de las líneas del pedido."""
        pedido = self.get_object()
        historial = (
            HistorialDetallePedido.objects.filter(detalle__pedido=pedido)
            .select_related("usuario", "detalle__presentacion__producto")
            .order_by("-fecha")
        )
        return Response(HistorialDetallePedidoSerializer(historial, many=True).data)


class ProductoPendienteViewSet(ExigeNegocioMixin, viewsets.ViewSet):
    """
    Productos personalizados (`DetallePedido.es_catalogo=False`) escritos por
    clientes en el storefront, a la espera de que el admin los acepte
    (se convierten en `catalog.Producto`) o los rechace (quedan tal cual en
    el pedido/factura original, sin tocar el catálogo).
    """

    permission_classes = [EsStaff]

    def get_permissions(self):
        if self.action == "list":
            return [requiere_permiso("orders.view_pedido")()]
        return super().get_permissions()

    def get_queryset(self):
        return (
            DetallePedido.objects.filter(es_catalogo=False, estado_revision="PENDIENTE")
            .select_related("unidad_personalizada", "categoria_manual", "pedido__cliente")
            .order_by("-fecha_modificacion")
        )

    def list(self, request):
        serializer = ProductoPendienteSerializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="aprobar",
        permission_classes=[requiere_permiso("catalog.add_producto")],
    )
    @transaction.atomic
    def aprobar(self, request, pk=None):
        detalle = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ProductoWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        producto = serializer.save()

        # La línea del pedido que originó este producto pendiente sigue "manual"
        # (presentacion=None) aunque ya exista en el catálogo, a menos que la
        # enlacemos aquí: si el admin creó una sola presentación, no hay
        # ambigüedad posible y se enlaza sola; si creó varias, se enlaza la que
        # el frontend indique como "la que pidió este cliente" (por posición,
        # ya que las presentaciones nuevas no tienen id hasta guardarse).
        presentaciones_creadas = list(
            producto.presentaciones.filter(estado_presentacion=True).order_by("id")
        )
        presentacion_elegida = None
        indice = request.data.get("presentacion_index")
        if indice is not None and str(indice).isdigit() and int(indice) < len(presentaciones_creadas):
            presentacion_elegida = presentaciones_creadas[int(indice)]
        elif len(presentaciones_creadas) == 1:
            presentacion_elegida = presentaciones_creadas[0]

        detalle.producto_generado = producto
        detalle.estado_revision = "ACEPTADO"

        if presentacion_elegida:
            detalle.presentacion = presentacion_elegida
            detalle.precio_unitario = presentacion_elegida.precio_unitario
            detalle.nombre_personalizado = None
            detalle.unidad_personalizada = None
            detalle.categoria_manual = None
            detalle.es_catalogo = True
            detalle.save()  # full_clean() + recálculo de subtotal, ya en el modelo
            detalle.pedido.actualizar_total()
        else:
            detalle.save(update_fields=["producto_generado", "estado_revision"])

        return Response(serializer.to_representation(producto), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="rechazar")
    def rechazar(self, request, pk=None):
        detalle = get_object_or_404(self.get_queryset(), pk=pk)
        detalle.estado_revision = "RECHAZADO"
        detalle.save(update_fields=["estado_revision"])
        return Response({"success": True})


class LoteViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Lotes de pedidos generados al imprimir o entregar en masa (solo lectura)."""

    permission_classes = [EsStaff]
    modelo = LotePedidos

    def get_queryset(self):
        return super().get_queryset().select_related("usuario").prefetch_related("pedidos")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return LoteDetailSerializer
        return LoteSerializer


class ClienteViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """Clientes (solo staff)."""

    serializer_class = ClienteSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [requiere_permiso("orders.change_cliente")()]
        if self.action == "destroy":
            return [requiere_permiso("orders.delete_cliente")()]
        return [requiere_permiso("orders.view_cliente")()]

    def get_queryset(self):
        qs = Cliente.objects.all()
        query = self.request.query_params.get("q")
        if query:
            qs = qs.filter(
                Q(nombre_cliente__icontains=query)
                | Q(telefono_cliente__icontains=query)
            )
        return qs
