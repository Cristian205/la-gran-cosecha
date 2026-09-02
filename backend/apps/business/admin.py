from django.contrib import admin

from .models import PerfilNegocio, Preset, TenantModulo


@admin.register(Preset)
class PresetAdmin(admin.ModelAdmin):
    list_display = ("nombre", "slug", "sector", "version", "es_predeterminado", "activo")
    list_filter = ("activo", "sector")
    search_fields = ("nombre", "slug", "sector")
    prepopulated_fields = {"slug": ("nombre",)}


@admin.register(PerfilNegocio)
class PerfilNegocioAdmin(admin.ModelAdmin):
    list_display = ("tenant", "sector", "preset_origen", "preset_version_origen")
    list_filter = ("sector", "preset_origen")
    search_fields = ("tenant__nombre",)
    readonly_fields = ("fecha_creacion", "fecha_actualizacion")


@admin.register(TenantModulo)
class TenantModuloAdmin(admin.ModelAdmin):
    list_display = ("tenant", "modulo", "activo", "fecha_activacion")
    list_filter = ("activo", "modulo")
    search_fields = ("tenant__nombre",)
