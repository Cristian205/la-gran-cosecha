from rest_framework import serializers

from .models import MensajeContacto, Suscriptor


class MensajeContactoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MensajeContacto
        fields = [
            "id",
            "nombre",
            "email",
            "telefono",
            "mensaje",
            "atendido",
            "fecha_creacion",
        ]
        read_only_fields = ["id", "atendido", "fecha_creacion"]


class SuscriptorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suscriptor
        fields = ["id", "email", "nombre", "origen", "activo", "fecha_creacion"]
        read_only_fields = ["id", "activo", "fecha_creacion"]
        # Sin esto, un correo repetido daria 400 y el visitante veria un error
        # por haberse apuntado dos veces, que es lo que hace cualquiera que no
        # esta seguro de si le funciono. La vista lo resuelve como exito.
        extra_kwargs = {"email": {"validators": []}}
