from rest_framework import serializers

import re

from .models import MensajeContacto, SolicitudComercial, Suscriptor


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


class SolicitudComercialSerializer(serializers.ModelSerializer):
    """
    Lo que llega del formulario del sitio comercial.

    `sitio_web` es una trampa para bots: en el formulario va escondido y una
    persona nunca lo llena. Si llega con algo, la vista responde que todo salió
    bien pero no guarda nada, así el bot no aprende que fue detectado.
    """

    sitio_web = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = SolicitudComercial
        fields = [
            "nombre",
            "negocio",
            "solucion",
            "descripcion",
            "contacto",
            "origen",
            "pagina",
            "sitio_web",
        ]
        extra_kwargs = {
            "nombre": {"min_length": 2},
            "descripcion": {"required": False, "allow_blank": True},
            "negocio": {"required": False, "allow_blank": True},
            "origen": {"required": False, "allow_blank": True},
            "pagina": {"required": False, "allow_blank": True},
        }

    def validate_contacto(self, valor):
        """Un correo o un teléfono: algo a lo que se pueda responder."""
        valor = (valor or "").strip()
        es_correo = bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]{2,}", valor))
        digitos = re.sub(r"\D", "", valor)
        es_telefono = 7 <= len(digitos) <= 15 and bool(re.fullmatch(r"[\d\s()+\-.]+", valor))
        if not (es_correo or es_telefono):
            raise serializers.ValidationError(
                "Déjanos un correo o un teléfono válido para responderte."
            )
        return valor
