from django.contrib import admin

from .models import MensajeContacto


@admin.register(MensajeContacto)
class MensajeContactoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "motivo", "telefono", "email", "atendido", "fecha_creacion")
    list_filter = ("atendido", "motivo", "fecha_creacion")
    search_fields = ("nombre", "email", "telefono", "mensaje")
    list_editable = ("atendido",)
    readonly_fields = ("fecha_creacion",)
