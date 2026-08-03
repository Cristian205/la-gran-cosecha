from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count
from rest_framework import serializers

from apps.catalog.models import Categoria, PresentacionProducto, UnidadMedida

from .models import Cliente, DetallePedido, HistorialDetallePedido, LotePedidos, Pedido


# ==========================================================================
# CLIENTE
# ==========================================================================
class ClienteSerializer(serializers.ModelSerializer):
    total_pedidos = serializers.IntegerField(source="pedidos.count", read_only=True)

    class Meta:
        model = Cliente
        fields = [
            "id",
            "nombre_cliente",
            "telefono_cliente",
            "direccion_cliente",
            "fecha_registro_cliente",
            "total_pedidos",
        ]


# ==========================================================================
# LECTURA DE PEDIDOS
# ==========================================================================
class PedidoListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    num_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Pedido
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "estado",
            "total_pedido",
            "fecha_pedido",
            "num_items",
        ]

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre_cliente if obj.cliente else ""


class DetallePedidoSerializer(serializers.Serializer):
    """Representa una línea de pedido tal como la esperaba `detalle_pedido_api`."""

    id = serializers.IntegerField()
    detalle_id = serializers.IntegerField(source="id")
    presentacion_id = serializers.SerializerMethodField()
    producto_id = serializers.SerializerMethodField()
    presentacion_nombre = serializers.SerializerMethodField()
    nombre_producto = serializers.SerializerMethodField()
    categoria = serializers.SerializerMethodField()
    unidad_id = serializers.SerializerMethodField()
    unidad_nombre = serializers.SerializerMethodField()
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    personalizado = serializers.SerializerMethodField()
    estado_revision = serializers.SerializerMethodField()

    def get_presentacion_id(self, obj):
        return obj.presentacion_id

    def get_producto_id(self, obj):
        return obj.presentacion.producto_id if obj.presentacion else None

    def get_presentacion_nombre(self, obj):
        return obj.presentacion.nombre_presentacion if obj.presentacion else None

    def get_nombre_producto(self, obj):
        if obj.presentacion:
            return obj.presentacion.producto.nombre_producto
        return obj.nombre_personalizado

    def get_categoria(self, obj):
        if obj.presentacion:
            cat = obj.presentacion.producto.categoria
            return cat.nombre_categoria if cat else ""
        return obj.categoria_manual.nombre_categoria if obj.categoria_manual else ""

    def get_unidad_id(self, obj):
        if obj.presentacion:
            return obj.presentacion.unidad_venta_id
        return obj.unidad_personalizada_id

    def get_unidad_nombre(self, obj):
        if obj.presentacion:
            return obj.presentacion.unidad_venta.nombre_unidad
        return obj.unidad_personalizada.nombre_unidad if obj.unidad_personalizada else ""

    def get_personalizado(self, obj):
        return obj.presentacion is None

    def get_estado_revision(self, obj):
        return None if obj.presentacion else obj.estado_revision


class PedidoDetailSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    detalles = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "estado",
            "total_pedido",
            "observaciones",
            "fecha_pedido",
            "fecha_modificacion",
            "detalles",
        ]

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre_cliente if obj.cliente else ""

    def get_detalles(self, obj):
        detalles = obj.detalles.select_related(
            "presentacion__producto__categoria",
            "presentacion__unidad_venta",
            "categoria_manual",
            "unidad_personalizada",
        )
        return DetallePedidoSerializer(detalles, many=True).data


# ==========================================================================
# CREACIÓN PÚBLICA DE PEDIDO (storefront)
# ==========================================================================
class ClienteInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=200)
    telefono = serializers.CharField(max_length=25, required=False, allow_blank=True)
    direccion = serializers.CharField(required=False, allow_blank=True)


class ItemCatalogoSerializer(serializers.Serializer):
    presentacion_id = serializers.PrimaryKeyRelatedField(
        queryset=PresentacionProducto.objects.all(), source="presentacion"
    )
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))


class ItemPersonalizadoSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=255)
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    precio_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=Decimal("0")
    )
    unidad_id = serializers.PrimaryKeyRelatedField(
        queryset=UnidadMedida.objects.all(),
        source="unidad",
        required=False,
        allow_null=True,
    )
    categoria_id = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
        source="categoria",
        required=False,
        allow_null=True,
    )


class CrearPedidoSerializer(serializers.Serializer):
    """
    Reescribe `generar_pedido` como API JSON, conservando la lógica de negocio:
    get_or_create del Cliente, creación de DetallePedido (catálogo y personalizados)
    y recálculo del total.
    """

    cliente = ClienteInputSerializer()
    items = ItemCatalogoSerializer(many=True, required=False, default=list)
    personalizados = ItemPersonalizadoSerializer(many=True, required=False, default=list)
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("items") and not attrs.get("personalizados"):
            raise serializers.ValidationError(
                "El pedido debe incluir al menos un producto."
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        datos_cliente = validated_data["cliente"]
        request = self.context.get("request")

        cliente, creado = Cliente.objects.get_or_create(
            nombre_cliente=datos_cliente["nombre"].strip()
        )
        # Actualiza contacto si viene y el cliente aún no lo tenía.
        actualizar = []
        if datos_cliente.get("telefono") and not cliente.telefono_cliente:
            cliente.telefono_cliente = datos_cliente["telefono"]
            actualizar.append("telefono_cliente")
        if datos_cliente.get("direccion") and not cliente.direccion_cliente:
            cliente.direccion_cliente = datos_cliente["direccion"]
            actualizar.append("direccion_cliente")
        if actualizar:
            cliente.save(update_fields=actualizar)

        usuario = None
        if request and request.user and request.user.is_authenticated:
            usuario = request.user

        pedido = Pedido.objects.create(
            cliente=cliente, usuario=usuario, estado="PENDIENTE",
            observaciones=validated_data.get("observaciones", ""),
        )

        for item in validated_data.get("items", []):
            presentacion = item["presentacion"]
            DetallePedido.objects.create(
                pedido=pedido,
                presentacion=presentacion,
                cantidad=item["cantidad"],
                precio_unitario=presentacion.precio_unitario,
                es_catalogo=True,
            )

        for item in validated_data.get("personalizados", []):
            DetallePedido.objects.create(
                pedido=pedido,
                nombre_personalizado=item["nombre"].strip(),
                cantidad=item["cantidad"],
                precio_unitario=item.get("precio_unitario") or Decimal("0"),
                unidad_personalizada=item.get("unidad"),
                categoria_manual=item.get("categoria"),
                es_catalogo=False,
            )

        pedido.actualizar_total()
        return pedido

    def to_representation(self, instance):
        return {
            "success": True,
            "pedido_id": instance.id,
            "total": instance.total_pedido,
            "estado": instance.estado,
        }


# ==========================================================================
# PRODUCTOS PERSONALIZADOS PENDIENTES DE REVISIÓN
# ==========================================================================
class ProductoPendienteSerializer(serializers.Serializer):
    """Línea personalizada (`es_catalogo=False`) a la espera de que el admin
    la acepte (convertida en producto de catálogo) o la rechace."""

    id = serializers.IntegerField()
    nombre_personalizado = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    unidad_id = serializers.IntegerField(source="unidad_personalizada_id")
    unidad_nombre = serializers.SerializerMethodField()
    categoria_id = serializers.IntegerField(source="categoria_manual_id")
    categoria_nombre = serializers.SerializerMethodField()
    pedido = serializers.IntegerField(source="pedido_id")
    cliente_nombre = serializers.SerializerMethodField()
    fecha_modificacion = serializers.DateTimeField()

    def get_unidad_nombre(self, obj):
        return obj.unidad_personalizada.nombre_unidad if obj.unidad_personalizada else ""

    def get_categoria_nombre(self, obj):
        return obj.categoria_manual.nombre_categoria if obj.categoria_manual else ""

    def get_cliente_nombre(self, obj):
        cliente = obj.pedido.cliente
        return cliente.nombre_cliente if cliente else ""


# ==========================================================================
# EDICIÓN ADMINISTRATIVA DE PEDIDO
# ==========================================================================
class EditarDetalleSerializer(serializers.Serializer):
    detalle_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    presentacion_id = serializers.PrimaryKeyRelatedField(
        queryset=PresentacionProducto.objects.all(),
        source="presentacion",
        required=False,
        allow_null=True,
    )
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    nombre_producto = serializers.CharField(required=False, allow_blank=True)
    unidad_id = serializers.PrimaryKeyRelatedField(
        queryset=UnidadMedida.objects.all(),
        source="unidad_personalizada",
        required=False,
        allow_null=True,
    )
    categoria_id = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
        source="categoria_manual",
        required=False,
        allow_null=True,
    )


