from django.contrib import admin

from .models import MensajeContacto


@admin.register(MensajeContacto)
class MensajeContactoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "email", "telefono", "atendido", "fecha_creacion")
    list_filter = ("atendido", "fecha_creacion")
    search_fields = ("nombre", "email", "mensaje")
    list_editable = ("atendido",)
    readonly_fields = ("fecha_creacion",)
