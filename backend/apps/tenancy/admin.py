from django.contrib import admin

from .models import Domain, Membership, Tenant


class DominioInline(admin.TabularInline):
    model = Domain
    extra = 1


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ["nombre", "slug", "estado", "fecha_creacion"]
    list_filter = ["estado"]
    search_fields = ["nombre", "slug"]
    prepopulated_fields = {"slug": ("nombre",)}
    readonly_fields = ["uuid", "fecha_creacion", "fecha_actualizacion"]
    inlines = [DominioInline]


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ["hostname", "tenant", "es_primario", "verificado"]
    list_filter = ["es_primario", "verificado"]
    search_fields = ["hostname"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["usuario", "tenant", "rol", "activo"]
    list_filter = ["rol", "activo", "tenant"]
    search_fields = ["usuario__email_usuario", "usuario__nombre_usuario"]
