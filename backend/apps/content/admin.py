from django.contrib import admin

from .models import PromoBanner, SiteConfig, Testimonio, TrustBadge


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "telefono", "whatsapp_numero", "fecha_actualizacion")

    def has_add_permission(self, request):
        return not SiteConfig.objects.exists()

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
    list_display = ("etiqueta", "valor", "icono", "orden", "activo")
    list_editable = ("orden", "activo")
