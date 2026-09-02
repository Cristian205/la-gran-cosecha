from django.contrib import admin

from .models import ConfiguracionReservas, Recurso, Reserva


@admin.register(ConfiguracionReservas)
class ConfiguracionReservasAdmin(admin.ModelAdmin):
    list_display = ("tenant", "nombre_recurso", "duracion_minutos", "antelacion_maxima_dias")


@admin.register(Recurso)
class RecursoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "zona", "capacidad", "reservas_simultaneas", "activo")
    list_filter = ("activo", "zona")
    search_fields = ("nombre", "codigo")


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("nombre_contacto", "recurso", "inicio", "fin", "personas", "estado")
    list_filter = ("estado", "origen", "recurso")
    search_fields = ("nombre_contacto", "telefono_contacto")
    # El estado se mueve por su tabla de transiciones, no escribiendo el campo:
    # ver `operaciones.cambiar_estado`. Aqui se deja editable a proposito, que
    # es lo unico que el admin puede ofrecer, pero la agenda del panel es el
    # camino bueno.
    date_hierarchy = "inicio"