class EditarPedidoSerializer(serializers.Serializer):
    """Edita líneas existentes y elimina las que el admin quitó (mirror de editar_pedido_view)."""

    detalles = EditarDetalleSerializer(many=True)
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError(
                "El pedido debe tener al menos un producto."
            )
        return value

    @transaction.atomic
    def update(self, pedido, validated_data):
        usuario = self.context["request"].user
        ids_recibidos = []
        nuevo_total = Decimal("0")

        for item in validated_data["detalles"]:
            detalle_id = item.get("detalle_id")
            cantidad = item["cantidad"]
            precio_unitario = item["precio_unitario"]
            nueva_presentacion = item.get("presentacion")

            if cantidad <= 0:
                raise serializers.ValidationError("La cantidad debe ser mayor a 0.")
            if precio_unitario < 0:
                raise serializers.ValidationError("El precio no puede ser negativo.")

            if detalle_id:
                # ---------- línea existente: editar ----------
                try:
                    detalle = pedido.detalles.get(id=detalle_id)
                except DetallePedido.DoesNotExist:
                    raise serializers.ValidationError(
                        "Uno de los productos no pertenece a este pedido."
                    )

                # Registra en el historial cualquier cambio antes de sobreescribir
                # los valores, para dejar trazabilidad de quién editó qué y cuándo.
                cambios = []
                if detalle.cantidad != cantidad:
                    cambios.append(("cantidad", detalle.cantidad, cantidad))
                if detalle.precio_unitario != precio_unitario:
                    cambios.append(("precio_unitario", detalle.precio_unitario, precio_unitario))

                if detalle.presentacion_id is not None:
                    # Línea de catálogo: solo puede pasar a otra presentación de
                    # catálogo, no convertirse en personalizada.
                    if item.get("nombre_producto"):
                        raise serializers.ValidationError(
                            "No se puede convertir un producto de catálogo en "
                            "personalizado; elimínalo y agrega uno nuevo."
                        )
                    if nueva_presentacion and nueva_presentacion.id != detalle.presentacion_id:
                        cambios.append((
                            "presentacion",
                            _etiqueta_presentacion(detalle.presentacion),
                            _etiqueta_presentacion(nueva_presentacion),
                        ))
                        detalle.presentacion = nueva_presentacion
                else:
                    # Línea personalizada: no puede convertirse en catálogo.
                    if nueva_presentacion:
                        raise serializers.ValidationError(
                            "No se puede convertir un producto personalizado en "
                            "catálogo; elimínalo y agrega uno nuevo."
                        )
                    nuevo_nombre = (item.get("nombre_producto") or "").strip()
                    if nuevo_nombre and nuevo_nombre != detalle.nombre_personalizado:
                        cambios.append(
                            ("nombre_personalizado", detalle.nombre_personalizado, nuevo_nombre)
                        )
                        detalle.nombre_personalizado = nuevo_nombre

                    nueva_unidad = item.get("unidad_personalizada")
                    if nueva_unidad and nueva_unidad.id != detalle.unidad_personalizada_id:
                        cambios.append((
                            "unidad_personalizada",
                            detalle.unidad_personalizada.nombre_unidad
                            if detalle.unidad_personalizada
                            else "—",
                            nueva_unidad.nombre_unidad,
                        ))
                        detalle.unidad_personalizada = nueva_unidad

                detalle.cantidad = cantidad
                detalle.precio_unitario = precio_unitario
                if cambios:
                    detalle.fue_modificado = True
                    detalle.modificado_por = usuario

                detalle.save()

                for campo, anterior, nuevo in cambios:
                    HistorialDetallePedido.objects.create(
                        detalle=detalle,
                        usuario=usuario,
                        campo=campo,
                        valor_anterior=str(anterior),
                        valor_nuevo=str(nuevo),
                    )

                ids_recibidos.append(detalle.id)
                nuevo_total += detalle.subtotal
            else:
                # ---------- línea nueva ----------
                nombre = (item.get("nombre_producto") or "").strip()
                if bool(nueva_presentacion) == bool(nombre):
                    raise serializers.ValidationError(
                        "Cada producto nuevo debe ser de catálogo (con presentación) "
                        "o personalizado (con nombre), no ambos ni ninguno."
                    )
                nuevo_detalle = DetallePedido(
                    pedido=pedido,
                    presentacion=nueva_presentacion,
                    nombre_personalizado=nombre or None,
                    unidad_personalizada=None if nueva_presentacion else item.get("unidad_personalizada"),
                    categoria_manual=None if nueva_presentacion else item.get("categoria_manual"),
                    cantidad=cantidad,
                    precio_unitario=precio_unitario,
                    es_catalogo=bool(nueva_presentacion),
                )
                nuevo_detalle.save()
                ids_recibidos.append(nuevo_detalle.id)
                nuevo_total += nuevo_detalle.subtotal

        pedido.detalles.exclude(id__in=ids_recibidos).delete()
        pedido.total_pedido = nuevo_total
        pedido.observaciones = validated_data.get("observaciones", pedido.observaciones)
        pedido.save()
        return pedido

    def to_representation(self, instance):
        return {"success": True, "total": instance.total_pedido}


