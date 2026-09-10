from django.contrib import admin

from .models import ConfiguracionEnvios, Envio, Repartidor, Zona


@admin.register(ConfiguracionEnvios)
class ConfiguracionEnviosAdmin(admin.ModelAdmin):
    list_display = (
        "tenant",
        "nombre_repartidor",
        "tarifa_base",
        "minutos_de_promesa",
        "exige_zona",
    )


@admin.register(Zona)
class ZonaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "tarifa", "minutos_de_promesa", "activa")
    list_filter = ("activa",)
    search_fields = ("nombre", "codigo")


@admin.register(Repartidor)
class RepartidorAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "vehiculo", "carga_maxima", "activo")
    list_filter = ("activo",)
    search_fields = ("nombre", "telefono")


@admin.register(Envio)
class EnvioAdmin(admin.ModelAdmin):
    list_display = (
        "nombre_contacto",
        "direccion",
        "zona",
        "repartidor",
        "estado",
        "prometido_para",
    )
    list_filter = ("estado", "origen", "zona", "repartidor")
    search_fields = ("nombre_contacto", "telefono_contacto", "direccion")
    # El estado se mueve por su tabla de transiciones y las horas las estampa
    # `operaciones.cambiar_estado`, no este formulario. Aqui se deja editable
    # porque es lo unico que el admin puede ofrecer, pero el tablero del panel
    # es el camino bueno.
    date_hierarchy = "fecha_creacion"
