from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.common.permissions import es_owner
from apps.common.utils import convertir_texto_a_decimal  # noqa: F401 (reservado)

from .permisos import TODOS_LOS_CODENAMES

Usuario = get_user_model()


class UsuarioSerializer(serializers.ModelSerializer):
    """Representación de solo lectura de un usuario administrativo."""

    es_administrador = serializers.SerializerMethodField()
    permisos = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            "id",
            "uid",
            "nombre_usuario",
            "email_usuario",
            "rol_usuario",
            "is_active",
            "is_staff",
            "is_superuser",
            "es_administrador",
            "debe_cambiar_password",
            "permisos",
            "ultimo_login_exitoso",
            "fecha_creacion",
            "sidebar_layout",
            "notificaciones_silenciadas",
        ]
        read_only_fields = fields

    def get_es_administrador(self, obj):
        return es_owner(obj)

    def get_permisos(self, obj):
        if es_owner(obj):
            return sorted(TODOS_LOS_CODENAMES)
        return sorted(
            f"{p.content_type.app_label}.{p.codename}"
            for p in obj.user_permissions.select_related("content_type")
        )


class EditarUsuarioSerializer(serializers.Serializer):
    """Edición administrativa de un usuario (nombre, rol, estado)."""

    nombre_usuario = serializers.CharField(max_length=150, required=False)
    rol_usuario = serializers.ChoiceField(
        choices=[r[0] for r in Usuario.ROLES], required=False
    )
    is_active = serializers.BooleanField(required=False)


class PermisosUsuarioSerializer(serializers.Serializer):
    """Asignación de permisos granulares a un usuario que no es dueño."""

    permisos = serializers.ListField(child=serializers.CharField(), allow_empty=True)

    def validate_permisos(self, value):
        invalidos = set(value) - TODOS_LOS_CODENAMES
        if invalidos:
            raise serializers.ValidationError(
                f"Permisos no reconocidos: {', '.join(sorted(invalidos))}"
            )
        return value


class LoginSerializer(serializers.Serializer):
    """Paso 1: credenciales."""

    email_usuario = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class VerifyOtpSerializer(serializers.Serializer):
    """Paso 2: ticket firmado + código OTP."""

    otp_ticket = serializers.CharField()
    otp_token = serializers.CharField(max_length=6)


class CrearUsuarioSerializer(serializers.Serializer):
    """Alta de usuario administrativo (genera clave temporal)."""

    email = serializers.EmailField()
    nombre = serializers.CharField(max_length=150)
    rol = serializers.ChoiceField(
        choices=[r[0] for r in Usuario.ROLES], default="ANALISTA"
    )

    def validate_email(self, value):
        if Usuario.objects.filter(email_usuario__iexact=value).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta registrada con este correo."
            )
        return value


class PreferenciasSerializer(serializers.Serializer):
    """
    Preferencias propias del usuario autenticado (estructura del sidebar,
    tipos de notificación silenciados). Ambos campos son opcionales para que
    `MeView.patch` pueda actualizar uno sin tocar el otro.
    """

    sidebar_layout = serializers.JSONField(required=False)
    notificaciones_silenciadas = serializers.ListField(
        child=serializers.CharField(), required=False
    )


class CambiarPasswordSerializer(serializers.Serializer):
    """Cambio de contraseña del propio usuario autenticado."""

    password_actual = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_nueva = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password_nueva(self, value):
        validate_password(value, user=self.context["request"].user)
        return value
