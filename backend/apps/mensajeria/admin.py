from django.contrib import admin

from .models import ConfiguracionWhatsApp, ExclusionWhatsApp, MensajeWhatsApp, PlantillaWhatsApp


class SinAmbitoMixin:
    """El admin de Django es de plataforma: ve todos los negocios."""

    def get_queryset(self, request):
        return self.model.all_tenants.all()


@admin.register(ConfiguracionWhatsApp)
class ConfiguracionAdmin(SinAmbitoMixin, admin.ModelAdmin):
    list_display = ("tenant", "activo", "proveedor", "respaldo_activo")
    list_filter = ("activo", "proveedor")


@admin.register(PlantillaWhatsApp)
class PlantillaAdmin(SinAmbitoMixin, admin.ModelAdmin):
    list_display = ("tenant", "evento", "meta_nombre", "twilio_content_sid", "activa")
    list_filter = ("evento", "activa")


@admin.register(MensajeWhatsApp)
class MensajeAdmin(SinAmbitoMixin, admin.ModelAdmin):
    list_display = ("fecha_creacion", "tenant", "evento", "destino", "estado", "proveedor")
    list_filter = ("estado", "evento", "proveedor")
    search_fields = ("destino", "id_externo", "clave")
    readonly_fields = [f.name for f in MensajeWhatsApp._meta.fields]


@admin.register(ExclusionWhatsApp)
class ExclusionAdmin(SinAmbitoMixin, admin.ModelAdmin):
    list_display = ("tenant", "telefono", "motivo", "fecha")
