"""
La API de la agenda.

Misma asimetría que en inventario y en la caja: los recursos se editan como
recurso REST normal —son un catálogo—, y las reservas se leen así pero se
cambian con operaciones con nombre: crear, reprogramar, cambiar de estado. Un
`PATCH {"inicio": "..."}` sugeriría que mover una reserva es escribir un campo,
y no lo es: vuelve a disputar un hueco y tiene que pasar por el mismo bloqueo.
"""
from rest_framework import serializers

from apps.inventory.models import Ubicacion
from apps.orders.models import Cliente
from apps.tenancy.fields import ClaveDelNegocio

from .models import ConfiguracionReservas, Recurso, Reserva
from .operaciones import TRANSICIONES


class ConfiguracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionReservas
        fields = [
            "nombre_recurso",
            "nombre_recurso_plural",
            "duracion_minutos",
            "antelacion_maxima_dias",
        ]

    def validate_duracion_minutos(self, valor):
        if valor < 5:
            raise serializers.ValidationError("Una reserva de menos de cinco minutos no es una reserva.")
        return valor


class RecursoSerializer(serializers.ModelSerializer):
    ubicacion_id = ClaveDelNegocio(
        Ubicacion, source="ubicacion", required=False, allow_null=True
    )
    ubicacion_nombre = serializers.CharField(source="ubicacion.nombre", read_only=True)

    class Meta:
        model = Recurso
        fields = [
            "id",
            "codigo",
            "nombre",
            "zona",
            "capacidad",
            "reservas_simultaneas",
            "activo",
            "orden",
            "ubicacion_id",
            "ubicacion_nombre",
        ]

    def validate_reservas_simultaneas(self, valor):
        if valor < 1:
            raise serializers.ValidationError(
                "Un recurso que no admite ninguna reserva no es reservable."
            )
        return valor


class ReservaSerializer(serializers.ModelSerializer):
    recurso_nombre = serializers.CharField(source="recurso.nombre", read_only=True)
    recurso_zona = serializers.CharField(source="recurso.zona", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    #: Los estados a los que puede pasar DESDE el actual. Va en la respuesta
    #: para que la pantalla pinte los botones que de verdad se pueden pulsar en
    #: vez de reimplementar la tabla de transiciones en TypeScript — que es
    #: como acaban divergiendo el servidor y el panel.
    siguientes = serializers.SerializerMethodField()

    class Meta:
        model = Reserva
        fields = [
            "id",
            "recurso",
            "recurso_nombre",
            "recurso_zona",
            "cliente",
            "nombre_contacto",
            "telefono_contacto",
            "personas",
            "inicio",
            "fin",
            "estado",
            "estado_display",
            "siguientes",
            "origen",
            "nota",
            "venta",
            "fecha_creacion",
        ]
        read_only_fields = fields

    def get_siguientes(self, obj):
        return [
            {"valor": estado, "etiqueta": Reserva.Estado(estado).label}
            for estado in TRANSICIONES.get(obj.estado, ())
        ]


class CrearReservaSerializer(serializers.Serializer):
    recurso_id = ClaveDelNegocio(Recurso, source="recurso")
    cliente_id = ClaveDelNegocio(
        Cliente, source="cliente", required=False, allow_null=True
    )
    inicio = serializers.DateTimeField()
    #: Opcional: sin él manda la duración del negocio. Es lo que permite
    #: reservar desde el mostrador con dos datos, quién y a qué hora.
    fin = serializers.DateTimeField(required=False, allow_null=True)
    personas = serializers.IntegerField(min_value=1, default=1)
    nombre_contacto = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    telefono_contacto = serializers.CharField(
        max_length=40, required=False, allow_blank=True, default=""
    )
    nota = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class ReprogramarSerializer(serializers.Serializer):
    recurso_id = ClaveDelNegocio(
        Recurso, source="recurso", required=False, allow_null=True
    )
    inicio = serializers.DateTimeField(required=False, allow_null=True)
    fin = serializers.DateTimeField(required=False, allow_null=True)
    personas = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=Reserva.Estado.choices)
    nota = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AgendaSerializer(serializers.Serializer):
    """Los dos extremos de lo que se quiere ver. Ambos obligatorios: una agenda
    sin ventana devolvería el histórico entero el día que el negocio lleve dos
    años funcionando."""

    desde = serializers.DateTimeField()
    hasta = serializers.DateTimeField()
    recurso_id = ClaveDelNegocio(
        Recurso, source="recurso", required=False, allow_null=True
    )

    def validate(self, datos):
        if datos["hasta"] <= datos["desde"]:
            raise serializers.ValidationError("El final de la ventana va después del principio.")
        return datos