# ==========================================================================
# HISTORIAL DE CAMBIOS POR PEDIDO
# ==========================================================================
def _etiqueta_presentacion(presentacion):
    return (
        f"{presentacion.producto.nombre_producto} · {presentacion.nombre_presentacion} "
        f"({presentacion.unidad_venta.abreviatura_unidad})"
    )


CAMPO_ETIQUETAS = {
    "cantidad": "Cantidad",
    "precio_unitario": "Precio unitario",
    "nombre_personalizado": "Nombre del producto",
    "presentacion": "Presentación",
    "unidad_personalizada": "Unidad de venta",
}


class HistorialDetallePedidoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_usuario", read_only=True)
    producto_nombre = serializers.SerializerMethodField()
    campo_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = HistorialDetallePedido
        fields = [
            "id",
            "detalle",
            "producto_nombre",
            "campo",
            "campo_etiqueta",
            "valor_anterior",
            "valor_nuevo",
            "usuario",
            "usuario_nombre",
            "fecha",
            "motivo",
        ]

    def get_producto_nombre(self, obj):
        detalle = obj.detalle
        if detalle.presentacion_id:
            return detalle.presentacion.producto.nombre_producto
        return detalle.nombre_personalizado or "Personalizado"

    def get_campo_etiqueta(self, obj):
        return CAMPO_ETIQUETAS.get(obj.campo, obj.campo)


# ==========================================================================
# LOTES DE PEDIDOS (impresión/entrega masiva)
# ==========================================================================
class LoteSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_usuario", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = LotePedidos
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "usuario",
            "usuario_nombre",
            "cantidad_pedidos",
            "total_lote",
            "fecha_creacion",
        ]


class LoteDetailSerializer(LoteSerializer):
    pedidos = serializers.SerializerMethodField()

    class Meta(LoteSerializer.Meta):
        fields = LoteSerializer.Meta.fields + ["pedidos"]

    def get_pedidos(self, obj):
        pedidos = (
            obj.pedidos.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-fecha_pedido")
        )
        return PedidoListSerializer(pedidos, many=True).data
