from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.common.permissions import es_owner_de, permisos_de
from apps.common.utils import convertir_texto_a_decimal  # noqa: F401 (reservado)

from .permisos import TODOS_LOS_CODENAMES

Usuario = get_user_model()


class UsuarioSerializer(serializers.ModelSerializer):
    """Representación de solo lectura de un usuario administrativo."""

    es_administrador = serializers.SerializerMethodField()
    permisos = serializers.SerializerMethodField()
    rol_en_negocio = serializers.SerializerMethodField()
    negocios = serializers.SerializerMethodField()

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
            "rol_en_negocio",
            "negocios",
        ]
        read_only_fields = fields

    def _tenant(self):
        """El negocio de la petición: los permisos son suyos, no del usuario."""
        contexto = self.context
        return contexto.get("tenant") or getattr(contexto.get("request"), "tenant", None)

    def get_es_administrador(self, obj):
        return es_owner_de(obj, self._tenant())

    def get_permisos(self, obj):
        tenant = self._tenant()
        if es_owner_de(obj, tenant):
            return sorted(TODOS_LOS_CODENAMES)
        return sorted(permisos_de(obj, tenant))

    def get_rol_en_negocio(self, obj):
        """
        El rol que manda desde la fase 3. `rol_usuario` se sigue exponiendo por
        compatibilidad con el panel, pero quien decide el acceso es este.
        """
        tenant = self._tenant()
        if tenant is None:
            return None
        pertenencia = obj.memberships.filter(tenant=tenant, activo=True).first()
        return pertenencia.rol if pertenencia else None

    def get_negocios(self, obj):
        """
        Los negocios en los que trabaja esta persona, para el selector del panel.

        Solo se calcula donde hace falta —el perfil propio, el login y el cambio
        de negocio— y quien lo pide lo declara con `incluir_negocios`. En un
        listado del equipo sería una consulta por fila para un dato que esa
        pantalla no usa.
        """
        if not self.context.get("incluir_negocios"):
            return None
        peticion = self.context.get("request")
        activo = getattr(peticion, "tenant", None) if peticion else None
        return [
            {
                "uuid": str(m.tenant.uuid),
                "slug": m.tenant.slug,
                "nombre": m.tenant.nombre,
                "rol": m.rol,
                "activo": m.tenant_id == getattr(activo, "id", None),
            }
            for m in obj.memberships.filter(activo=True).select_related("tenant")
            if m.tenant.esta_operativo
        ]


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
