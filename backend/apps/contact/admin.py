from django.contrib import admin

from .models import MensajeContacto, SolicitudComercial


@admin.register(MensajeContacto)
class MensajeContactoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "motivo", "telefono", "email", "atendido", "fecha_creacion")
    list_filter = ("atendido", "motivo", "fecha_creacion")
    search_fields = ("nombre", "email", "telefono", "mensaje")
    list_editable = ("atendido",)
    readonly_fields = ("fecha_creacion",)


@admin.register(SolicitudComercial)
class SolicitudComercialAdmin(admin.ModelAdmin):
    list_display = ("nombre", "negocio", "solucion", "contacto", "origen", "estado", "fecha_creacion")
    list_filter = ("estado", "solucion", "fecha_creacion")
    list_editable = ("estado",)
    search_fields = ("nombre", "negocio", "contacto", "descripcion")
    readonly_fields = ("fecha_creacion",)
