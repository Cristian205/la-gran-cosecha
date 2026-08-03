from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["-fecha_creacion"]
    list_display = ("email_usuario", "nombre_usuario", "rol_usuario", "is_staff", "is_active")
    list_filter = ("rol_usuario", "is_staff", "is_active")
    search_fields = ("email_usuario", "nombre_usuario")

    fieldsets = (
        (None, {"fields": ("email_usuario", "password")}),
        ("Información personal", {"fields": ("nombre_usuario", "rol_usuario", "ultima_ip")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas", {"fields": ("ultimo_login_exitoso", "fecha_creacion")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email_usuario", "nombre_usuario", "rol_usuario", "password1", "password2"),
            },
        ),
    )
    readonly_fields = ("fecha_creacion", "ultimo_login_exitoso")
