"""
La API de los domicilios.

Misma asimetría que en inventario, en la caja y en la agenda: las zonas y los
repartidores se editan como recurso REST normal —son catálogos—, y los envíos
se leen así pero se cambian con operaciones con nombre: crear, asignar, cambiar
de estado. Un `PATCH {"repartidor": 3}` sugeriría que asignar es escribir un
campo, y no lo es: hay que contar lo que ya lleva y eso pasa por un bloqueo.
"""
from rest_framework import serializers

from apps.orders.models import Cliente, Pedido
from apps.tenancy.fields import ClaveDelNegocio

from .models import ConfiguracionEnvios, Envio, Repartidor, Zona
from .operaciones import TRANSICIONES


class ConfiguracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionEnvios
        fields = [
            "nombre_repartidor",
            "nombre_repartidor_plural",
            "tarifa_base",
            "minutos_de_promesa",
            "exige_zona",
        ]

    def validate_minutos_de_promesa(self, valor):
        if valor < 1:
            raise serializers.ValidationError(
                "Prometer cero minutos es prometer que ya llegó."
            )
        return valor


class ZonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zona
        fields = [
            "id",
            "codigo",
            "nombre",
            "tarifa",
            "minutos_de_promesa",
            "activa",
            "orden",
        ]


class RepartidorSerializer(serializers.ModelSerializer):
    #: Cuántos lleva encima ahora. Va en la respuesta porque es la única
    #: pregunta que quien despacha le hace a esta lista, y calcularla en el
    #: frontend obligaría a traerse todos los envíos para contar.
    carga_actual = serializers.SerializerMethodField()

    class Meta:
        model = Repartidor
        fields = [
            "id",
            "nombre",
            "telefono",
            "vehiculo",
            "carga_maxima",
            "carga_actual",
            "activo",
            "orden",
        ]

    def get_carga_actual(self, obj):
        # `prefetch` lo deja resuelto en la vista; sin él sigue siendo una
        # consulta por repartidor, y un negocio tiene tres o cuatro.
        return sum(1 for e in obj.envios.all() if e.estado in Envio.ESTADOS_EN_CALLE)

    def validate_carga_maxima(self, valor):
        if valor < 1:
            raise serializers.ValidationError(
                "Un repartidor que no puede llevar nada no reparte."
            )
        return valor


class EnvioSerializer(serializers.ModelSerializer):
    zona_nombre = serializers.CharField(source="zona.nombre", read_only=True)
    repartidor_nombre = serializers.CharField(source="repartidor.nombre", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    #: Los estados a los que puede pasar DESDE el actual. Va en la respuesta
    #: para que la pantalla pinte los botones que de verdad se pueden pulsar en
    #: vez de reimplementar la tabla de transiciones en TypeScript — que es
    #: como acaban divergiendo el servidor y el panel.
    siguientes = serializers.SerializerMethodField()

    class Meta:
        model = Envio
        fields = [
            "id",
            "zona",
            "zona_nombre",
            "repartidor",
            "repartidor_nombre",
            "cliente",
            "nombre_contacto",
            "telefono_contacto",
            "direccion",
            "referencia",
            "tarifa",
            "cobro_contra_entrega",
            "monto_a_cobrar",
            "estado",
            "estado_display",
            "siguientes",
            "origen",
            "nota",
            "prometido_para",
            "salida",
            "entrega",
            "venta",
            "pedido",
            "fecha_creacion",
        ]
        read_only_fields = fields

    def get_siguientes(self, obj):
        return [
            {"valor": estado, "etiqueta": Envio.Estado(estado).label}
            for estado in TRANSICIONES.get(obj.estado, ())
        ]


class CrearEnvioSerializer(serializers.Serializer):
    zona_id = ClaveDelNegocio(Zona, source="zona", required=False, allow_null=True)
    cliente_id = ClaveDelNegocio(
        Cliente, source="cliente", required=False, allow_null=True
    )
    #: De qué pedido de la tienda sale. Va aquí y no en `apps.orders` para que
    #: los pedidos sigan sin saber que existe este módulo.
    pedido_id = ClaveDelNegocio(Pedido, source="pedido", required=False, allow_null=True)

    #: Opcional SOLO porque puede venir del pedido de la tienda, que ya trae la
    #: dirección del cliente. Si no llega por ninguna de las dos vías,
    #: `operaciones.crear()` se niega: un domicilio sin dirección no es un
    #: domicilio. La comprobación vive allí y no aquí para que valga también
    #: cuando quien crea el envío no es una petición HTTP.
    direccion = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )
    referencia = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
    )
    nombre_contacto = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    telefono_contacto = serializers.CharField(
        max_length=40, required=False, allow_blank=True, default=""
    )
    #: Opcional: sin ella manda la tarifa de la zona. Se puede forzar porque el
    #: dueño perdonándole el domicilio a un cliente fiel es una operación real.
    tarifa = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    cobro_contra_entrega = serializers.BooleanField(default=False)
    monto_a_cobrar = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0
    )
    nota = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )


class AsignarSerializer(serializers.Serializer):
    repartidor_id = ClaveDelNegocio(Repartidor, source="repartidor")


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=Envio.Estado.choices)
    nota = serializers.CharField(max_length=255, required=False, allow_blank=True)


class TableroSerializer(serializers.Serializer):
    """
    La ventana del tablero, y los dos extremos son OPCIONALES.

    Es la diferencia con `AgendaSerializer` en reservas, donde son obligatorios,
    y no es una incoherencia: una agenda sin ventana devolvería el histórico
    entero, pero un tablero de despacho sin ventana devuelve justo lo que hay
    vivo, que es lo que quien lo abre está mirando. Con ventana pasa a ser el
    modo auditoría. Ver `operaciones.tablero()`.
    """

    desde = serializers.DateTimeField(required=False, allow_null=True)
    hasta = serializers.DateTimeField(required=False, allow_null=True)
    estado = serializers.ListField(
        child=serializers.ChoiceField(choices=Envio.Estado.choices),
        required=False,
        allow_empty=True,
    )

    def validate(self, datos):
        desde, hasta = datos.get("desde"), datos.get("hasta")
        if desde and hasta and hasta <= desde:
            raise serializers.ValidationError(
                "El final de la ventana va después del principio."
            )
        return datos
