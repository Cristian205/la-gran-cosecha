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
            "motivo",
            "atendido",
            "fecha_creacion",
        ]
        read_only_fields = ["id", "atendido", "fecha_creacion"]

    def validate(self, datos):
        # Sin correo ni teléfono no hay a quién responderle: el mensaje
        # quedaría en la bandeja como una promesa imposible de cumplir.
        email = datos.get("email", getattr(self.instance, "email", ""))
        telefono = (datos.get("telefono") or getattr(self.instance, "telefono", "") or "").strip()
        if not email and not telefono:
            raise serializers.ValidationError(
                {"telefono": "Déjanos un teléfono o un correo para responderte."}
            )
        return datos


class SuscriptorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Suscriptor
        fields = ["id", "email", "nombre", "origen", "activo", "fecha_creacion"]
        read_only_fields = ["id", "activo", "fecha_creacion"]
        # Sin esto, un correo repetido daria 400 y el visitante veria un error
        # por haberse apuntado dos veces, que es lo que hace cualquiera que no
        # esta seguro de si le funciono. La vista lo resuelve como exito.
        extra_kwargs = {"email": {"validators": []}}
