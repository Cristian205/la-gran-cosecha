import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone


class UsuarioManager(BaseUserManager):
    def _create_user(self, email_usuario, nombre_usuario, password, **extra_fields):
        if not email_usuario:
            raise ValueError("El email es obligatorio.")
        email_usuario = self.normalize_email(email_usuario)
        user = self.model(
            email_usuario=email_usuario,
            nombre_usuario=nombre_usuario,
            is_active=extra_fields.pop("is_active", True),
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email_usuario, nombre_usuario, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email_usuario, nombre_usuario, password, **extra_fields)

    def create_superuser(self, email_usuario, nombre_usuario, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("El superusuario debe tener is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("El superusuario debe tener is_superuser=True.")
        return self._create_user(email_usuario, nombre_usuario, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    ROLES = [
        ("ADMIN", "Administrador de Sede"),
        ("ANALISTA", "Analista de Inventario/Pedidos"),
        ("GERENTE", "Gerente General"),
    ]

    uid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    nombre_usuario = models.CharField("Nombre Completo", max_length=150)
    email_usuario = models.EmailField("Correo Electrónico", unique=True)
    rol_usuario = models.CharField(
        "Rol en el Sistema", max_length=20, choices=ROLES, default="ANALISTA"
    )

    is_active = models.BooleanField("Cuenta Activa", default=True)
    is_staff = models.BooleanField("Acceso al Staff", default=False)

    # Quien administra Crynex, no un negocio. Es lo que separa el panel de la
    # plataforma —planes, permisos, altas— del panel de cada empresa. Se
    # distingue de `is_superuser` a propósito: ese es un permiso de Django que
    # hoy tienen cuatro de las cinco cuentas por herencia, y no debería bastar
    # para tocar los planes de todos los clientes.
    es_staff_plataforma = models.BooleanField(
        "Administra Crynex", default=False,
        help_text="Acceso al panel de la plataforma: planes, permisos y negocios.",
    )
    debe_cambiar_password = models.BooleanField("Debe cambiar contraseña", default=False)

    # Robustez y seguridad
    intentos_fallidos = models.PositiveIntegerField(default=0)
    ultima_ip = models.GenericIPAddressField(null=True, blank=True)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)

    # OTP (verificación de identidad)
    token_verificacion = models.CharField(max_length=255, null=True, blank=True)
    token_expiracion = models.DateTimeField(null=True, blank=True)

    # Auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_modificacion = models.DateTimeField(auto_now=True)
    ultimo_login_exitoso = models.DateTimeField(null=True, blank=True)

    # Preferencia personal: estructura del menú lateral del panel (grupos/orden).
    # Vacío/[] significa "usar la estructura por defecto" (ver sidebarConfig.ts).
    sidebar_layout = models.JSONField(default=list, blank=True)

    # Preferencia personal: tipos de Notificacion que este usuario no quiere ver.
    notificaciones_silenciadas = models.JSONField(default=list, blank=True)

    groups = models.ManyToManyField(
        "auth.Group",
        related_name="usuario_custom_set",
        blank=True,
        verbose_name="grupos",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        related_name="usuario_custom_permissions_set",
        blank=True,
        verbose_name="permisos de usuario",
    )

    objects = UsuarioManager()

    USERNAME_FIELD = "email_usuario"
    REQUIRED_FIELDS = ["nombre_usuario"]

    class Meta:
        # Preservamos el nombre de tabla original para no perder datos existentes.
        db_table = "ui_usuario"
        verbose_name = "Usuario de Sistema"
        verbose_name_plural = "Usuarios del Fruver"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.nombre_usuario} ({self.rol_usuario})"

    # Lógica de seguridad (portada del modelo original)
    def esta_bloqueado(self):
        if self.bloqueado_hasta and timezone.now() < self.bloqueado_hasta:
            return True
        return False

    def es_token_valido(self, token):
        if self.token_verificacion == token and self.token_expiracion:
            return timezone.now() < self.token_expiracion
        return False
