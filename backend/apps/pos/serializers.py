"""
La API de la caja.

Como en inventario, hay una asimetría deliberada: las ventas se LEEN como
recurso y se cambian con operaciones con nombre —abrir, añadir, cobrar,
anular—. No hay un `PATCH /ventas/1/ {"estado": "PAGADA"}`, porque cobrar no es
escribir un campo: es registrar pagos y mover el inventario en la misma
transacción.
"""
from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import PresentacionProducto
from apps.inventory.models import Ubicacion
from apps.orders.models import Cliente
from apps.tenancy.fields import ClaveDelNegocio

from .models import LineaVenta, MedioPago, Pago, Turno, Venta


class MedioPagoSerializer(serializers.ModelSerializer):
    cuenta_en_caja = serializers.BooleanField(read_only=True)

    class Meta:
        model = MedioPago
        fields = ["id", "codigo", "nombre", "tipo", "activo", "orden", "cuenta_en_caja"]


class TurnoSerializer(serializers.ModelSerializer):
    ubicacion_nombre = serializers.CharField(source="ubicacion.nombre", read_only=True)
    abierto_por = serializers.CharField(
        source="usuario_apertura.nombre_usuario", read_only=True
    )
    esta_abierto = serializers.BooleanField(read_only=True)

    class Meta:
        model = Turno
        fields = [
            "id",
            "ubicacion",
            "ubicacion_nombre",
            "abierto_por",
            "fondo_inicial",
            "fecha_apertura",
            "fecha_cierre",
            "total_declarado",
            "total_calculado",
            "diferencia",
            "nota_cierre",
            "esta_abierto",
        ]
        read_only_fields = fields


class AbrirTurnoSerializer(serializers.Serializer):
    ubicacion_id = ClaveDelNegocio(
        Ubicacion, source="ubicacion", required=False, allow_null=True
    )
    fondo_inicial = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=Decimal("0")
    )


class CerrarTurnoSerializer(serializers.Serializer):
    #: Lo que la persona contó en el cajón. Se pide siempre, aunque el sistema
    #: sepa el número esperado: el arqueo solo sirve si alguien cuenta de verdad.
    total_declarado = serializers.DecimalField(max_digits=12, decimal_places=2)
    nota = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class LineaVentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = LineaVenta
        fields = [
            "id",
            "presentacion",
            "nombre_congelado",
            "cantidad",
            "precio_unitario",
            "subtotal",
            "atributos",
            "nota",
        ]
        read_only_fields = fields


class PagoSerializer(serializers.ModelSerializer):
    medio_nombre = serializers.CharField(source="medio.nombre", read_only=True)

    class Meta:
        model = Pago
        fields = ["id", "medio", "medio_nombre", "importe", "referencia", "fecha"]
        read_only_fields = fields


class VentaSerializer(serializers.ModelSerializer):
    lineas = LineaVentaSerializer(many=True, read_only=True)
    pagos = PagoSerializer(many=True, read_only=True)
    cliente_nombre = serializers.CharField(
        source="cliente.nombre_cliente", read_only=True, default=""
    )
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Venta
        fields = [
            "id",
            "turno",
            "numero",
            "estado",
            "estado_display",
            "cliente",
            "cliente_nombre",
            "subtotal",
            "descuento",
            "total",
            "contexto",
            "nota",
            "fecha",
            "fecha_pago",
            "motivo_anulacion",
            "lineas",
            "pagos",
        ]
        read_only_fields = fields


class AbrirVentaSerializer(serializers.Serializer):
    cliente_id = ClaveDelNegocio(
        Cliente, source="cliente", required=False, allow_null=True
    )
    #: Lo que aporta el panel lateral del módulo que la originó: {"mesa": 7}.
    #: Viaja opaco a propósito — el POS no sabe qué hay dentro, ver pos/paneles.
    contexto = serializers.DictField(required=False, default=dict)


class AgregarLineaSerializer(serializers.Serializer):
    presentacion_id = ClaveDelNegocio(PresentacionProducto, source="presentacion")
    cantidad = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001")
    )
    nota = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    atributos = serializers.DictField(required=False, allow_null=True, default=dict)


class PagoEntradaSerializer(serializers.Serializer):
    medio_id = ClaveDelNegocio(MedioPago, source="medio")
    importe = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    referencia = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")


class CobrarSerializer(serializers.Serializer):
    #: Una lista y no un solo medio: el pago partido —mitad efectivo, mitad
    #: tarjeta— es la norma en un mostrador, no la excepción.
    pagos = PagoEntradaSerializer(many=True)
    descuento = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=Decimal("0")
    )

    def validate_pagos(self, value):
        if not value:
            raise serializers.ValidationError("Registra al menos un pago.")
        return value


class AnularSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
