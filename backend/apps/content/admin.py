from django.contrib import admin

from .models import BeneficioComercial, OfertaProducto, PromoBanner, StoreSettings, Testimonio, TrustBadge


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "telefono", "whatsapp_numero", "fecha_actualizacion")

    def has_add_permission(self, request):
        return not StoreSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PromoBanner)
class PromoBannerAdmin(admin.ModelAdmin):
    list_display = ("titulo", "orden", "activo")
    list_editable = ("orden", "activo")


@admin.register(Testimonio)
class TestimonioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rol", "estrellas", "orden", "activo")
    list_editable = ("orden", "activo")


@admin.register(TrustBadge)
class TrustBadgeAdmin(admin.ModelAdmin):
    list_display = ("etiqueta", "valor", "tipo", "icono", "orden", "activo")
    list_editable = ("orden", "activo")
    list_filter = ("tipo",)


@admin.register(BeneficioComercial)
class BeneficioComercialAdmin(admin.ModelAdmin):
    list_display = ("titulo", "icono", "orden", "activo")
    list_editable = ("orden", "activo")


@admin.register(OfertaProducto)
class OfertaProductoAdmin(admin.ModelAdmin):
    list_display = ("presentacion", "precio_oferta", "fecha_fin", "activo")
    list_editable = ("activo",)
