"""
La API del inventario, en tres formas y con una asimetría deliberada.

Las existencias y los movimientos se LEEN por la API y no se escriben: el saldo
solo cambia por una operación con nombre —un ajuste, un traslado, una entrada—,
nunca por un PATCH a la cantidad. Un `PUT` sobre `Existencia.cantidad` dejaría
el saldo sin movimiento que lo explique, que es exactamente el descuadre que
esta app existe para hacer imposible.
"""
from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Producto
from apps.tenancy.fields import ClaveDelNegocio

from .models import Existencia, MovimientoInventario, Ubicacion


class UbicacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ubicacion
        fields = ["id", "nombre", "codigo", "tipo", "es_predeterminada", "activa"]


class ExistenciaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(
        source="producto.nombre_producto", read_only=True
    )
    producto_codigo = serializers.CharField(
        source="producto.codigo_producto", read_only=True
    )
    ubicacion_nombre = serializers.CharField(source="ubicacion.nombre", read_only=True)
    #: `disponible` es una propiedad del modelo y no una columna: se calcula
    #: aquí para que el panel no tenga que repetir la resta y arriesgarse a
    #: olvidar las reservadas, que es el error clásico al pintar stock.
    disponible = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )

    class Meta:
        model = Existencia
        fields = [
            "id",
            "producto",
            "producto_nombre",
            "producto_codigo",
            "ubicacion",
            "ubicacion_nombre",
            "cantidad",
            "reservada",
            "disponible",
            "fecha_actualizacion",
        ]
        read_only_fields = fields


class MovimientoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(
        source="producto.nombre_producto", read_only=True
    )
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    usuario_nombre = serializers.CharField(
        source="usuario.nombre_usuario", read_only=True, default=""
    )

    class Meta:
        model = MovimientoInventario
        fields = [
            "id",
            "fecha",
            "tipo",
            "tipo_display",
            "producto",
            "producto_nombre",
            "ubicacion",
            "presentacion",
            "cantidad",
            "saldo_resultante",
            "origen_tipo",
            "origen_id",
            "usuario_nombre",
            "motivo",
        ]
        read_only_fields = fields


# ==========================================================================
# LAS OPERACIONES, COMO ENTRADAS DE FORMULARIO
# ==========================================================================
class _OperacionBase(serializers.Serializer):
    """Lo que toda operación necesita saber: sobre qué y dónde."""

    producto_id = ClaveDelNegocio(Producto, source="producto")
    ubicacion_id = ClaveDelNegocio(
        Ubicacion, source="ubicacion", required=False, allow_null=True
    )
    motivo = serializers.CharField(max_length=255, required=False, allow_blank=True)


class EntradaSerializer(_OperacionBase):
    cantidad = serializers.DecimalField(
        max_digits=14, decimal_places=3, min_value=Decimal("0.001")
    )


class AjusteSerializer(_OperacionBase):
    #: El total contado, no la diferencia. Ver `operaciones.ajustar`: es lo que
    #: la persona tiene delante cuando cuenta, y pedirle la resta es pedirle
    #: justo el paso donde se equivoca.
    cantidad_contada = serializers.DecimalField(max_digits=14, decimal_places=3)


class TrasladoSerializer(serializers.Serializer):
    producto_id = ClaveDelNegocio(Producto, source="producto")
    origen_id = ClaveDelNegocio(Ubicacion, source="origen")
    destino_id = ClaveDelNegocio(Ubicacion, source="destino")
    cantidad = serializers.DecimalField(
        max_digits=14, decimal_places=3, min_value=Decimal("0.001")
    )
    motivo = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate(self, datos):
        if datos["origen"].pk == datos["destino"].pk:
            raise serializers.ValidationError(
                {"destino_id": "El destino tiene que ser distinto del origen."}
            )
        return datos
