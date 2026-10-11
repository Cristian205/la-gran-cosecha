from rest_framework import serializers

from .eventos import CODIGOS
from .models import ConfiguracionWhatsApp, ExclusionWhatsApp, MensajeWhatsApp, PlantillaWhatsApp
from .telefonos import normalizar_e164


class ConfiguracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionWhatsApp
        fields = [
            "activo",
            "proveedor",
            "respaldo_activo",
            "exige_consentimiento",
            "meta_phone_number_id",
            "twilio_remitente",
            "telefonos_alertas",
            "eventos_apagados",
            "fecha_actualizacion",
        ]
        read_only_fields = ["fecha_actualizacion"]

    def validate_telefonos_alertas(self, valor):
        if not isinstance(valor, list):
            raise serializers.ValidationError("Debe ser una lista de teléfonos.")
        normalizados = []
        for telefono in valor:
            e164 = normalizar_e164(telefono)
            if not e164:
                raise serializers.ValidationError(f"«{telefono}» no es un teléfono válido.")
            if e164 not in normalizados:
                normalizados.append(e164)
        return normalizados

    def validate_eventos_apagados(self, valor):
        if not isinstance(valor, list) or not set(valor) <= CODIGOS:
            raise serializers.ValidationError("Contiene eventos que no existen.")
        return sorted(set(valor))


class PlantillaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaWhatsApp
        fields = ["id", "evento", "meta_nombre", "meta_idioma", "twilio_content_sid", "cuerpo", "activa"]

    def validate_evento(self, valor):
        if valor not in CODIGOS:
            raise serializers.ValidationError("Evento desconocido.")
        return valor


class MensajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MensajeWhatsApp
        fields = [
            "id", "evento", "destino", "texto", "estado", "proveedor", "id_externo",
            "error", "intentos", "proximo_intento", "pedido_id",
            "fecha_creacion", "fecha_envio", "fecha_actualizacion",
        ]
        read_only_fields = fields


class ExclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExclusionWhatsApp
        fields = ["id", "telefono", "motivo", "fecha"]
        read_only_fields = ["fecha"]

    def validate_telefono(self, valor):
        e164 = normalizar_e164(valor)
        if not e164:
            raise serializers.ValidationError("Teléfono no válido.")
        return e164
