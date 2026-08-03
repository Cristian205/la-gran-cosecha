from rest_framework import serializers

from .models import MensajeContacto


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
