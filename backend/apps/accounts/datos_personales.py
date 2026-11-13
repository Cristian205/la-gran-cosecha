"""
Validación de los datos personales de un usuario del panel.

Un solo lugar para las reglas, que usan tanto el alta como la edición:

- Teléfono: entre 7 y 15 dígitos; se aceptan espacios, guiones, paréntesis y
  un «+» inicial al escribirlo, pero se guarda limpio («+57 300 123 4567» →
  «+573001234567»).
- Documento: CC y TI solo dígitos (6 a 10 y 10 a 11); CE, PA y PPT letras y
  dígitos (3 a 15). Se guarda en mayúsculas y sin espacios ni puntos.
- Dirección: al menos 5 caracteres.
"""
import re

from rest_framework import serializers

TIPOS_DOCUMENTO = ("CC", "CE", "TI", "PA", "PPT")

REGLAS_DOCUMENTO = {
    "CC": (re.compile(r"^\d{6,10}$"), "La cédula de ciudadanía lleva entre 6 y 10 dígitos."),
    "TI": (re.compile(r"^\d{10,11}$"), "La tarjeta de identidad lleva 10 u 11 dígitos."),
    "CE": (re.compile(r"^[A-Z0-9]{3,15}$"), "Revisa la cédula de extranjería: letras y números, de 3 a 15."),
    "PA": (re.compile(r"^[A-Z0-9]{3,15}$"), "Revisa el pasaporte: letras y números, de 3 a 15."),
    "PPT": (re.compile(r"^[A-Z0-9]{3,15}$"), "Revisa el PPT: letras y números, de 3 a 15."),
}


def limpiar_telefono(valor: str) -> str:
    valor = (valor or "").strip()
    if not valor:
        return ""
    if not re.fullmatch(r"\+?[\d\s\-().]+", valor):
        raise serializers.ValidationError("Escribe solo números (puede empezar con +).")
    digitos = re.sub(r"\D", "", valor)
    if not 7 <= len(digitos) <= 15:
        raise serializers.ValidationError("El teléfono debe tener entre 7 y 15 dígitos.")
    return ("+" if valor.startswith("+") else "") + digitos


def limpiar_documento(tipo: str, numero: str) -> str:
    numero = re.sub(r"[\s.\-]", "", (numero or "")).upper()
    regla = REGLAS_DOCUMENTO.get(tipo)
    if regla and not regla[0].fullmatch(numero):
        raise serializers.ValidationError({"numero_documento": regla[1]})
    return numero


def documento_en_uso(tipo: str, numero: str, excluir_id=None) -> bool:
    from .models import Usuario

    qs = Usuario.objects.filter(tipo_documento=tipo, numero_documento=numero)
    if excluir_id is not None:
        qs = qs.exclude(pk=excluir_id)
    return qs.exists()


class DatosPersonalesMixin(serializers.Serializer):
    """Los cuatro campos y su validación cruzada (tipo ↔ número)."""

    telefono_usuario = serializers.CharField(max_length=30, allow_blank=True)
    direccion_usuario = serializers.CharField(max_length=255, allow_blank=True)
    tipo_documento = serializers.ChoiceField(choices=TIPOS_DOCUMENTO, allow_blank=True)
    numero_documento = serializers.CharField(max_length=30, allow_blank=True)

    def validate_telefono_usuario(self, valor):
        return limpiar_telefono(valor)

    def validate_direccion_usuario(self, valor):
        valor = (valor or "").strip()
        if valor and len(valor) < 5:
            raise serializers.ValidationError("Escribe la dirección completa.")
        return valor

    def validar_documento(self, attrs, actual=None, excluir_id=None):
        """`actual`: el usuario que se edita, para completar lo que no se envió."""
        tipo = attrs.get("tipo_documento", getattr(actual, "tipo_documento", ""))
        numero = attrs.get("numero_documento", getattr(actual, "numero_documento", ""))
        if not tipo and not numero:
            return attrs
        if not tipo:
            raise serializers.ValidationError({"tipo_documento": "Elige el tipo de documento."})
        if not numero:
            raise serializers.ValidationError({"numero_documento": "Escribe el número de documento."})
        numero = limpiar_documento(tipo, numero)
        if documento_en_uso(tipo, numero, excluir_id):
            raise serializers.ValidationError(
                {"numero_documento": "Ya hay un usuario registrado con este documento."}
            )
        if "numero_documento" in attrs or "tipo_documento" in attrs:
            attrs["tipo_documento"] = tipo
            attrs["numero_documento"] = numero
        return attrs
