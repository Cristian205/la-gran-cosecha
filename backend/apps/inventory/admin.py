from django.contrib import admin

from .models import Existencia, MovimientoInventario, Ubicacion


@admin.register(Ubicacion)
class UbicacionAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "tipo", "es_predeterminada", "activa")
    list_filter = ("tipo", "activa")
    search_fields = ("nombre", "codigo")


@admin.register(Existencia)
class ExistenciaAdmin(admin.ModelAdmin):
    list_display = ("producto", "ubicacion", "cantidad", "reservada", "disponible")
    list_filter = ("ubicacion",)
    search_fields = ("producto__nombre_producto", "producto__codigo_producto")
    # El saldo se edita con un ajuste, que deja rastro en el kardex. Un
    # `UPDATE` desde el admin lo dejaria descuadrado sin que nadie sepa por que.
    readonly_fields = ("cantidad", "reservada", "fecha_actualizacion")


@admin.register(MovimientoInventario)
class MovimientoAdmin(admin.ModelAdmin):
    list_display = ("fecha", "tipo", "producto", "ubicacion", "cantidad", "saldo_resultante")
    list_filter = ("tipo", "ubicacion")
    search_fields = ("producto__nombre_producto", "motivo", "origen_tipo")
    date_hierarchy = "fecha"

    def has_change_permission(self, request, obj=None):
        # Append-only: un movimiento equivocado se corrige con un ajuste, no
        # reescribiendo el historico.
        return False

    def has_delete_permission(self, request, obj=None):
        return False
